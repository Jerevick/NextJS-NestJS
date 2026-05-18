/** Browser + Node compatible Chaum RSA blind signature helpers (bigint math only). */

export type RsaPublicParams = { modulusHex: string; exponentHex: string };

function bufferToBigInt(hex: string): bigint {
  return BigInt(`0x${hex || '0'}`);
}

function bigIntToBuffer(n: bigint, length: number): Buffer {
  let h = n.toString(16);
  if (h.length % 2) h = `0${h}`;
  const buf = Buffer.from(h, 'hex');
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

function modInverse(a: bigint, mod: bigint): bigint {
  let [oldR, r] = [mod, a % mod];
  let [oldT, t] = [0n, 1n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldT, t] = [t, oldT - q * t];
  }
  if (oldR !== 1n) throw new Error('No modular inverse');
  return oldT < 0n ? oldT + mod : oldT;
}

function randomBytes32(): Buffer {
  const out = Buffer.alloc(32);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(new Uint8Array(out));
    return out;
  }
  throw new Error('Secure random unavailable');
}

export function buildBallotCommitment(electionId: string, nonceHex: string): string {
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  return createHash('sha256').update(`ballot:${electionId}:${nonceHex}`).digest('hex');
}

export function blindCommitment(
  commitmentHex: string,
  params: RsaPublicParams,
): { blindedHex: string; blindingFactorHex: string } {
  const n = bufferToBigInt(params.modulusHex);
  const e = bufferToBigInt(params.exponentHex);
  const m = bufferToBigInt(commitmentHex);
  const r = (bufferToBigInt(randomBytes32().toString('hex')) % (n - 1n)) + 1n;
  const blinded = (m * modPow(r, e, n)) % n;
  return {
    blindedHex: bigIntToBuffer(blinded, 256).toString('hex'),
    blindingFactorHex: r.toString(16),
  };
}

export function unblindSignature(
  signedBlindedHex: string,
  blindingFactorHex: string,
  params: RsaPublicParams,
): string {
  const n = bufferToBigInt(params.modulusHex);
  const signedBlinded = bufferToBigInt(signedBlindedHex);
  const r = bufferToBigInt(blindingFactorHex);
  const sig = (signedBlinded * modInverse(r, n)) % n;
  return bigIntToBuffer(sig, 256).toString('hex');
}

export function verifyBlindRsaSignature(
  commitmentHex: string,
  signatureHex: string,
  params: RsaPublicParams,
): boolean {
  try {
    const n = bufferToBigInt(params.modulusHex);
    const e = bufferToBigInt(params.exponentHex);
    return modPow(bufferToBigInt(signatureHex), e, n) === bufferToBigInt(commitmentHex);
  } catch {
    return false;
  }
}
