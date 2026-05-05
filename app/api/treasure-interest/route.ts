import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MAX_SOURCE_URL_LEN = 2000;

function isValidEmail(val: string): boolean {
  const t = val.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

interface InterestBody {
  input_value?: string;
  artist_slug_attempted?: string | null;
}

/** Public burial path: persist interest rows (single email field MVP). */
export async function POST(request: NextRequest) {
  try {
    let body: InterestBody;
    try {
      body = (await request.json()) as InterestBody;
    } catch {
      return NextResponse.json({ error: 'invalid_body', message: 'Invalid JSON' }, { status: 400 });
    }

    const raw = body.input_value;
    if (!raw || typeof raw !== 'string' || !isValidEmail(raw)) {
      return NextResponse.json(
        { error: 'invalid_email', message: 'A valid email is required.' },
        { status: 400 },
      );
    }

    let sourceUrl =
      typeof request.headers.get === 'function' ? request.nextUrl.pathname + request.nextUrl.search : '';
    try {
      const ref = request.headers.get('referer');
      if (ref) sourceUrl = ref.slice(0, MAX_SOURCE_URL_LEN);
    } catch {
      sourceUrl = sourceUrl.slice(0, MAX_SOURCE_URL_LEN);
    }

    let pageUrlFallback = '';
    try {
      pageUrlFallback = `${request.nextUrl.pathname}${request.nextUrl.search || ''}`;
    } catch {
      pageUrlFallback = '';
    }

    sourceUrl =
      sourceUrl.trim().slice(0, MAX_SOURCE_URL_LEN) ||
      pageUrlFallback.slice(0, MAX_SOURCE_URL_LEN) ||
      null;

    const artistSlugAttempted =
      typeof body.artist_slug_attempted === 'string'
        ? body.artist_slug_attempted.trim().slice(0, 256)
        : null;

    const { error } = await supabaseAdmin.from('treasure_interest').insert({
      input_value: raw.trim().toLowerCase(),
      artist_slug_attempted: artistSlugAttempted,
      source_url: sourceUrl || null,
      user_agent: request.headers.get('user-agent')?.slice(0, 1024) || null,
      referrer: request.headers.get('referer')?.slice(0, MAX_SOURCE_URL_LEN) || null,
    });

    if (error) {
      console.error('treasure-interest insert:', error);
      return NextResponse.json(
        { error: 'database_error', message: 'Could not save' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('treasure-interest exception:', e);
    return NextResponse.json({ error: 'internal_error', message: 'Internal error' }, { status: 500 });
  }
}
