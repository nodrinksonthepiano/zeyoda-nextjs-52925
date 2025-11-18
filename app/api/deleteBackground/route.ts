import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function DELETE(request: NextRequest) {
  console.log('🗑️ Background delete API called...');
  
  try {
    const { artistId } = await request.json();
    
    // Get wallet address from header for auth
    const walletAddress = request.headers.get('x-wallet-address');
    
    if (!artistId) {
      return NextResponse.json({ error: 'Missing artistId' }, { status: 400 });
    }
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing x-wallet-address header' }, { status: 400 });
    }

    // Verify artist exists and get treasury wallet
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id, treasury_wallet')
      .eq('id', artistId)
      .single();

    if (artistError || !artist) {
      console.error('❌ Artist not found:', artistError);
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Verify ownership (caller must be treasury wallet)
    if (!artist.treasury_wallet || artist.treasury_wallet.toLowerCase() !== walletAddress.toLowerCase()) {
      console.log('🚫 Permission denied for background delete:', { 
        caller: walletAddress.slice(0, 8) + '...', 
        required: artist.treasury_wallet?.slice(0, 8) + '...' 
      });
      return NextResponse.json({ 
        error: 'Permission denied: only artist treasury wallet can delete background' 
      }, { status: 403 });
    }

    // Delete all background files for this artist
    let storageDeleted = false;
    try {
      const { data: files } = await supabase.storage
        .from('artist-assets')
        .list(artistId, {
          search: 'background'
        });
      
      if (files && files.length > 0) {
        const backgroundFiles = files
          .filter(f => f.name.startsWith('background.'))
          .map(f => `${artistId}/${f.name}`);
        
        if (backgroundFiles.length > 0) {
          const { error: deleteError } = await supabase.storage
            .from('artist-assets')
            .remove(backgroundFiles);
          
          if (deleteError) {
            console.warn('⚠️ Failed to delete background files from storage:', deleteError);
            // Don't fail - continue to database update
          } else {
            console.log('✅ Deleted background files from storage:', backgroundFiles);
            storageDeleted = true;
          }
        }
      } else {
        console.log('ℹ️ No background files found in storage (may already be deleted)');
      }
    } catch (error) {
      console.warn('⚠️ Error deleting background files from storage:', error);
      // Don't fail - continue to database update
    }

    // CRITICAL: Update database fields to null/false (LAYER 1: Database)
    console.log('🔄 Updating database fields: background_image_url=null, background_use_image=false');
    const { error: updateError } = await supabase
      .from('artists')
      .update({ 
        background_image_url: null, 
        background_use_image: false 
      })
      .eq('id', artistId);

    if (updateError) {
      console.error('❌ Failed to update database fields:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update database fields',
        details: updateError.message 
      }, { status: 500 });
    }

    console.log('✅ Background deletion complete:', {
      artistId,
      storageDeleted,
      databaseUpdated: true,
      background_image_url: null,
      background_use_image: false
    });

    return NextResponse.json({
      success: true,
      message: 'Background image deleted successfully',
      storageDeleted,
      databaseUpdated: true
    });

  } catch (error: any) {
    console.error('❌ Background delete error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

