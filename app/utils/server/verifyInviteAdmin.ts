import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMagicEmailFromBearer } from './magicBearerEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Gosheesh / protocol: Magic Bearer must map to whitelist_emails.role === 'admin'.
 * Email lookup is lowercased to reduce casing drift vs Magic / Supabase rows.
 */
export async function verifyInviteAdmin(
  request: NextRequest
): Promise<{ email: string } | NextResponse> {
  const email = await getMagicEmailFromBearer(request);
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized', message: 'Invalid or missing token' }, { status: 401 });
  }

  const { data, error } = await serviceSupabase
    .from('whitelist_emails')
    .select('email, role')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('verifyInviteAdmin whitelist lookup:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!data || data.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden', message: 'Admin only' }, { status: 403 });
  }

  return { email };
}
