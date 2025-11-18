import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function DELETE(request: NextRequest) {
  console.log('🗑️ Logo delete API called...');
  
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
      console.log('🚫 Permission denied for logo delete:', { 
        caller: walletAddress.slice(0, 8) + '...', 
        required: artist.treasury_wallet?.slice(0, 8) + '...' 
      });
      return NextResponse.json({ 
        error: 'Permission denied: only artist treasury wallet can delete logo' 
      }, { status: 403 });
    }

    // Delete all logo files for this artist
    let storageDeleted = false;
    try {
      const { data: files } = await supabase.storage
        .from('artist-assets')
        .list(artistId, {
          search: 'logo'
        });
      
      if (files && files.length > 0) {
        const logoFiles = files
          .filter(f => f.name.startsWith('logo.'))
          .map(f => `${artistId}/${f.name}`);
        
        if (logoFiles.length > 0) {
          const { error: deleteError } = await supabase.storage
            .from('artist-assets')
            .remove(logoFiles);
          
          if (deleteError) {
            console.warn('⚠️ Failed to delete logo files from storage:', deleteError);
            // Don't fail - continue to database update
          } else {
            console.log('✅ Deleted logo files from storage:', logoFiles);
            storageDeleted = true;
          }
        }
      } else {
        console.log('ℹ️ No logo files found in storage (may already be deleted)');
      }
    } catch (error) {
      console.warn('⚠️ Error deleting logo files from storage:', error);
      // Don't fail - continue to database update
    }

    // CRITICAL: Update database fields to null/false (LAYER 1: Database)
    console.log('🔄 Updating database fields: logo_url=null, logo_use_background=false');
    const { error: updateError } = await supabase
      .from('artists')
      .update({ 
        logo_url: null, 
        logo_use_background: false 
      })
      .eq('id', artistId);

    if (updateError) {
      console.error('❌ Failed to update database fields:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update database fields',
        details: updateError.message 
      }, { status: 500 });
    }

    console.log('✅ Logo deletion complete:', {
      artistId,
      storageDeleted,
      databaseUpdated: true,
      logo_url: null,
      logo_use_background: false
    });

    return NextResponse.json({
      success: true,
      message: 'Logo deleted successfully',
      storageDeleted,
      databaseUpdated: true
    });

  } catch (error: any) {
    console.error('❌ Logo delete error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

