'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import BurialWizard from '@/app/components/BurialWizard';
import TreasureInviteShell from '@/app/components/TreasureInviteShell';
import useArtistConfig from '@/app/hooks/useArtistConfig';

import type { InviteResolveOkBody, InviteResolveTreasureBody } from '@/types/treasure-invite';
import {
  draftRecordFromTreasureEnvelope,
  persistInviteLaunchBundle,
  readInviteLaunchBundle,
  type InviteLaunchBridge,
} from '@/app/utils/inviteLaunchBridge';

type LiveProps = {
  inviteLaunchBridge?: InviteLaunchBridge | null;
};

type Props = {
  RenderLivePortal: React.ComponentType<LiveProps>;
};

function TreasureInviteOrLiveGate({
  slug,
  envelope,
  RenderLivePortal,
  onContinueLaunch,
  onInviteClaimedRefetch,
}: {
  slug: string;
  envelope: InviteResolveTreasureBody;
  RenderLivePortal: React.ComponentType<LiveProps>;
  onContinueLaunch: () => void;
  /** After successful auto-claim, refetches resolve JSON so envelope becomes claimed without full page reload. */
  onInviteClaimedRefetch?: () => Promise<void>;
}) {
  const { artistConfig, isLoading } = useArtistConfig(slug);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen text-white bg-black">Loading…</div>;
  }

  if (artistConfig) {
    return <RenderLivePortal />;
  }

  return (
    <TreasureInviteShell
      envelope={envelope}
      onContinueLaunch={onContinueLaunch}
      onInviteClaimedRefetch={onInviteClaimedRefetch}
    />
  );
}

export default function TreasureAwareHome({ RenderLivePortal }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const coin = searchParams.get('coin')?.trim() || '';
  const artistParam = searchParams.get('artist');

  const [warmClickBridge, setWarmClickBridge] = useState<InviteLaunchBridge | null>(null);

  const restoredBridge = useMemo((): InviteLaunchBridge | null => {
    if (typeof window === 'undefined') return null;
    const b = readInviteLaunchBundle();
    if (!b || b.coinPublicId !== coin) return null;
    return { coinPublicId: b.coinPublicId, draft: b.draft };
  }, [coin]);

  const effectiveBridge = warmClickBridge ?? restoredBridge ?? null;

  const [resolveBody, setResolveBody] = useState<InviteResolveOkBody | null>(null);
  const [resolveBusy, setResolveBusy] = useState(!effectiveBridge);
  const [resolveHttpError, setResolveHttpError] = useState(false);

  const applyResolveNavigation = useCallback(
    (body: InviteResolveOkBody) => {
      const status = body.status;

      if (status === 'draft' || status === 'claimed') {
        const canon = body.artist_slug;
        if (canon && artistParam !== canon) {
          const qs = new URLSearchParams(searchParams.toString());
          qs.set('artist', canon);
          qs.set('coin', coin);
          router.replace(`/?${qs.toString()}`, { scroll: false });
        }
      }

      if (status === 'launched') {
        const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
        if (url) {
          url.pathname = '/';
          url.hash = '';
          url.searchParams.set('artist', body.artist_slug);
          url.searchParams.delete('coin');
          router.replace(`${url.pathname}${url.search}`, { scroll: false });
        }
      }
    },
    [router, artistParam, searchParams, coin],
  );

  /** Silent refetch — avoids full-screen "Loading treasure" flash after claim. */
  const refetchInviteAfterClaim = useCallback(async (): Promise<void> => {
    if (!coin.trim()) return;
    try {
      const res = await fetch(`/api/invite/resolve?coin=${encodeURIComponent(coin)}`);
      const j = (await res.json()) as InviteResolveOkBody | { status?: string };
      if (!res.ok || (j as { status?: string }).status === 'error') return;
      const body = j as InviteResolveOkBody;
      setResolveBody(body);
      applyResolveNavigation(body);
    } catch {
      /* non-fatal */
    }
  }, [coin, applyResolveNavigation]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (effectiveBridge) {
        setResolveBusy(false);
        return;
      }

      setResolveBusy(true);
      setResolveHttpError(false);

      try {
        const res = await fetch(`/api/invite/resolve?coin=${encodeURIComponent(coin)}`);
        const j = (await res.json()) as InviteResolveOkBody | { status?: string };

        if (cancelled) return;

        if (!res.ok) {
          setResolveHttpError(true);
          setResolveBody(null);
          return;
        }

        if ((j as { status?: string }).status === 'error') {
          setResolveBody(null);
          setResolveHttpError(true);
          return;
        }

        const body = j as InviteResolveOkBody;
        setResolveBody(body);

        applyResolveNavigation(body);
      } catch {
        if (!cancelled) setResolveHttpError(true);
      } finally {
        if (!cancelled) setResolveBusy(false);
      }
    }

    if (coin && !effectiveBridge) void load();

    return () => {
      cancelled = true;
    };
  }, [coin, effectiveBridge, applyResolveNavigation]);

  if (!coin) return null;

  if (effectiveBridge) {
    return <RenderLivePortal inviteLaunchBridge={effectiveBridge} />;
  }

  if (resolveBusy) {
    return <div className="flex justify-center items-center min-h-screen text-white bg-black">Loading treasure…</div>;
  }

  if (
    resolveHttpError ||
    !resolveBody ||
    resolveBody.status === 'error' ||
    resolveBody.status === 'not_found'
  ) {
    return <BurialWizard artistSlugAttempted={artistParam} />;
  }

  if (resolveBody.status === 'revoked') {
    return <BurialWizard variant="revoked" artistSlugAttempted={artistParam} />;
  }

  if (resolveBody.status === 'launched') {
    return <RenderLivePortal />;
  }

  if (resolveBody.status === 'draft' || resolveBody.status === 'claimed') {
    const envelope = resolveBody;

    const onContinueLaunch = () => {
      const draft = draftRecordFromTreasureEnvelope(envelope);
      persistInviteLaunchBundle({
        coinPublicId: envelope.coin_public_id,
        artist_slug: envelope.artist_slug,
        draft,
      });
      setWarmClickBridge({ coinPublicId: envelope.coin_public_id, draft });
    };

    return (
      <TreasureInviteOrLiveGate
        slug={envelope.artist_slug}
        envelope={envelope}
        RenderLivePortal={RenderLivePortal}
        onContinueLaunch={onContinueLaunch}
        onInviteClaimedRefetch={refetchInviteAfterClaim}
      />
    );
  }

  return <BurialWizard artistSlugAttempted={artistParam} />;
}
