import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSecret, rateLimit } from '@/app/utils/apiGuard';

// Use service role for server-side deletes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  // Security guards: secret header + rate limit
  const secretCheck = requireSecret(request);
  if (secretCheck) return secretCheck;
  
  const rl = rateLimit(request, 'delete-asset', 10, 60_000); // 10/min per IP
  if (rl) return rl;
  
  console.log('🗑️  Asset delete API called...');
  
  try {
    const { artistId, assetNumber, userAddress } = await request.json();
    
    // Validate required fields
    if (!artistId || !assetNumber || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: artistId, assetNumber, userAddress' },
        { status: 400 }
      );
    }
    
    console.log('📋 Delete details:', { artistId, assetNumber });
    
    // 1. Verify user owns this artist
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('treasury_wallet')
      .eq('id', artistId)
      .single();
    
    if (artistError || !artist) {
      console.error('❌ Artist not found:', artistError);
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }
    
    // 2. Verify ownership
    if (artist.treasury_wallet?.toLowerCase() !== userAddress.toLowerCase()) {
      console.error('❌ Ownership verification failed');
      return NextResponse.json(
        { error: 'You do not own this artist' },
        { status: 403 }
      );
    }
    
    // 3. Get asset to find file URL for storage cleanup
    const { data: asset, error: fetchError } = await supabase
      .from('artist_assets')
      .select('file_url')
      .eq('artist_id', artistId)
      .eq('asset_number', assetNumber)
      .single();
    
    if (fetchError || !asset) {
      console.error('❌ Asset not found:', fetchError);
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    
    // 4. Delete from database
    const { error: deleteError } = await supabase
      .from('artist_assets')
      .delete()
      .eq('artist_id', artistId)
      .eq('asset_number', assetNumber);
    
    if (deleteError) {
      console.error('❌ Delete failed:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete asset' },
        { status: 500 }
      );
    }
    
    // 5. Optionally delete file from storage (if it's a Supabase storage URL)
    // Note: We'll leave the file in storage for now to avoid breaking references
    // You can manually clean up storage later if needed
    
    console.log('✅ Asset deleted successfully');
    
    return NextResponse.json({
      success: true,
      message: `Asset #${assetNumber} deleted successfully`
    });
    
  } catch (error: any) {
    console.error('❌ Delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

