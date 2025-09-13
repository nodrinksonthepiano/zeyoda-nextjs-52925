import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL and service role key are required.');
}

const serviceSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  console.log('🔍 Whitelist check API called...');
  
  try {
    const { email, clue } = await request.json();
    console.log('📧 Checking whitelist for:', email);

    // 1. Check if email is whitelisted
    const { data: whitelistData, error: whitelistError } = await serviceSupabase
      .from('whitelist_emails')
      .select('email, role, used, notes')
      .eq('email', email)
      .single();

    if (whitelistError && whitelistError.code !== 'PGRST116') {
      console.error('❌ Whitelist check error:', whitelistError);
      throw new Error('Whitelist check failed');
    }

    const isWhitelisted = !!whitelistData;
    console.log(`${isWhitelisted ? '✅' : '❌'} Email ${email} ${isWhitelisted ? 'is' : 'is not'} whitelisted`);

    // 2. Log the attempt (whether whitelisted or not)
    const { error: logError } = await serviceSupabase
      .from('login_attempts')
      .insert([{
        email: email,
        whitelisted: isWhitelisted,
        clue: clue || null,
        timestamp: new Date().toISOString(),
        ip_address: request.headers.get('x-forwarded-for') || 'unknown'
      }]);

    if (logError) {
      console.warn('⚠️ Failed to log login attempt:', logError);
      // Don't throw - logging failure shouldn't block login
    }

    // 3. If not whitelisted and clue provided, update the whitelist record with clue
    if (!isWhitelisted && clue) {
      console.log('💎 Storing treasure clue for:', email);
      
      // Insert or update whitelist record with clue
      const { error: clueError } = await serviceSupabase
        .from('whitelist_emails')
        .upsert([{
          email: email,
          role: 'pending',
          used: false,
          notes: `CLUE: ${clue} | Submitted: ${new Date().toISOString()}`
        }], { onConflict: 'email' });

      if (clueError) {
        console.error('❌ Error storing clue:', clueError);
        // Don't throw - clue storage failure shouldn't block response
      }
    }

    // 4. Return result
    return NextResponse.json({
      isWhitelisted,
      email,
      role: whitelistData?.role || null,
      message: isWhitelisted 
        ? 'Access granted! 🏴‍☠️' 
        : 'You appear to be rare treasure! We need to dig you up...'
    });

  } catch (error: any) {
    console.error('❌ Whitelist API error:', error);
    return NextResponse.json({ 
      error: error.message,
      isWhitelisted: false 
    }, { status: 500 });
  }
}
