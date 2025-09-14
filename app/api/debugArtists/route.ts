import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    console.log('🔍 Debugging artists table...');
    
    // Test the exact query that useArtistConfig uses
    const { data: artistsData, error: dbError } = await supabase
      .from('artists')
      .select('*');
    
    if (dbError) {
      console.error('❌ Supabase query error:', dbError);
      return NextResponse.json({ 
        error: 'Supabase query failed',
        details: dbError.message,
        code: dbError.code
      }, { status: 500 });
    }
    
    console.log('✅ Artists data loaded:', artistsData?.length, 'records');
    
    // Check each artist record for issues
    const issues = [];
    if (artistsData) {
      for (const artist of artistsData) {
        // Check for required fields
        if (!artist.id) issues.push(`${artist.name || 'Unknown'}: Missing id`);
        if (!artist.name) issues.push(`${artist.id || 'Unknown'}: Missing name`);
        if (!artist.tokenName) issues.push(`${artist.id}: Missing tokenName`);
        
        // Check theme format
        if (artist.theme && typeof artist.theme === 'string') {
          try {
            JSON.parse(artist.theme);
          } catch (e) {
            issues.push(`${artist.id}: Invalid theme JSON`);
          }
        }
        
        // Check orbital tokens format
        if (artist.orbitaltokens && typeof artist.orbitaltokens === 'string') {
          try {
            JSON.parse(artist.orbitaltokens);
          } catch (e) {
            issues.push(`${artist.id}: Invalid orbitaltokens JSON`);
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      recordCount: artistsData?.length || 0,
      artists: artistsData?.map(a => ({
        id: a.id,
        name: a.name,
        tokenName: a.tokenName,
        hasTheme: !!a.theme,
        hasOrbitalTokens: !!a.orbitaltokens,
        contract: a.contract
      })),
      issues: issues,
      message: issues.length === 0 ? 'All records look good!' : `Found ${issues.length} issues`
    });
    
  } catch (error: any) {
    console.error('❌ Debug API error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
