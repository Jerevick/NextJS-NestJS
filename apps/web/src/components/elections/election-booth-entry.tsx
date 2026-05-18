'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { clientBlindEndorse, generateClientBallotCommitment } from '@/lib/election-booth-client';
import { blindSignBoothAction, issueBoothCredentialAction } from '@/app/elections/actions';

const BOOTH_KEY = 'unicore_election_booth';

export function ElectionBoothEntryButton({
  electionId,
  disabled,
  style,
}: {
  electionId: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      style={style}
      onClick={() => {
        startTransition(async () => {
          const { ballotCommitment } = await generateClientBallotCommitment(electionId);
          const issued = await issueBoothCredentialAction(electionId, ballotCommitment);
          if ('error' in issued && issued.error) {
            alert(issued.error);
            return;
          }
          if (!issued.rsaPublicParams) {
            alert('Election RSA keys unavailable.');
            return;
          }
          const { blindRsaSignature } = await clientBlindEndorse({
            electionId,
            ballotCommitment,
            rsaPublicParams: issued.rsaPublicParams,
            signBlinded: async (blindedCommitmentHex) => {
              const signed = await blindSignBoothAction(
                electionId,
                issued.ballotToken,
                blindedCommitmentHex,
              );
              if ('error' in signed && signed.error) throw new Error(signed.error);
              return { signedBlindedHex: signed.signedBlindedHex };
            },
          });
          sessionStorage.setItem(
            BOOTH_KEY,
            JSON.stringify({
              electionId,
              ballotToken: issued.ballotToken,
              ballotSignature: issued.ballotSignature,
              blindRsaSignature,
            }),
          );
          router.push(`/elections/${electionId}/booth`);
        });
      }}
    >
      {pending ? 'Preparing booth…' : 'Enter blind booth'}
    </button>
  );
}
