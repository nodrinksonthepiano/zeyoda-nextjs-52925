'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { InviteResolveTreasureBody } from '@/types/treasure-invite';

import {
  CLAIM_ERROR_ALREADY_CLAIMED,
  CLAIM_ERROR_NETWORK,
  CLAIM_ERROR_SESSION_EXPIRED,
  CLAIM_ERROR_WRONG_EMAIL,
  CLAIM_LOADING_MESSAGE,
  CLAIM_SELF_BANNER,
  CLAIMED_PUBLIC_FOOTNOTE,
  CONTINUE_LAUNCH_SETUP,
} from '@/app/constants/treasureCopy';
import { authenticatedFetch } from '@/app/utils/authenticatedFetch';

import { useWallet } from '@/app/components/MagicProvider';
import { useToast } from '@/app/contexts/ToastContext';

function normalizeMagicEmail(metaEmail: unknown): string | null {
  if (!metaEmail || typeof metaEmail !== 'string') return null;
  const t = metaEmail.trim().toLowerCase();
  return t || null;
}

type TreasureMediaKind = 'image' | 'video' | 'audio';

/** Strip query/hash, then classify by pathname extension; unknown → image (prefer <img> over black <video>). */
function classifyTreasureMediaUrl(url: string): TreasureMediaKind {
  const pathOnly = url.split('?')[0].split('#')[0].toLowerCase();
  const dot = pathOnly.lastIndexOf('.');
  const ext = dot >= 0 ? pathOnly.slice(dot + 1) : '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a'].includes(ext)) return 'audio';
  return 'image';
}

function TreasureMediaHero(props: {
  videosrc: string | null | undefined;
  featured_asset_url: string | null | undefined;
}) {
  const vs = typeof props.videosrc === 'string' ? props.videosrc.trim() : '';
  const fa = typeof props.featured_asset_url === 'string' ? props.featured_asset_url.trim() : '';

  let url = '';
  let kind: TreasureMediaKind = 'image';

  if (vs) {
    const vk = classifyTreasureMediaUrl(vs);
    if (vk === 'video' || vk === 'audio') {
      url = vs;
      kind = vk;
    } else if (fa) {
      url = fa;
      kind = classifyTreasureMediaUrl(fa);
    } else {
      url = vs;
      kind = 'image';
    }
  } else if (fa) {
    url = fa;
    kind = classifyTreasureMediaUrl(fa);
  }

  if (!url) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-white/15 mb-10 shadow-xl">
      {kind === 'video' && (
        <video className="w-full aspect-video object-cover bg-black" controls src={url} />
      )}
      {kind === 'audio' && (
        <div className="px-4 py-6 bg-black/30">
          <audio className="w-full" controls src={url} />
        </div>
      )}
      {kind === 'image' && (
        <img className="w-full aspect-video object-cover bg-black/20" alt="" src={url} />
      )}
    </div>
  );
}

interface Props {
  envelope: InviteResolveTreasureBody;
  onContinueLaunch: () => void;
}

