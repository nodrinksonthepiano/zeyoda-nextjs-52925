import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeReservedEmail } from '@/app/utils/server/normalizeReservedEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL and service role key are required.');
}

const serviceSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function inviteEmailMatchesReservedOrClaimed(
  invite: {
    status: string;
    reserved_email_normalized: string;
    claimed_by_email: string | null;
  },
  normalizedEmail: string,
): boolean {
  if (invite.reserved_email_normalized === normalizedEmail) {
    return true;
  }
  if (
    invite.status === 'claimed' &&
    typeof invite.claimed_by_email === 'string' &&
    normalizeReservedEmail(invite.claimed_by_email) === normalizedEmail
  ) {
    return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  console.log('🔍 Whitelist check API called...');

  try {
    const body = (await request.json()) as {
      email?: unknown;
      clue?: unknown;
      coin_public_id?: unknown;
    };
    const email = typeof body.email === 'string' ? body.email : '';
    const clue = typeof body.clue === 'string' ? body.clue : undefined;
    const coinPublicId =
      typeof body.coin_public_id === 'string' ? body.coin_public_id.trim() : '';

    console.log('📧 Checking whitelist for:', email, coinPublicId ? `(coin ${coinPublicId})` : '');

    const normalizedEmail = email ? normalizeReservedEmail(email) : '';

    // 1. Check if email is whitelisted
    const { data: whitelistData, error: whitelistError } = normalizedEmail
      ? await serviceSupabase
          .from('whitelist_emails')
          .select('email, role, used, notes')
          .eq('email', normalizedEmail)
          .single()
      : { data: null, error: { code: 'PGRST116' } as { code: string } };

    if (whitelistError && whitelistError.code !== 'PGRST116') {
      console.error('❌ Whitelist check error:', whitelistError);
      throw new Error('Whitelist check failed');
    }

    let isWhitelisted = !!whitelistData;

    // Allow Magic sessions for active treasure invites (reserved or claimed artist email),
    // even if they are not in whitelist_emails yet — claim API still enforces per-coin matching.
    if (!isWhitelisted && normalizedEmail) {
      if (coinPublicId) {
        const { data: inviteRow, error: inviteError } = await serviceSupabase
          .from('artist_invites')
          .select('id, status, reserved_email_normalized, claimed_by_email')
          .eq('coin_public_id', coinPublicId)
          .maybeSingle();

        if (inviteError) {
          console.error('❌ Treasure coin bypass lookup error:', inviteError);
        } else if (
          inviteRow &&
          (inviteRow.status === 'draft' || inviteRow.status === 'claimed') &&
          inviteEmailMatchesReservedOrClaimed(inviteRow, normalizedEmail)
        ) {
          isWhitelisted = true;
          console.log('✅ Treasure invite coin-scoped bypass for curated artist email session');
        }
      } else {
        const { data: draftRows, error: draftError } = await serviceSupabase
          .from('artist_invites')
          .select('id')
          .in('status', ['draft', 'claimed'])
          .eq('reserved_email_normalized', normalizedEmail)
          .limit(1);

        if (draftError) {
          console.error('❌ Treasure email bypass lookup error:', draftError);
        }

        let inviteBypassRow = draftRows?.[0] ?? null;

        if (!inviteBypassRow) {
          const { data: claimedRows, error: claimedError } = await serviceSupabase
            .from('artist_invites')
            .select('id')
            .eq('status', 'claimed')
            .eq('claimed_by_email', normalizedEmail)
            .limit(1);

          if (claimedError) {
            console.error('❌ Treasure claimed-email bypass lookup error:', claimedError);
          } else {
            inviteBypassRow = claimedRows?.[0] ?? null;
          }
        }

        if (inviteBypassRow) {
          isWhitelisted = true;
          console.log('✅ Treasure invite bypass for curated artist email session');
        }
      }
    }

    console.log(
      `${isWhitelisted ? '✅' : '❌'} Email ${normalizedEmail || email} ${isWhitelisted ? 'is' : 'is not'} whitelisted`,
    );

    // 2. Log the attempt (whether whitelisted or not)
    const { error: logError } = await serviceSupabase.from('login_attempts').insert([
      {
        email: normalizedEmail || email,
        whitelisted: isWhitelisted,
        clue: clue || null,
        timestamp: new Date().toISOString(),
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      },
    ]);

    if (logError) {
      console.warn('⚠️ Failed to log login attempt:', logError);
      // Don't throw - logging failure shouldn't block login
    }

    // 3. If not whitelisted and clue provided, update the whitelist record with clue
    if (!isWhitelisted && clue && normalizedEmail) {
      console.log('💎 Storing treasure clue for:', normalizedEmail);

      const { error: clueError } = await serviceSupabase.from('whitelist_emails').upsert(
        [
          {
            email: normalizedEmail,
            role: 'pending',
            used: false,
            notes: `CLUE: ${clue} | Submitted: ${new Date().toISOString()}`,
          },
        ],
        { onConflict: 'email' },
      );

      if (clueError) {
        console.error('❌ Error storing clue:', clueError);
        // Don't throw - clue storage failure shouldn't block response
      }
    }

    // 4. Return result
    return NextResponse.json({
      isWhitelisted,
      email: normalizedEmail || email,
      role: whitelistData?.role || null,
      message: isWhitelisted
        ? 'Access granted! 🏴‍☠️'
        : 'You appear to be rare treasure! We need to dig you up...',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Whitelist API error:', error);
    return NextResponse.json(
      {
        error: message,
        isWhitelisted: false,
      },
      { status: 500 },
    );
  }
}
