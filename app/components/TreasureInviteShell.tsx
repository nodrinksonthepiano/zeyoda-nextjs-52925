'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { InviteResolveTreasureBody, TreasureResolveDTO } from '@/types/treasure-invite';

import type { ArtistAsset } from '@/app/hooks/useArtistAssets';
import OvalGlowBackdrop from '@/app/components/OvalGlowBackdrop';
import OrbitPeekCarousel from '@/app/components/OrbitPeekCarousel';
import ThemeOrbitRenderer from '@/app/components/ThemeOrbitRenderer';
import {
  CLAIM_CTA_LABEL,
  CLAIM_ERROR_ALREADY_CLAIMED,
  CLAIM_ERROR_NETWORK,
  CLAIM_ERROR_SESSION_EXPIRED,
  CLAIM_ERROR_WRONG_EMAIL,
  CLAIM_GENERIC_ERR,
  CLAIM_LOADING_MESSAGE,
  CLAIM_SELF_BANNER,
  CLAIMED_PUBLIC_FOOTNOTE,
  CONTINUE_LAUNCH_SETUP,
  TREASURE_EMAIL_PLACEHOLDER,
  TREASURE_FETCHING_SESSION,
  TREASURE_HERO_PLACEHOLDER,
  TREASURE_LOGIN_LEAD,
  TREASURE_RETRY_CLAIM,
  TREASURE_SENDING_CODE,
  TOAST_CLAIM_SUCCESS,
  TOAST_LOGIN_FAILED,
  TOAST_SIGNED_IN,
  TOAST_WHITELIST_HINT,
} from '@/app/constants/treasureCopy';
import { authenticatedFetch } from '@/app/utils/authenticatedFetch';
import { isSentinelOrEmptyVideosrc } from '@/app/utils/buildInviteDraftPayloadV1';
import {
  buildStubArtistConfigFromDraft,
  draftRecordFromTreasureEnvelope,
} from '@/app/utils/inviteLaunchBridge';
import { applyArtistBackground } from '@/app/utils/themeBackground';

import { useWallet } from '@/app/components/MagicProvider';
import { useToast } from '@/app/contexts/ToastContext';

function normalizeMagicEmail(metaEmail: unknown): string | null {
  if (!metaEmail || typeof metaEmail !== 'string') return null;
  const t = metaEmail.trim().toLowerCase();
  return t || null;
}

type TreasureMediaKind = 'image' | 'video' | 'audio';

/** Strip query/hash, then classify by pathname extension; unknown → image. */
function classifyTreasureMediaUrl(url: string): TreasureMediaKind {
  const pathOnly = url.split('?')[0].split('#')[0].toLowerCase();
  const dot = pathOnly.lastIndexOf('.');
  const ext = dot >= 0 ? pathOnly.slice(dot + 1) : '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a'].includes(ext)) return 'audio';
  return 'image';
}

/** Same URL precedence as legacy TreasureMediaHero — for carousel + audio branch. */
function resolveTreasureHeroMedia(treasure: TreasureResolveDTO): { url: string; kind: TreasureMediaKind } | null {
  const rawVs = typeof treasure.videosrc === 'string' ? treasure.videosrc.trim() : '';
  const vs = isSentinelOrEmptyVideosrc(rawVs) ? '' : rawVs;
  const fa = typeof treasure.featured_asset_url === 'string' ? treasure.featured_asset_url.trim() : '';

  if (vs) {
    const vk = classifyTreasureMediaUrl(vs);
    if (vk === 'video' || vk === 'audio') {
      return { url: vs, kind: vk };
    }
    if (fa) {
      return { url: fa, kind: classifyTreasureMediaUrl(fa) };
    }
    return { url: vs, kind: 'image' };
  }
  if (fa) {
    return { url: fa, kind: classifyTreasureMediaUrl(fa) };
  }
  return null;
}

interface Props {
  envelope: InviteResolveTreasureBody;
  onContinueLaunch: () => void;
  onInviteClaimedRefetch?: () => Promise<void>;
}

