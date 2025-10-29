import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    const artistData = await request.json();
    console.log('🎨 Creating artist via API:', artistData.name);

    // Save to artists table with service role permissions
    // Using EXACT column names from schema
    const artistRecord = {
      id: artistData.id,
      name: artistData.name,
      displayname: artistData.displayname,
      "tokenName": artistData.tokenName || artistData.name, // Quoted to preserve capital N
      artworktitle: artistData.artworktitle,
      artworkyear: artistData.artworkyear,
      tokenprice: artistData.downloadPrice || 1,
      videosrc: artistData.contentUrl,
      contract: artistData.tokenAddress,
      download_address: artistData.downloadsAddress,
      swap_address: artistData.poolAddress,
      treasury_wallet: artistData.treasuryWallet,
      theme: {
        primaryColor: artistData.primaryColor,
        accentColor: artistData.accentColor,
        gradientStart: artistData.gradientStart,
        gradientMiddle: artistData.gradientMiddle,
        gradientEnd: artistData.gradientEnd,
        fontFamily: artistData.fontFamily
      },
      orbitaltokens: artistData.orbitaltokens || [],
      paused: false
    };

    const { data: artistResult, error: artistError } = await supabaseAdmin
      .from('artists')
      .insert([artistRecord])
      .select();

    if (artistError) {
      console.error('❌ Artist table error:', artistError);
      return NextResponse.json(
        { error: `Failed to save artist: ${artistError.message}` },
        { status: 500 }
      );
    }

    // Save to artist_registry table
    const registryRecord = {
      id: artistData.id,
      token: artistData.tokenAddress,
      downloads: artistData.downloadsAddress,
      swap: artistData.poolAddress,
      treasury_wallet: artistData.treasuryWallet
    };

    const { data: registryResult, error: registryError } = await supabaseAdmin
      .from('artist_registry')
      .insert([registryRecord])
      .select();

    if (registryError) {
      console.warn('⚠️ Registry table error:', registryError);
      // Don't fail the whole operation if registry fails
    }

    console.log('✅ Artist created successfully:', artistData.name);
    
    return NextResponse.json({
      success: true,
      artist: artistResult?.[0],
      registry: registryResult?.[0],
      message: `${artistData.name} created successfully!`
    });

  } catch (error: any) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

