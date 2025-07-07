import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { supabase } from '@/app/utils/supabaseClient';
import { getArtistContractsFromServer } from '@/app/utils/server/artistRegistry';

// --- Constants ---
const ERC1155_ABI = ["function balanceOf(address owner, uint256 id) view returns (uint256)"];
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

// --- Environment Variables ---
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
if (!process.env.BASE_SEPOLIA_RPC_URL) {
  console.warn("BASE_SEPOLIA_RPC_URL not set, using default public RPC.");
}

// --- Provider ---
const provider = new ethers.JsonRpcProvider(RPC_URL);

// --- In-memory cache for rate limiting ---
const verificationCache = new Map<string, { timestamp: number }>();
const CACHE_DURATION_MS = 60 * 1000; // 60 seconds

// --- Helper Functions ---
const maskAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const incrementDownloadCount = async (artistId: string, assetNumber: number) => {
  try {
    await supabase.rpc('increment_download_count', {
      p_artist_id: artistId,
      p_asset_number: assetNumber,
    });
  } catch (error) {
    console.warn(`Failed to increment download count for ${artistId}#${assetNumber}:`, error);
  }
};

// --- Main Route Handler ---
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { artistId, assetNumber, userAddress } = body;

  // 1. Basic Input Validation
  if (!artistId || !assetNumber || !userAddress) {
    return NextResponse.json({ error: 'Missing required parameters: artistId, assetNumber, userAddress' }, { status: 400 });
  }

  if (!ethers.isAddress(userAddress)) {
    console.log(`❌ Invalid address format for ${userAddress}`);
    return NextResponse.json({ error: 'malformed user address' }, { status: 400 });
  }

  const maskedAddr = maskAddress(userAddress);
  const cacheKey = `${userAddress}-${artistId}-${assetNumber}`;

  // 2. Check Rate-Limiting Cache
  const cached = verificationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    console.log(`CACHE HIT for ${maskedAddr} on ${artistId}#${assetNumber}`);
    // If cache is hit, we assume ownership and proceed, but this means we need to get the file path again
  } else {
    // 3. On-Chain Verification
    try {
      const artistContracts = await getArtistContractsFromServer(artistId);
      if (!artistContracts?.downloads) {
        return NextResponse.json({ error: `Configuration for artist ${artistId} missing downloads contract` }, { status: 404 });
      }

      const contract = new ethers.Contract(artistContracts.downloads, ERC1155_ABI, provider);
      const balance = await contract.balanceOf(userAddress, assetNumber);

      if (balance === 0n) {
        console.log(`❌ Ownership check failed (balance 0) for ${maskedAddr} on ${artistId}#${assetNumber}`);
        return NextResponse.json({ error: 'asset not owned' }, { status: 403 });
      }

      // If successful, update the cache
      verificationCache.set(cacheKey, { timestamp: Date.now() });

    } catch (error: any) {
      console.error(`❌ RPC/Contract error for ${maskedAddr} on ${artistId}#${assetNumber}:`, error.message);
      return NextResponse.json({ error: error.reason || 'Contract query failed' }, { status: 502 });
    }
  }

  // 4. Generate Signed URL (Success Path)
  try {
    const { data: asset, error: dbError } = await supabase
      .from('artist_assets')
      .select('file_url')
      .eq('artist_id', artistId)
      .eq('asset_number', assetNumber)
      .single();

    if (dbError || !asset) {
      return NextResponse.json({ error: 'Asset not found in database' }, { status: 404 });
    }
    
    // The storage path is derived from the file_url, assuming a consistent structure
    const storagePath = asset.file_url.startsWith('/') ? asset.file_url.substring(1) : asset.file_url;

    const { data, error: signError } = await supabase.storage
      .from('artist-assets')
      .createSignedUrl(storagePath, SEVEN_DAYS_IN_SECONDS);

    if (signError) {
      throw signError;
    }

    // Fire-and-forget the download count increment
    incrementDownloadCount(artistId, assetNumber);
    
    console.log(`✅ ${maskedAddr} owns ${artistId} asset #${assetNumber} – signed URL generated`);

    const expiresAt = Math.floor(Date.now() / 1000) + SEVEN_DAYS_IN_SECONDS;

    return NextResponse.json({
      signedUrl: data.signedUrl,
      expiresAt: expiresAt,
    });

  } catch (error: any) {
    console.error('❌ Supabase error:', error.message);
    return NextResponse.json({ error: 'Failed to retrieve asset or create signed URL' }, { status: 500 });
  }
}

// Handle GET requests (for debugging)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist_id = searchParams.get('artist_id');
  const asset_number = searchParams.get('asset_number');
  const user_address = searchParams.get('user_address');
  
  if (!artist_id || !asset_number || !user_address) {
    return NextResponse.json(
      { error: 'Missing query parameters: artist_id, asset_number, user_address' },
      { status: 400 }
    );
  }
  
  // Call the POST handler with the same logic
  return POST(request);
} 