export default function TreasureInviteShell({
  envelope,
  onContinueLaunch,
  onInviteClaimedRefetch,
}: Props) {
  const { showToast } = useToast();
  const { user, magic, getDidToken } = useWallet();
  const treasure = envelope.treasure;

  const stubConfig = useMemo(
    () => buildStubArtistConfigFromDraft(draftRecordFromTreasureEnvelope(envelope)),
    [envelope],
  );

  const heroResolved = useMemo(() => resolveTreasureHeroMedia(treasure), [treasure]);

  const carouselAssets: ArtistAsset[] = useMemo(() => {
    if (!heroResolved || heroResolved.kind === 'audio') return [];
    if (heroResolved.kind !== 'image' && heroResolved.kind !== 'video') return [];
    return [
      {
        id: `treasure-${envelope.coin_public_id}`,
        artistId: stubConfig.name,
        assetNumber: 0,
        url: heroResolved.url,
        type: heroResolved.kind,
        title: treasure.artworktitle ?? treasure.displayname,
      },
    ];
  }, [heroResolved, envelope.coin_public_id, stubConfig.name, treasure.artworktitle, treasure.displayname]);

  const [carouselIndex, setCarouselIndex] = useState(0);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const isOrbitAnimationPaused = useRef(false);

  const [magicEmailNorm, setMagicEmailNorm] = useState<string | null>(null);
  const [isClaimant, setIsClaimant] = useState<boolean | null>(null);

  const claimAttemptedForEmailRef = useRef<string | null>(null);

  const [claimPhase, setClaimPhase] = useState<'idle' | 'claiming' | 'err'>('idle');
  const [claimErrCode, setClaimErrCode] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [busyLogin, setBusyLogin] = useState(false);
  const [claimCtaShake, setClaimCtaShake] = useState(false);
  const treasureEmailInputRef = useRef<HTMLInputElement>(null);

  const giftAllArtistsConfig = useMemo(
    () => ({ [stubConfig.name]: stubConfig }),
    [stubConfig],
  );

  useEffect(() => {
    applyArtistBackground(stubConfig);
  }, [stubConfig]);

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
        showToast(TOAST_WHITELIST_HINT, 'info');
        return;
      }
      await magic.auth.loginWithEmailOTP({ email: loginEmail.trim() });
      await magic.user.getInfo();
      showToast(TOAST_SIGNED_IN, 'success');
      setTimeout(() => window.location.reload(), 900);
    } catch {
      showToast(TOAST_LOGIN_FAILED, 'error');
    } finally {
      setBusyLogin(false);
    }
  };

  /** Same UX as PurchaseFlow when logged out: shake + scroll/focus email, no submit until filled. */
  function handleClaimTreasureClick() {
    if (busyLogin) return;
    if (!loginEmail.trim()) {
      setClaimCtaShake(true);
      setTimeout(() => setClaimCtaShake(false), 500);
      const el = treasureEmailInputRef.current;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => el.focus(), 450);
      }
      return;
    }
    void loginFlow();
  }

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

        if (res.ok) {
          showToast(TOAST_CLAIM_SUCCESS, 'success');
          try {
            await onInviteClaimedRefetch?.();
          } catch {
            /* non-fatal */
          }
          if (!cancelled) {
            setClaimPhase('idle');
          }
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
    onInviteClaimedRefetch,
  ]);

  const showClaimedFootnote = envelope.status === 'claimed' && isClaimant === false;

  /** Non-carousel hero: single box with ref (onboarding-style halo behind content). */
  const staticHeroBoxStyle: React.CSSProperties = {
    position: 'relative',
    height: 'clamp(280px, 50vh, 720px)',
    width: 'auto',
    maxWidth: 'min(92vw, 1000px)',
    aspectRatio: '16 / 9',
    margin: '0 auto 16px auto',
    overflow: 'visible',
  };

  const heroCarousel = carouselAssets.length > 0 && heroResolved?.kind !== 'audio';

  return (
    <div className="flex min-h-screen flex-col items-center justify-between pt-10 px-6 pb-6 relative bg-primary text-white font-sans">
      <div id="particles" className="cosmic-particles" />

      <main className="app-main">
        <div className="text-center">
          <h1
            className="text-4xl md:text-5xl font-bold tracking-wider mt-1 md:mt-2 mb-3 md:mb-3 cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              fontFamily: stubConfig.theme.fontFamily,
              color: stubConfig.theme.accentColor,
              position: 'relative',
              zIndex: 100,
              pointerEvents: 'none',
              maxWidth: '85%',
              margin: '0 auto',
              lineHeight: '1.1',
            }}
            title={
              treasure.tokenName
                ? `${treasure.displayname} — ${treasure.tokenName}`
                : treasure.displayname
            }
          >
            {treasure.displayname}
          </h1>

          <div className="relative w-full max-w-5xl mx-auto mt-6 md:mt-14 mb-12 md:mb-16">
            {heroCarousel ? (
              <>
                <OvalGlowBackdrop
                  containerRef={videoContainerRef}
                  primaryColor={stubConfig.theme.primaryColor}
                  intensity={0.95}
                  zIndex={1}
                />
                <OrbitPeekCarousel
                  key={carouselAssets[0]?.id ?? 'treasure-hero'}
                  items={carouselAssets}
                  index={carouselIndex}
                  onIndexChange={setCarouselIndex}
                  containerRef={videoContainerRef}
                  peekPercent={10}
                  theme={{
                    fontFamily: stubConfig.theme.fontFamily,
                    primaryColor: stubConfig.theme.primaryColor,
                    accentColor: stubConfig.theme.accentColor,
                  }}
                  artistId={stubConfig.name}
                  treasuryWallet={null}
                  currentUser={user}
                />
                <ThemeOrbitRenderer
                  artistConfig={stubConfig}
                  orbitTokens={[]}
                  videoContainerRef={videoContainerRef}
                  isOrbitAnimationPaused={isOrbitAnimationPaused}
                  allArtistsConfig={giftAllArtistsConfig}
                  omitArtistOrbitalTokens
                  orbitRadiusScale={0.72}
                  orbitPointerEventsOnTokensOnly
                />
              </>
            ) : (
              <div ref={videoContainerRef} className="relative mx-auto" style={staticHeroBoxStyle}>
                <OvalGlowBackdrop
                  containerRef={videoContainerRef}
                  primaryColor={stubConfig.theme.primaryColor}
                  intensity={0.95}
                  zIndex={-1}
                />
                {heroResolved?.kind === 'audio' ? (
                  <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[14px] bg-black/25 px-4"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <audio className="w-full max-w-md" controls src={heroResolved.url} preload="metadata" />
                  </div>
                ) : (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-[14px] border border-white/15 bg-black/20 text-white/70 text-sm md:text-base px-6"
                    style={{ pointerEvents: 'none' }}
                  >
                    {TREASURE_HERO_PLACEHOLDER}
                  </div>
                )}
                <ThemeOrbitRenderer
                  artistConfig={stubConfig}
                  orbitTokens={[]}
                  videoContainerRef={videoContainerRef}
                  isOrbitAnimationPaused={isOrbitAnimationPaused}
                  allArtistsConfig={giftAllArtistsConfig}
                  omitArtistOrbitalTokens
                  orbitRadiusScale={0.72}
                  orbitPointerEventsOnTokensOnly
                />
              </div>
            )}
          </div>
        </div>

        <div className="action-section text-center w-full max-w-lg mx-auto px-1 space-y-5">
            {treasure.artworktitle && (
              <p className="text-sm opacity-85">
                {treasure.artworktitle}
                {treasure.artworkyear != null ? ` · ${treasure.artworkyear}` : ''}
              </p>
            )}

            {treasure.description && (
              <p className="text-sm leading-relaxed opacity-90 whitespace-pre-wrap">{treasure.description}</p>
            )}

            {!user && envelope.status === 'draft' && (
              <div
                className={`rounded-xl bg-black/35 border border-white/20 p-5 text-left shadow-lg backdrop-blur-sm ${claimCtaShake ? 'shake' : ''}`}
              >
                <p className="text-sm mb-4 leading-relaxed opacity-95">{TREASURE_LOGIN_LEAD}</p>
                <input
                  ref={treasureEmailInputRef}
                  type="email"
                  value={loginEmail}
                  placeholder={TREASURE_EMAIL_PLACEHOLDER}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full mb-3 rounded-lg px-3 py-3 bg-slate-900/90 border border-white/25 text-white placeholder:text-slate-500 min-h-[44px] text-base"
                  autoComplete="email"
                  inputMode="email"
                />
                <button
                  type="button"
                  onClick={handleClaimTreasureClick}
                  disabled={busyLogin}
                  className="custom-buy-button w-full py-3 rounded-xl font-bold disabled:opacity-50 min-h-[44px] text-base"
                >
                  {busyLogin ? TREASURE_SENDING_CODE : CLAIM_CTA_LABEL}
                </button>
              </div>
            )}

            {envelope.status === 'draft' && user && !magicEmailNorm && (
              <p className="text-xs opacity-85 animate-pulse">{TREASURE_FETCHING_SESSION}</p>
            )}

            {envelope.status === 'draft' && user && magicEmailNorm && claimPhase === 'claiming' && (
              <p className="text-sm animate-pulse opacity-95">{CLAIM_LOADING_MESSAGE}</p>
            )}

            {envelope.status === 'draft' && claimPhase === 'err' && (
              <div className="rounded-xl bg-red-900/40 border border-red-500/50 p-4 text-sm space-y-3 text-left">
                <p>
                  {claimErrCode === 'reserved_email_mismatch'
                    ? CLAIM_ERROR_WRONG_EMAIL
                    : claimErrCode === 'already_claimed'
                      ? CLAIM_ERROR_ALREADY_CLAIMED
                      : claimErrCode === 'network'
                        ? CLAIM_ERROR_NETWORK
                        : CLAIM_GENERIC_ERR}
                </p>
                <button
                  type="button"
                  className="underline font-semibold text-white"
                  onClick={() => {
                    claimAttemptedForEmailRef.current = null;
                    setClaimPhase('idle');
                  }}
                >
                  {TREASURE_RETRY_CLAIM}
                </button>
              </div>
            )}

            {showClaimedFootnote && (
              <p className="text-sm italic opacity-85 border border-white/15 rounded-xl p-4 bg-black/25">
                {CLAIMED_PUBLIC_FOOTNOTE}
              </p>
            )}

            {isClaimant === true && envelope.status === 'claimed' && (
              <div className="space-y-4 pt-2 pb-8">
                <div className="rounded-xl bg-black/50 border border-amber-400/35 backdrop-blur-md p-4 text-sm text-left leading-relaxed">
                  {CLAIM_SELF_BANNER}
                </div>
                <button
                  type="button"
                  onClick={onContinueLaunch}
                  className="custom-buy-button w-full py-4 rounded-xl font-bold text-lg shadow-lg"
                >
                  {CONTINUE_LAUNCH_SETUP}
                </button>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}
