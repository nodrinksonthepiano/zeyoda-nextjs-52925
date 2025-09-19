import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface ArtistRegistryRow {
  id: string;
  token: string;
  swap: string;
  downloads: string;
  treasury_wallet: string;
  updated_at: string;
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function GET(request: NextRequest) {
  try {
    console.log('📋 Registry API: Fetching artist contract addresses...');
    
    // Fetch from artist_registry table with flexible column naming
    const { data: registryData, error: registryError } = await supabaseAdmin
      .from('artist_registry')
      .select('id, token, swap, downloads, treasury_wallet, deployed_at')
      .order('id');
    
    if (registryError) {
      console.error('❌ Registry fetch error:', registryError);
      return NextResponse.json({ 
        error: 'Failed to fetch registry',
        details: registryError.message
      }, { status: 500 });
    }
    
    console.log(`📊 Found ${registryData?.length || 0} artists in registry`);
    
    // Normalize and validate data
    const normalizedArtists: ArtistRegistryRow[] = [];
    const excludedArtists: { id: string; reason: string }[] = [];
    
    for (const row of registryData || []) {
      try {
        // Flexible column naming - accept both formats
        const token = row.token || row.token_contract;
        const swap = row.swap || row.swap_contract;
        const downloads = row.downloads || row.download_contract;
        const treasury_wallet = row.treasury_wallet;
        
        // Validate required fields
        if (!token || !swap || !downloads) {
          excludedArtists.push({
            id: row.id,
            reason: `Missing required fields: token=${!!token}, swap=${!!swap}, downloads=${!!downloads}`
          });
          continue;
        }
        
        // Validate address format (42 chars, starts with 0x)
        const addresses = { token, swap, downloads, treasury_wallet };
        let invalidAddress = false;
        
        for (const [field, addr] of Object.entries(addresses)) {
          if (addr && (typeof addr !== 'string' || addr.length !== 42 || !addr.startsWith('0x'))) {
            excludedArtists.push({
              id: row.id,
              reason: `Invalid ${field} address: ${addr}`
            });
            invalidAddress = true;
            break;
          }
        }
        
        if (invalidAddress) continue;
        
        // Normalize addresses (lowercase for storage, checksum for return)
        const normalizedArtist: ArtistRegistryRow = {
          id: row.id,
          token: ethers.getAddress(token), // Checksum format
          swap: ethers.getAddress(swap),
          downloads: ethers.getAddress(downloads),
          treasury_wallet: treasury_wallet ? ethers.getAddress(treasury_wallet) : '',
          updated_at: row.deployed_at || new Date().toISOString()
        };
        
        normalizedArtists.push(normalizedArtist);
        
        console.log(`✅ ${row.id}: token=${token.slice(0,8)}..., swap=${swap.slice(0,8)}..., downloads=${downloads.slice(0,8)}...`);
        
      } catch (normalizationError: any) {
        excludedArtists.push({
          id: row.id,
          reason: `Normalization failed: ${normalizationError.message}`
        });
      }
    }
    
    // Log any excluded artists
    if (excludedArtists.length > 0) {
      console.warn('⚠️ Excluded artists:', excludedArtists);
    }
    
    const response = {
      version: 1,
      updatedAt: new Date().toISOString(),
      artists: normalizedArtists,
      excluded: excludedArtists.length > 0 ? excludedArtists : undefined
    };
    
    console.log(`📋 Registry API returning ${normalizedArtists.length} artists`);
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 's-maxage=30, stale-while-revalidate=30',
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error: any) {
    console.error('❌ Registry API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.stack
    }, { status: 500 });
  }
}
