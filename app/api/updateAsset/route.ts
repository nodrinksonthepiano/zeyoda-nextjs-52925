import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for server-side updates
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  console.log('✏️  Asset update API called...');
  
  try {
    const { artistId, assetNumber, title, description, price, userAddress } = await request.json();
    
    // Validate required fields
    if (!artistId || !assetNumber || !title || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    console.log('📋 Update details:', { artistId, assetNumber, title, price });
    
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
    
    // 3. Get current asset data
    const { data: currentAsset, error: fetchError } = await supabase
      .from('artist_assets')
      .select('metadata')
      .eq('artist_id', artistId)
      .eq('asset_number', assetNumber)
      .single();
    
    if (fetchError || !currentAsset) {
      console.error('❌ Asset not found:', fetchError);
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    
    // 4. Update asset with new title, description, and price
    const { data: updatedAsset, error: updateError } = await supabase
      .from('artist_assets')
      .update({
        metadata: {
          ...currentAsset.metadata,
          title: title,
          description: description,
          desc: description // Maintain backward compatibility
        },
        price_usd: price
      })
      .eq('artist_id', artistId)
      .eq('asset_number', assetNumber)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to update asset' },
        { status: 500 }
      );
    }
    
    console.log('✅ Asset updated successfully');
    
    return NextResponse.json({
      success: true,
      asset: updatedAsset,
      message: 'Asset updated successfully'
    });
    
  } catch (error: any) {
    console.error('❌ Update error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

