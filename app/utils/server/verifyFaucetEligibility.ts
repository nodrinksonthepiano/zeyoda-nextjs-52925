import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { normalizeReservedEmail } from '@/app/utils/server/normalizeReservedEmail';

export type FaucetEligibilitySource = 'whitelist' | 'invite';

export interface FaucetEligibilityResult {
  eligible: boolean;
  source: FaucetEligibilitySource | null;
  error: string | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServiceSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

/**
 * Server-side faucet gate: whitelist_emails OR claimed artist_invites with
 * email + wallet pair (post-claim only — draft invites do not pass).
 */
export async function verifyFaucetEligibility(
  emailRaw: string | null | undefined,
  walletRaw: string | null | undefined,
): Promise<FaucetEligibilityResult> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { eligible: false, source: null, error: 'Database not configured' };
  }

  if (!emailRaw || typeof emailRaw !== 'string' || !emailRaw.trim()) {
    return { eligible: false, source: null, error: 'No email on session' };
  }

  if (!walletRaw || typeof walletRaw !== 'string' || !walletRaw.trim()) {
    return { eligible: false, source: null, error: 'No wallet on session' };
  }

  const email = normalizeReservedEmail(emailRaw);
  const wallet = walletRaw.trim().toLowerCase();

  const { data: whitelistRow, error: whitelistError } = await supabase
    .from('whitelist_emails')
    .select('email')
    .eq('email', email)
    .maybeSingle();

  if (whitelistError) {
    console.error('[verifyFaucetEligibility] whitelist lookup:', whitelistError);
    return { eligible: false, source: null, error: 'Failed to verify eligibility' };
  }

  if (whitelistRow) {
    return { eligible: true, source: 'whitelist', error: null };
  }

  const { data: inviteRows, error: inviteError } = await supabase
    .from('artist_invites')
    .select('claimed_by_wallet')
    .in('status', ['claimed', 'launched'])
    .eq('claimed_by_email', email)
    .not('claimed_by_wallet', 'is', null);

  if (inviteError) {
    console.error('[verifyFaucetEligibility] invite lookup:', inviteError);
    return { eligible: false, source: null, error: 'Failed to verify eligibility' };
  }

  for (const row of inviteRows ?? []) {
    const inviteWallet =
      typeof row.claimed_by_wallet === 'string' ? row.claimed_by_wallet.trim().toLowerCase() : null;

    if (inviteWallet === wallet) {
      return { eligible: true, source: 'invite', error: null };
    }
  }

  return { eligible: false, source: null, error: 'Not eligible for faucet' };
}
