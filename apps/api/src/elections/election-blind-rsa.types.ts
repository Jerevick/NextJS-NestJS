import type { createPrivateKey, createPublicKey } from 'crypto';
import type { RsaPublicParams } from '@unicore/utils';

export type ElectionRsaKeyPair = {
  publicKey: ReturnType<typeof createPublicKey>;
  privateKey: ReturnType<typeof createPrivateKey>;
  publicKeyPem: string;
  publicParams: RsaPublicParams;
};
