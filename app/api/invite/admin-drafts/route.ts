import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyInviteAdmin } from '@/app/utils/server/verifyInviteAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function httpsOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.startsWith('https://') ? t : null;
}

function carveTheme(draft_payload: unknown): {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
} | null {
  if (!draft_payload || typeof draft_payload !== 'object') return null;
  const o = draft_payload as Record<string, unknown>;
  const t = o.theme;
  if (!t || typeof t !== 'object') return null;
  const th = t as Record<string, unknown>;
  const primaryColor =
    typeof th.primaryColor === 'string' && th.primaryColor.trim() ? th.primaryColor.trim() : null;
  const accentColor =
    typeof th.accentColor === 'string' && th.accentColor.trim() ? th.accentColor.trim() : null;
  const fontFamily =
    typeof th.fontFamily === 'string' && th.fontFamily.trim() ? th.fontFamily.trim() : null;
  if (!primaryColor || !accentColor || !fontFamily) return null;
  return { primaryColor, accentColor, fontFamily };
}

function carvePayload(
  draft_payload: unknown,
): {
  displayname: string | null;
  tokenName: string | null;
  logo_url: string | null;
  featured_asset_url: string | null;
  theme: ReturnType<typeof carveTheme>;
} {
  if (!draft_payload || typeof draft_payload !== 'object') {
    return {
      displayname: null,
      tokenName: null,
      logo_url: null,
      featured_asset_url: null,
      theme: null,
    };
  }
  const o = draft_payload as Record<string, unknown>;
  const displayname = typeof o.displayname === 'string' ? o.displayname.trim() || null : null;
  const tokenName = typeof o.tokenName === 'string' ? o.tokenName.trim() || null : null;
  return {
    displayname,
    tokenName,
    logo_url: httpsOrNull(o.logo_url),
    featured_asset_url: httpsOrNull(o.featured_asset_url),
    theme: carveTheme(draft_payload),
  };
}

/** Admin-only list of draft invites (safe fields only). */
export async function GET(request: NextRequest) {
  const adminGate = await verifyInviteAdmin(request);
  if (adminGate instanceof NextResponse) return adminGate;

  const { data: rows, error } = await supabaseAdmin
    .from('artist_invites')
    .select('coin_public_id, artist_slug, status, draft_payload, updated_at')
    .eq('status', 'draft')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('admin-drafts fetch:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  const drafts = (rows ?? []).map((row) => {
    const carved = carvePayload(row.draft_payload);
    return {
      coin_public_id: row.coin_public_id as string,
      artist_slug: row.artist_slug as string,
      status: 'draft' as const,
      updated_at: row.updated_at as string,
      displayname: carved.displayname,
      tokenName: carved.tokenName,
      logo_url: carved.logo_url,
      featured_asset_url: carved.featured_asset_url,
      theme: carved.theme,
    };
  });

  return NextResponse.json({ drafts });
}
