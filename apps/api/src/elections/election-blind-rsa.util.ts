import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } from 'crypto';
import {
  blindCommitment,
  buildBallotCommitment,
  unblindSignature,
  verifyBlindRsaSignature,
  type RsaPublicParams,
} from '@unicore/utils';
import type { ElectionRsaKeyPair } from './election-blind-rsa.types';

export type { RsaPublicParams };

let devKeys: ElectionRsaKeyPair | null = null;

export function getElectionRsaKeys(): ElectionRsaKeyPair {
  const privPem = process.env.ELECTION_RSA_PRIVATE_KEY_PEM?.replace(/\\n/g, '\n');
  const pubPem = process.env.ELECTION_RSA_PUBLIC_KEY_PEM?.replace(/\\n/g, '\n');
  if (privPem && pubPem) {
    const publicKey = createPublicKey(pubPem);
    return {
      privateKey: createPrivateKey(privPem),
      publicKey,
      publicKeyPem: pubPem,
      publicParams: exportRsaPublicParams(publicKey),
    };
  }
  if (!devKeys) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const pub = createPublicKey(publicKey);
    devKeys = {
      publicKey: pub,
      privateKey: createPrivateKey(privateKey),
      publicKeyPem: publicKey,
      publicParams: exportRsaPublicParams(pub),
    };
  }
  return devKeys;
}

export function exportRsaPublicParams(
  publicKey: ReturnType<typeof createPublicKey>,
): RsaPublicParams {
  const jwk = publicKey.export({ format: 'jwk' }) as { n?: string; e?: string };
  if (!jwk.n || !jwk.e) throw new Error('Invalid RSA public key');
  return {
    modulusHex: Buffer.from(jwk.n, 'base64url').toString('hex'),
    exponentHex: Buffer.from(jwk.e, 'base64url').toString('hex'),
  };
}

export function newBallotCommitmentNonce(): string {
  return randomBytes(32).toString('hex');
}

export { buildBallotCommitment, blindCommitment, unblindSignature, verifyBlindRsaSignature };

function bufferToBigInt(buf: Buffer): bigint {
  return BigInt(`0x${buf.toString('hex')}`);
}

function bigIntToBuffer(n: bigint, length: number): Buffer {
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const buf = Buffer.from(hex, 'hex');
  if (buf.length > length) return buf.subarray(buf.length - length);
  if (buf.length < length) return Buffer.concat([Buffer.alloc(length - buf.length), buf]);
  return buf;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

function rsaPrivateExponent(privateKey: ReturnType<typeof createPrivateKey>) {
  const jwk = privateKey.export({ format: 'jwk' }) as { n?: string; d?: string };
  if (!jwk.n || !jwk.d) throw new Error('Invalid RSA private key');
  return {
    n: bufferToBigInt(Buffer.from(jwk.n, 'base64url')),
    d: bufferToBigInt(Buffer.from(jwk.d, 'base64url')),
  };
}

/** Electoral authority signs blinded message only (issuer never sees commitment). */
export function signBlindedCommitment(blindedHex: string): string {
  const keys = getElectionRsaKeys();
  const { n, d } = rsaPrivateExponent(keys.privateKey);
  const blinded = bufferToBigInt(Buffer.from(blindedHex, 'hex'));
  const signed = modPow(blinded, d, n);
  return bigIntToBuffer(signed, 256).toString('hex');
}

export function verifyWithStoredParams(commitmentHex: string, signatureHex: string): boolean {
  return verifyBlindRsaSignature(commitmentHex, signatureHex, getElectionRsaKeys().publicParams);
}
