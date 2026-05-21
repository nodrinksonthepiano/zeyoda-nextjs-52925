'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { InviteResolveTreasureBody, TreasureResolveDTO } from '@/types/treasure-invite';

import type { ArtistAsset } from '@/app/hooks/useArtistAssets';
import OvalGlowBackdrop from '@/app/components/OvalGlowBackdrop';
import OrbitPeekCarousel from '@/app/components/OrbitPeekCarousel';
import ThemeOrbitRenderer from '@/app/components/ThemeOrbitRenderer';
import ArtistPortalTitle from '@/app/components/ArtistPortalTitle';
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
  TREASURE_ACCESS_HEADLINE,
  TREASURE_CLAIMED_ACCESS_HEADLINE,
  TREASURE_CLAIMED_EMAIL_PLACEHOLDER,
  TREASURE_CLAIMED_LOGIN_LEAD,
  TREASURE_CLAIMED_PRIMARY_CTA,
  TREASURE_CLUE_EMAIL_LABEL,
  TREASURE_CLUE_PLACEHOLDER,
  TREASURE_CLUE_SUBMIT_LABEL,
  TREASURE_EMAIL_PLACEHOLDER,
  TREASURE_FETCHING_SESSION,
  TREASURE_HERO_PLACEHOLDER,
  TREASURE_LOGIN_LEAD,
  TREASURE_RETRY_CLAIM,
  TREASURE_SENDING_CODE,
  TREASURE_SIGN_OUT_USE_OTHER_EMAIL,
  TREASURE_USE_DIFFERENT_EMAIL,
  TREASURE_WRONG_ACCOUNT_HEADLINE,
  TREASURE_WRONG_ACCOUNT_LEAD,
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
import { useCosmicStardust } from '@/app/hooks/useCosmicStardust';

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
    const labelBase = treasure.artworktitle ?? treasure.displayname;
    const yr = treasure.artworkyear;
    const hasYear = yr !== undefined && yr !== null && yr !== '';
    const labelYear = hasYear ? `${labelBase} · ${yr}` : labelBase;
    const rawDesc = typeof treasure.description === 'string' ? treasure.description.trim() : '';
    const asset: ArtistAsset = {
      id: `treasure-${envelope.coin_public_id}`,
      artistId: stubConfig.name,
      assetNumber: 0,
      url: heroResolved.url,
      type: heroResolved.kind,
      title: labelYear,
    };
    if (rawDesc) {
      asset.metadata = { description: rawDesc };
    }
    return [asset];
  }, [
    heroResolved,
    envelope.coin_public_id,
    stubConfig.name,
    treasure.artworktitle,
    treasure.displayname,
    treasure.artworkyear,
    treasure.description,
  ]);

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
  const [showClueInput, setShowClueInput] = useState(false);
  const [clueMessage, setClueMessage] = useState('');
  const treasureEmailInputRef = useRef<HTMLInputElement>(null);

  const giftAllArtistsConfig = useMemo(
    () => ({ [stubConfig.name]: stubConfig }),
    [stubConfig],
  );

  const treasureOrbitCoin = useMemo(
    () => [
      {
        coinPublicId: envelope.coin_public_id,
        label:
          treasure.displayname?.trim() ||
          treasure.tokenName?.trim() ||
          envelope.coin_public_id.slice(0, 8),
        theme: treasure.theme ?? null,
      },
    ],
    [envelope.coin_public_id, treasure.tokenName, treasure.displayname, treasure.theme],
  );

  useEffect(() => {
    applyArtistBackground(stubConfig);
  }, [stubConfig]);

  useCosmicStardust(stubConfig.theme.stardust === true);

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

  const checkWhitelist = useCallback(
    async (emailToCheck: string, clue?: string) => {
      const response = await authenticatedFetch(
        '/api/checkWhitelist',
        {
          method: 'POST',
          body: JSON.stringify({ email: emailToCheck, ...(clue ? { clue } : {}) }),
        },
        getDidToken,
        true,
      );
      const data = (await response.json().catch(() => ({}))) as { isWhitelisted?: boolean };
      return { ok: response.ok, data };
    },
    [getDidToken],
  );

  const loginFlow = async () => {
    if (!magic || !loginEmail.trim()) return;
    setBusyLogin(true);
    try {
      const { ok, data: wl } = await checkWhitelist(loginEmail.trim());
      if (!ok) {
        showToast(TOAST_LOGIN_FAILED, 'error');
        return;
      }
      if (!wl?.isWhitelisted) {
        setShowClueInput(true);
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

  const submitClueGuest = async () => {
    if (!loginEmail.trim()) {
      showToast('Please enter an email first.', 'error');
      return;
    }
    if (!clueMessage.trim()) {
      showToast('Please enter a clue message.', 'error');
      return;
    }
    setBusyLogin(true);
    try {
      const { ok } = await checkWhitelist(loginEmail.trim(), clueMessage.trim());
      if (!ok) {
        showToast(CLAIM_ERROR_NETWORK, 'error');
        return;
      }
      setShowClueInput(false);
      setClueMessage('');
      showToast('Thank you! Keep looking out for treasure… 🏴‍☠️', 'success');
    } catch {
      showToast(CLAIM_ERROR_NETWORK, 'error');
    } finally {
      setBusyLogin(false);
    }
  };

  const submitClueWrongUser = async () => {
    if (!magicEmailNorm) return;
    if (!clueMessage.trim()) {
      showToast('Please enter a clue message.', 'error');
      return;
    }
    setBusyLogin(true);
    try {
      const { ok } = await checkWhitelist(magicEmailNorm, clueMessage.trim());
      if (!ok) {
        showToast(CLAIM_ERROR_NETWORK, 'error');
        return;
      }
      setClueMessage('');
      showToast('Thank you! Keep looking out for treasure… 🏴‍☠️', 'success');
    } catch {
      showToast(CLAIM_ERROR_NETWORK, 'error');
    } finally {
      setBusyLogin(false);
    }
  };

  const handleTreasureSignOut = async () => {
    if (!magic) return;
    try {
      await magic.user.logout();
    } catch {
      /* still try to reload */
    }
    try {
      localStorage.removeItem('zeyodaUserEmail');
    } catch {
      /* non-fatal */
    }
    window.location.reload();
  };

  /** Same UX as PurchaseFlow when logged out: shake login-prompts + unified strip, scroll/focus email. */
  function handleClaimTreasureClick() {
    if (busyLogin) return;
    if (showClueInput) {
      void submitClueGuest();
      return;
    }
    if (!loginEmail.trim()) {
      setClaimCtaShake(true);
      setTimeout(() => setClaimCtaShake(false), 500);
      const loginContainer = document.getElementById('login-prompts-container');
      if (loginContainer) {
        loginContainer.classList.add('shake');
        setTimeout(() => loginContainer.classList.remove('shake'), 500);
      }
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

  /** Logged in as Magic user who is not the coin claimant (after /api/invite/me-state). */
  const isWrongAccountOnClaimed =
    envelope.status === 'claimed' && Boolean(user) && isClaimant === false;

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
        {/* z-0: halo shadow bleeds past the hero box; keep this subtree below the claim/login chassis */}
        <div className="text-center relative z-0">
          <ArtistPortalTitle
            fontFamily={stubConfig.theme.fontFamily}
            color={stubConfig.theme.accentColor}
            title={
              treasure.tokenName
                ? `${treasure.displayname} — ${treasure.tokenName}`
                : treasure.displayname
            }
          >
            {treasure.displayname}
          </ArtistPortalTitle>

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
                  supplementalDraftOrbitTokens={treasureOrbitCoin}
                  onSupplementalDraftClick={() => {}}
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
                  supplementalDraftOrbitTokens={treasureOrbitCoin}
                  onSupplementalDraftClick={() => {}}
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

        <div className="action-section relative z-10 text-center mb-4 w-full max-w-lg mx-auto px-1 space-y-5">
            {!heroCarousel && treasure.artworktitle && (
              <p className="text-sm opacity-85">
                {treasure.artworktitle}
                {treasure.artworkyear != null ? ` · ${treasure.artworkyear}` : ''}
              </p>
            )}

            {!heroCarousel && treasure.description && (
              <p className="text-sm leading-relaxed opacity-90 whitespace-pre-wrap">{treasure.description}</p>
            )}

            {!user && (envelope.status === 'draft' || envelope.status === 'claimed') && (
              <>
                <div className="my-4 w-full max-w-md mx-auto">
                  <button
                    type="button"
                    onClick={handleClaimTreasureClick}
                    disabled={busyLogin}
                    className="custom-buy-button treasure-claim-cta w-full text-lg disabled:opacity-70 min-h-[44px]"
                  >
                    {busyLogin ? TREASURE_SENDING_CODE : envelope.status === 'draft' ? CLAIM_CTA_LABEL : TREASURE_CLAIMED_PRIMARY_CTA}
                  </button>
                </div>
                <div id="login-prompts-container" className="login-prompts mt-6">
                  <h3 id="accessHeadline" className="access-headline">
                    {envelope.status === 'draft'
                      ? TREASURE_ACCESS_HEADLINE
                      : TREASURE_CLAIMED_ACCESS_HEADLINE}
                  </h3>
                  <p className="text-sm mt-3 leading-relaxed opacity-95 max-w-md mx-auto">
                    {envelope.status === 'draft' ? TREASURE_LOGIN_LEAD : TREASURE_CLAIMED_LOGIN_LEAD}
                  </p>
                  <div className="social-login-container mt-3">
                    <p className="login-separator">or continue with</p>
                    <div className="social-buttons">
                      <button
                        type="button"
                        className="login-btn twitter"
                        onClick={() => alert('Twitter login coming soon!')}
                      >
                        X (Twitter)
                      </button>
                      <button
                        type="button"
                        className="login-btn gmail"
                        onClick={() => alert('Gmail login coming soon!')}
                      >
                        Gmail
                      </button>
                      <button
                        type="button"
                        className="login-btn phone"
                        onClick={() => alert('Phone login coming soon!')}
                      >
                        Phone
                      </button>
                      <button
                        type="button"
                        className="login-btn facebook"
                        onClick={() => alert('Facebook login coming soon!')}
                      >
                        Facebook
                      </button>
                    </div>
                  </div>
                </div>
                {envelope.status === 'claimed' && (
                  <p className="text-sm italic opacity-85 border border-white/15 rounded-xl p-4 bg-black/25 max-w-md mx-auto">
                    {CLAIMED_PUBLIC_FOOTNOTE}
                  </p>
                )}
              </>
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

            {isWrongAccountOnClaimed && (
              <div className="rounded-xl bg-black/40 border border-amber-400/30 backdrop-blur-md p-4 text-sm text-left space-y-3 max-w-lg mx-auto">
                <p className="font-semibold text-white">{TREASURE_WRONG_ACCOUNT_HEADLINE}</p>
                <p className="opacity-90 leading-relaxed">{TREASURE_WRONG_ACCOUNT_LEAD}</p>
                <button
                  type="button"
                  onClick={() => void handleTreasureSignOut()}
                  className="w-full font-bold py-3 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-white border border-white/15 transition"
                >
                  {TREASURE_SIGN_OUT_USE_OTHER_EMAIL}
                </button>
                <p className="text-xs italic opacity-80 pt-1 border-t border-white/10">
                  {CLAIMED_PUBLIC_FOOTNOTE}
                </p>
              </div>
            )}

            {isClaimant === true && envelope.status === 'claimed' && (
              <div className="space-y-4 pt-2 pb-8">
                <div className="rounded-xl bg-black/50 border border-amber-400/35 backdrop-blur-md p-4 text-sm text-left leading-relaxed">
                  {CLAIM_SELF_BANNER}
                </div>
                <button
                  type="button"
                  onClick={onContinueLaunch}
                  className="custom-buy-button treasure-claim-cta w-full py-4 rounded-xl font-bold text-lg shadow-lg"
                >
                  {CONTINUE_LAUNCH_SETUP}
                </button>
              </div>
            )}
        </div>

        {!user && (
          <div
            className={`unified-input-container relative z-10 mock-ui-section p-4 border-t-2 border-gray-700 mt-8 ${claimCtaShake ? 'shake' : ''}`}
          >
            <div className="flex flex-col items-center max-w-xl mx-auto gap-3">
              {showClueInput && (
                <div className="w-full text-left space-y-2">
                  <p className="text-xs text-gray-400">
                    {TREASURE_CLUE_EMAIL_LABEL}{' '}
                    <span className="text-white font-medium break-all">{loginEmail.trim() || '—'}</span>
                  </p>
                  <button
                    type="button"
                    className="text-xs text-amber-400/95 underline hover:text-amber-300"
                    onClick={() => {
                      setShowClueInput(false);
                      setClueMessage('');
                      const el = treasureEmailInputRef.current;
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => el.focus(), 150);
                      }
                    }}
                  >
                    {TREASURE_USE_DIFFERENT_EMAIL}
                  </button>
                </div>
              )}
              <div className="flex items-center w-full chat-input-container relative">
                <input
                  ref={treasureEmailInputRef}
                  type={showClueInput ? 'text' : 'email'}
                  value={showClueInput ? clueMessage : loginEmail}
                  placeholder={
                    showClueInput
                      ? TREASURE_CLUE_PLACEHOLDER
                      : envelope.status === 'claimed'
                        ? TREASURE_CLAIMED_EMAIL_PLACEHOLDER
                        : TREASURE_EMAIL_PLACEHOLDER
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (showClueInput) setClueMessage(v);
                    else setLoginEmail(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleClaimTreasureClick();
                    }
                  }}
                  className="flex-grow p-3 border border-gray-600 rounded-l-lg bg-gray-900 bg-opacity-70 text-white focus:ring-accentColor focus:border-accentColor backdrop-blur-sm"
                  autoComplete={showClueInput ? 'off' : 'email'}
                  inputMode={showClueInput ? 'text' : 'email'}
                  aria-label={showClueInput ? 'Clue input' : 'Email address input'}
                />
                <button
                  type="button"
                  onClick={handleClaimTreasureClick}
                  disabled={busyLogin}
                  className="p-3 bg-accentColor text-white rounded-r-lg hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-opacity-50 disabled:opacity-70"
                >
                  {busyLogin
                    ? TREASURE_SENDING_CODE
                    : showClueInput
                      ? TREASURE_CLUE_SUBMIT_LABEL
                      : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isWrongAccountOnClaimed && (
          <div className="unified-input-container relative z-10 mock-ui-section p-4 border-t-2 border-gray-700 mt-4">
            <div className="flex flex-col items-center max-w-xl mx-auto gap-3 w-full">
              {!magicEmailNorm && (
                <p className="text-xs opacity-85 animate-pulse text-center">{TREASURE_FETCHING_SESSION}</p>
              )}
              {magicEmailNorm ? (
                <>
                  <p className="text-xs text-gray-400 w-full text-left">
                    {TREASURE_CLUE_EMAIL_LABEL}{' '}
                    <span className="text-white font-medium break-all">{magicEmailNorm}</span>
                  </p>
                  <div className="flex items-center w-full chat-input-container relative">
                    <input
                      type="text"
                      value={clueMessage}
                      placeholder={TREASURE_CLUE_PLACEHOLDER}
                      onChange={(e) => setClueMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void submitClueWrongUser();
                        }
                      }}
                      className="flex-grow p-3 border border-gray-600 rounded-l-lg bg-gray-900 bg-opacity-70 text-white focus:ring-accentColor focus:border-accentColor backdrop-blur-sm"
                      autoComplete="off"
                      aria-label="Clue input for wrong account"
                    />
                    <button
                      type="button"
                      onClick={() => void submitClueWrongUser()}
                      disabled={busyLogin || !magicEmailNorm}
                      className="p-3 bg-accentColor text-white rounded-r-lg hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-opacity-50 disabled:opacity-70"
                    >
                      {busyLogin ? TREASURE_SENDING_CODE : TREASURE_CLUE_SUBMIT_LABEL}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
