import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSecret, rateLimit } from '@/app/utils/apiGuard';
import { verifyWhitelist } from '../../utils/server/whitelistCheck';

// Use service role for server-side deletes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  // Security guards: secret header + whitelist + rate limit
  const secretCheck = requireSecret(request);
  if (secretCheck) return secretCheck;
  
  // Also check whitelist (defense-in-depth - middleware should catch this, but backup check)
  const whitelistResult = await verifyWhitelist(request);
  if (!whitelistResult.verified) {
    console.log(`❌ Route blocked: ${whitelistResult.error || 'Not whitelisted'}`);
    return NextResponse.json(
      { 
        error: whitelistResult.error || 'Unauthorized',
        message: 'Access denied - whitelist required'
      },
      { status: whitelistResult.email === null ? 401 : 403 }
    );
  }
  
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
    
    // 4. Delete related records first (purchases, gas sponsorship events)
    // Note: These don't have foreign keys, so we delete manually
    console.log('🧹 Cleaning up related records...');
    
    // Delete purchases for this asset
    const { error: purchaseDeleteError } = await supabase
      .from('artist_purchases')
      .delete()
      .eq('artist_id', artistId)
      .eq('asset_number', assetNumber);
    
    if (purchaseDeleteError) {
      console.warn('⚠️ Failed to delete related purchases:', purchaseDeleteError);
      // Don't fail - purchases are historical records, but log the warning
    } else {
      console.log('✅ Deleted related purchases');
    }
    
    // Delete gas sponsorship events for this asset
    const { error: gasDeleteError } = await supabase
      .from('gas_sponsorship_events')
      .delete()
      .eq('artist_id', artistId)
      .eq('asset_number', assetNumber);
    
    if (gasDeleteError) {
      console.warn('⚠️ Failed to delete related gas sponsorship events:', gasDeleteError);
      // Don't fail - these are historical records
    } else {
      console.log('✅ Deleted related gas sponsorship events');
    }
    
    // 5. Delete file from storage (if it's a Supabase storage URL)
    let storageDeleted = false;
    if (asset.file_url && asset.file_url.includes('supabase.co/storage')) {
      try {
        // Extract bucket and path from URL
        // Format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
        const urlMatch = asset.file_url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
        if (urlMatch) {
          const [, bucket, filePath] = urlMatch;
          console.log('🗑️ Deleting file from storage:', { bucket, filePath });
          
          const { error: storageError } = await supabase.storage
            .from(bucket)
            .remove([filePath]);
          
          if (storageError) {
            console.warn('⚠️ Failed to delete file from storage:', storageError);
            // Don't fail - file might already be deleted or URL might be external
          } else {
            console.log('✅ Deleted file from storage');
            storageDeleted = true;
          }
        } else {
          console.log('ℹ️ File URL is not a Supabase storage URL, skipping storage deletion');
        }
      } catch (storageErr) {
        console.warn('⚠️ Error deleting from storage:', storageErr);
        // Don't fail - continue with database deletion
      }
    } else {
      console.log('ℹ️ File URL is not a Supabase storage URL, skipping storage deletion');
    }
    
    // 6. Delete from database
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
    
    console.log('✅ Asset deleted successfully', {
      artistId,
      assetNumber,
      storageDeleted,
      fileUrl: asset.file_url
    });
    
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