export default function TreasureInviteShell({ envelope, onContinueLaunch }: Props) {
  const { showToast } = useToast();
  const { user, magic, getDidToken } = useWallet();
  const treasure = envelope.treasure;

  const [magicEmailNorm, setMagicEmailNorm] = useState<string | null>(null);
  const [isClaimant, setIsClaimant] = useState<boolean | null>(null);

  /** Auto-claim: one attempt per (coin, normalized email); resets when Magic email identity changes */
  const claimAttemptedForEmailRef = useRef<string | null>(null);

  const [claimPhase, setClaimPhase] = useState<'idle' | 'claiming' | 'err'>('idle');
  const [claimErrCode, setClaimErrCode] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [busyLogin, setBusyLogin] = useState(false);

  useEffect(() => {
    claimAttemptedForEmailRef.current = null;
  }, [magicEmailNorm]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!magic || !user) {
        setMagicEmailNorm(null);
        return;
      }
      try {
        const meta = await magic.user.getInfo();
        const emailNorm = normalizeMagicEmail(meta.email);
        if (!cancelled) setMagicEmailNorm(emailNorm ?? null);
      } catch {
        if (!cancelled) setMagicEmailNorm(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [magic, user]);

  useEffect(() => {
    let cancelled = false;

    if (envelope.status !== 'claimed') {
      setIsClaimant(null);
      return;
    }

    (async () => {
      try {
        if (!getDidToken) {
          if (!cancelled) setIsClaimant(null);
          return;
        }

        const token = await getDidToken();
        if (!token) {
          if (!cancelled) setIsClaimant(false);
          return;
        }

        const res = await fetch(
          `/api/invite/me-state?coin=${encodeURIComponent(envelope.coin_public_id)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (res.status === 404) {
          if (!cancelled) setIsClaimant(false);
          return;
        }

        const j = await res.json().catch(() => ({}));

        if (!cancelled) setIsClaimant(!!j?.isClaimant);
      } catch {
        if (!cancelled) setIsClaimant(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getDidToken, envelope.coin_public_id, envelope.status, user]);

  const checkWhitelist = useCallback(async (emailToCheck: string) => {
    const response = await authenticatedFetch(
      '/api/checkWhitelist',
      {
        method: 'POST',
        body: JSON.stringify({ email: emailToCheck }),
      },
      getDidToken,
      true,
    );
    return response.json();
  }, [getDidToken]);

  const loginFlow = async () => {
    if (!magic || !loginEmail.trim()) return;
    setBusyLogin(true);
    try {
      const wl = await checkWhitelist(loginEmail.trim());
      if (!wl?.isWhitelisted) {
        showToast('You appear to be rare treasure! We need to dig you up...', 'info');
        return;
      }
      await magic.auth.loginWithEmailOTP({ email: loginEmail.trim() });
      await magic.user.getInfo();
      showToast('Signed in.', 'success');
      setTimeout(() => window.location.reload(), 900);
    } catch {
      showToast('Login failed. Try again.', 'error');
    } finally {
      setBusyLogin(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function attemptClaim() {
      if (cancelled || envelope.status !== 'draft' || claimPhase !== 'idle') return;

      const em = magicEmailNorm;
      if (!em || !getDidToken) return;

      const guardKey = `${envelope.coin_public_id}|${em}`;
      if (claimAttemptedForEmailRef.current === guardKey) return;
      claimAttemptedForEmailRef.current = guardKey;

      setClaimPhase('claiming');
      try {
        const res = await authenticatedFetch(
          '/api/invite/claim',
          {
            method: 'POST',
            body: JSON.stringify({
              coin_public_id: envelope.coin_public_id,
              artist_slug: envelope.artist_slug,
            }),
          },
          getDidToken,
        );

        const j = await res.json().catch(() => ({}));

        if (!cancelled && res.ok) {
          showToast('Treasure claimed.', 'success');
          setTimeout(() => window.location.reload(), 650);
          return;
        }

        claimAttemptedForEmailRef.current = null;

        if (cancelled) return;

        const code = typeof j.code === 'string' ? j.code : 'unknown';

        setClaimErrCode(code);
        setClaimPhase('err');

        if (res.status === 401) showToast(CLAIM_ERROR_SESSION_EXPIRED, 'error');
        else if (code === 'reserved_email_mismatch') showToast(CLAIM_ERROR_WRONG_EMAIL, 'info');
        else if (code === 'already_claimed') showToast(CLAIM_ERROR_ALREADY_CLAIMED, 'error');
        else showToast(typeof j.message === 'string' ? j.message : CLAIM_ERROR_NETWORK, 'error');
      } catch {
        claimAttemptedForEmailRef.current = null;
        if (cancelled) return;
        setClaimErrCode('network');
        setClaimPhase('err');
        showToast(CLAIM_ERROR_NETWORK, 'error');
      }
    }

    void attemptClaim();
    return () => {
      cancelled = true;
    };
  }, [
    claimPhase,
    envelope.artist_slug,
    envelope.coin_public_id,
    envelope.status,
    getDidToken,
    magicEmailNorm,
    showToast,
  ]);

  const gradStart = treasure.theme?.gradientStart || treasure.theme?.primaryColor || '#1e1e2e';
  const gradMid = treasure.theme?.gradientMiddle || gradStart;
  const gradEnd = treasure.theme?.gradientEnd || treasure.theme?.accentColor || '#312e81';

  const showClaimedFootnote = envelope.status === 'claimed' && isClaimant === false;

  return (
    <div
      className="min-h-screen text-white pb-32"
      style={{
        background: `linear-gradient(135deg, ${gradStart}, ${gradMid}, ${gradEnd})`,
      }}
    >
      <div className="max-w-xl mx-auto px-4 pt-10">
        <h1 className="text-4xl font-black mb-2" style={{ fontFamily: treasure.theme?.fontFamily || 'Bungee, cursive' }}>
          {treasure.displayname}
        </h1>
        <p className="text-xl opacity-90 mb-6">{treasure.tokenName}</p>

        {treasure.artworktitle && (
          <p className="text-sm opacity-80 mb-1">
            {treasure.artworktitle}
            {treasure.artworkyear != null ? ` · ${treasure.artworkyear}` : ''}
          </p>
        )}

        {treasure.description && (
          <p className="text-sm leading-relaxed opacity-85 mb-6 whitespace-pre-wrap">{treasure.description}</p>
        )}

        {treasure.downloadPrice != null && <p className="text-sm mb-8">Download · ${treasure.downloadPrice}</p>}

        <TreasureMediaHero videosrc={treasure.videosrc} featured_asset_url={treasure.featured_asset_url} />

        {!user && envelope.status === 'draft' && (
          <div className="rounded-xl bg-black/30 border border-white/20 p-4 mb-8">
            <p className="text-sm mb-3">Sign in with the email you were given on the coin.</p>
            <input
              type="email"
              value={loginEmail}
              placeholder="artist@studio.com"
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full mb-3 rounded px-3 py-2 bg-slate-900 border border-white/20"
              autoComplete="email"
            />
            <button
              type="button"
              onClick={() => loginFlow()}
              disabled={busyLogin || !loginEmail.trim()}
              className="w-full py-3 rounded-lg font-bold bg-amber-400 text-black disabled:opacity-50"
            >
              {busyLogin ? 'Sending code…' : 'Send login code'}
            </button>
          </div>
        )}

        {envelope.status === 'draft' && user && !magicEmailNorm && (
          <p className="text-xs opacity-80 mb-4">Fetching session…</p>
        )}

        {envelope.status === 'draft' && user && magicEmailNorm && claimPhase === 'claiming' && (
          <p className="text-sm animate-pulse mb-4">{CLAIM_LOADING_MESSAGE}</p>
        )}

        {envelope.status === 'draft' && claimPhase === 'err' && (
          <div className="rounded-lg bg-red-900/40 border border-red-500/50 p-3 mb-4 text-sm space-y-2">
            <p>
              {claimErrCode === 'reserved_email_mismatch'
                ? CLAIM_ERROR_WRONG_EMAIL
                : claimErrCode === 'already_claimed'
                  ? CLAIM_ERROR_ALREADY_CLAIMED
                  : claimErrCode === 'network'
                    ? CLAIM_ERROR_NETWORK
                    : 'Could not claim. Try again.'}
            </p>
            <button
              type="button"
              className="underline font-semibold"
              onClick={() => {
                claimAttemptedForEmailRef.current = null;
                setClaimPhase('idle');
              }}
            >
              Retry
            </button>
          </div>
        )}

        {showClaimedFootnote && (
          <p className="text-sm opacity-80 italic border border-white/15 rounded-lg p-4 bg-black/25">
            {CLAIMED_PUBLIC_FOOTNOTE}
          </p>
        )}

        {isClaimant === true && envelope.status === 'claimed' && (
          <div className="fixed bottom-4 left-4 right-4 max-w-xl mx-auto space-y-3">
            <div className="rounded-xl bg-black/55 border border-amber-400/40 backdrop-blur p-4 text-sm">
              {CLAIM_SELF_BANNER}
            </div>
            <button
              type="button"
              onClick={onContinueLaunch}
              className="w-full py-4 rounded-xl font-black text-lg shadow-lg bg-amber-400 text-black"
            >
              {CONTINUE_LAUNCH_SETUP}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
