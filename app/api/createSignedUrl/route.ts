import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { supabase } from '../../utils/supabaseClient';
import { ARTIST_REGISTRY, getArtistContracts } from '../../utils/addressRegistry';

// ERC-1155 ABI for checking balances
const ERC1155_ABI = [
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function hasDownloadAccess(address user, uint256 assetId) view returns (bool)"
];

// RPC provider for contract calls
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC);

export async function POST(request: NextRequest) {
  try {
    const { artist_id, asset_number, user_address } = await request.json();
    
    // Validate required parameters
    if (!artist_id || !asset_number || !user_address) {
      return NextResponse.json(
        { error: 'Missing required parameters: artist_id, asset_number, user_address' },
        { status: 400 }
      );
    }
    
    // Validate artist exists in registry
    const artistContracts = getArtistContracts(artist_id) as any;
    if (!artistContracts || !artistContracts.download) {
      return NextResponse.json(
        { error: `Artist ${artist_id} not found or no download contract` },
        { status: 404 }
      );
    }
    
    // Validate Ethereum address
    if (!ethers.isAddress(user_address)) {
      return NextResponse.json(
        { error: 'Invalid user address' },
        { status: 400 }
      );
    }
    
    console.log(`🔍 Checking download access for ${user_address} to ${artist_id} asset ${asset_number}`);
    
    // Check if user owns the download token
    const downloadContract = new ethers.Contract(
      artistContracts.download,
      ERC1155_ABI,
      provider
    );
    
    const balance = await downloadContract.balanceOf(user_address, asset_number);
    const hasAccess = balance > 0;
    
    console.log(`📊 Balance check: ${balance.toString()}, Has access: ${hasAccess}`);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'User does not own download access to this asset' },
        { status: 403 }
      );
    }
    
    // Get asset info from database
    const { data: asset, error: assetError } = await supabase
      .from('artist_assets')
      .select('file_url, file_type, metadata, download_count')
      .eq('artist_id', artist_id)
      .eq('asset_number', asset_number)
      .single();
    
    if (assetError || !asset) {
      console.error('Asset lookup error:', assetError);
      return NextResponse.json(
        { error: 'Asset not found in database' },
        { status: 404 }
      );
    }
    
    console.log(`📁 Found asset: ${asset.file_url}`);
    
    // Extract the storage path from the file_url
    // Expected format: "/assets/1GOSHEESH.mp4" or "artist-assets/gosheesh/1.mp4"
    let storagePath = asset.file_url;
    
    // If it's a legacy static file path, convert to storage path
    if (storagePath.startsWith('/assets/')) {
      // Convert /assets/1GOSHEESH.mp4 to gosheesh/1.mp4
      const fileName = storagePath.replace('/assets/', '');
      storagePath = `${artist_id}/${asset_number}.mp4`;
      console.log(`🔄 Converting legacy path to storage path: ${storagePath}`);
    }
    
    // Remove leading slash if present
    if (storagePath.startsWith('/')) {
      storagePath = storagePath.substring(1);
    }
    
    // Create signed URL with 7-day expiration
    const expiresIn = 60 * 60 * 24 * 7; // 7 days in seconds
    
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('artist-assets')
      .createSignedUrl(storagePath, expiresIn);
    
    if (signedUrlError) {
      console.error('Signed URL creation error:', signedUrlError);
      
      // If storage file doesn't exist, fall back to static file
      if (signedUrlError.message?.includes('not found')) {
        console.log('📄 Falling back to static file access');
        
        // For MVP, return the static file URL
        const staticUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}${asset.file_url}`;
        
        return NextResponse.json({
          url: staticUrl,
          expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          file_type: asset.file_type,
          metadata: asset.metadata,
          source: 'static'
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to create signed URL' },
        { status: 500 }
      );
    }
    
    // Update download count
    const { error: updateError } = await supabase
      .from('artist_assets')
      .update({ download_count: asset.download_count + 1 })
      .eq('artist_id', artist_id)
      .eq('asset_number', asset_number);
    
    if (updateError) {
      console.warn('Failed to update download count:', updateError);
      // Don't fail the request for this
    }
    
    console.log(`✅ Created signed URL for ${artist_id} asset ${asset_number}`);
    
    // Return the signed URL
    return NextResponse.json({
      url: signedUrlData.signedUrl,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      file_type: asset.file_type,
      metadata: asset.metadata,
      source: 'storage'
    });
    
  } catch (error: any) {
    console.error('API Error:', error);
    
    // Handle specific contract errors
    if (error.message?.includes('call revert')) {
      return NextResponse.json(
        { error: 'Contract call failed - user may not own download access' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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