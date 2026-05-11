'use client';

import React, { useMemo } from 'react';

export const VAULT_LAUNCH_STEP_LABELS = [
  'Treasure found',
  'Opening the vault',
  'Forging Artistocks',
  'Placing your first treasure',
  'Minting the key',
  'Publishing your portal',
] as const;

export type VaultLaunchPhase = 'idle' | 'running' | 'celebrating' | 'failed';

export interface VaultLaunchCeremonyCardProps {
  phase: VaultLaunchPhase;
  /** Step index 0..5 while running; used for failed state */
  activeStepIndex: number;
  /** Set when phase === 'failed' */
  failedStepIndex: number | null;
  errorMessage: string | null;
  tokenName: string | null;
  /** Display name for transcript (token or artist name) during the run */
  progressTokenName: string | null;
  onRetry: () => void;
  onDismiss: () => void;
}

function friendlyError(raw: string | null): string {
  if (!raw || !raw.trim()) return 'Something went wrong. You can try again or keep your page private for now.';
  const t = raw.trim();
  if (t.length > 180) return `${t.slice(0, 177)}…`;
  return t;
}

function transcriptLineForStep(stepIndex: number, tokenLabel: string | null): string {
  const t = tokenLabel?.trim();
  const tok = t && t.length > 0 ? t : 'your';
  switch (stepIndex) {
    case 0:
      return 'Treasure found.';
    case 1:
      return 'Opening the vault.';
    case 2:
      return `Forging ${tok} Artistocks.`;
    case 3:
      return 'Placing the first treasure.';
    case 4:
      return 'Minting the key.';
    case 5:
      return 'Publishing the portal.';
    default:
      return '';
  }
}

export default function VaultLaunchCeremonyCard({
  phase,
  activeStepIndex,
  failedStepIndex,
  errorMessage,
  tokenName,
  progressTokenName,
  onRetry,
  onDismiss,
}: VaultLaunchCeremonyCardProps) {
  const tokenLabel = progressTokenName ?? tokenName;

  /** One line at a time while running — updates when `activeStepIndex` advances in `handleSaveArtist`. */
  const currentMilestoneCaption = useMemo(() => {
    if (phase !== 'running') return null;
    const line = transcriptLineForStep(activeStepIndex, tokenLabel);
    return line || null;
  }, [phase, activeStepIndex, tokenLabel]);

  const milestoneTotal = VAULT_LAUNCH_STEP_LABELS.length;

  return (
    <div
      className="vault-launch-card w-full rounded-xl border-2 border-amber-500/50 p-4 sm:p-5 mb-1 vault-launch-card-ambient text-center"
      role="region"
      aria-live="polite"
      aria-label="Launch progress"
    >
      <div className="relative z-10 w-full flex flex-col items-center">
        {phase === 'running' && (
          <>
            <p className="text-amber-200/95 text-sm font-medium mb-1">Launch in progress…</p>
            <p className="text-amber-400/70 text-xs mb-3 tabular-nums">
              Milestone {activeStepIndex + 1} of {milestoneTotal}
            </p>
          </>
        )}

        {phase === 'failed' && (
          <p className="text-amber-200/90 text-sm mb-3">Launch paused. You can retry or dismiss.</p>
        )}

        {phase === 'running' && currentMilestoneCaption && (
          <p
            key={activeStepIndex}
            className="vault-launch-line-emphasis mb-4 w-full max-w-md mx-auto text-sm font-medium text-amber-100"
          >
            {currentMilestoneCaption}
          </p>
        )}

        <ol className="space-y-1.5 text-sm list-none m-0 p-0 w-full max-w-md mx-auto text-center">
          {VAULT_LAUNCH_STEP_LABELS.map((label, i) => {
            let status: 'pending' | 'active' | 'done' | 'error' = 'pending';
            if (phase === 'running') {
              if (i < activeStepIndex) status = 'done';
              else if (i === activeStepIndex) status = 'active';
            } else if (phase === 'celebrating') {
              status = 'done';
            } else if (phase === 'failed' && failedStepIndex !== null) {
              if (i < failedStepIndex) status = 'done';
              else if (i === failedStepIndex) status = 'error';
            }

            return (
              <li
                key={label}
                className={`vault-launch-step flex items-center justify-center gap-2 rounded-md px-2 py-1 vault-launch-step--${status}`}
              >
                <span className="flex-shrink-0 w-5 text-xs font-mono opacity-70 text-center">{i + 1}.</span>
                <span
                  className={`min-w-0 ${status === 'active' ? 'text-amber-200 font-medium vault-launch-step-active-shimmer' : ''}`}
                >
                  {label}
                </span>
                {status === 'done' && <span className="text-emerald-400 text-xs">✓</span>}
                {status === 'active' && phase === 'running' && (
                  <span className="text-amber-400/80 text-xs vault-launch-pulse">…</span>
                )}
                {status === 'error' && <span className="text-red-400 text-xs">!</span>}
              </li>
            );
          })}
        </ol>

        {phase === 'celebrating' && tokenName && (
          <div className="mt-4 w-full max-w-md mx-auto space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-950/25 px-4 py-4 text-center">
            <p className="text-emerald-200/95 text-sm font-semibold m-0">Contracts deployed successfully.</p>
            <p className="text-emerald-100/90 text-sm font-medium m-0">Entering your page…</p>
            <p className="text-emerald-300/85 text-xs m-0">{tokenName} is live.</p>
          </div>
        )}

        {phase === 'failed' && (
          <div className="mt-4 w-full max-w-md mx-auto rounded-md bg-red-950/40 border border-red-800/50 p-3 text-center">
            <p className="text-red-200/90 text-xs mb-2">
              {failedStepIndex !== null && VAULT_LAUNCH_STEP_LABELS[failedStepIndex]
                ? `Stopped at: ${VAULT_LAUNCH_STEP_LABELS[failedStepIndex]}`
                : 'Launch stopped'}
            </p>
            <p className="text-gray-300 text-xs mb-3">{friendlyError(errorMessage)}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={onRetry}
                className="px-3 py-1.5 rounded bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
