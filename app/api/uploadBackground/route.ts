import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { assertMagicArtistUploader } from '@/app/utils/server/assertMagicArtistUploader';

// Use service role for server-side uploads
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  console.log('📤 Background upload API called...');
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const artistId = ((formData.get('artistId') as string) || '').trim();

    if (!file || !artistId) {
      return NextResponse.json({ error: 'Missing required fields: file and artistId' }, { status: 400 });
    }

    const uploadDenied = await assertMagicArtistUploader(request, artistId);
    if (uploadDenied) return uploadDenied;

    console.log('📋 Background upload details:', { artistId, fileSize: file.size, fileType: file.type });

    // 1. Validate file type (image only)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload an image file (JPG, PNG, SVG, or WebP)' 
      }, { status: 400 });
    }

    // 2. Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File size must be less than 5MB' 
      }, { status: 400 });
    }

    // Delete old background files first (cleanup)
    try {
      const { data: oldFiles } = await supabase.storage
        .from('artist-assets')
        .list(artistId, {
          search: 'background'
        });
      
      if (oldFiles && oldFiles.length > 0) {
        const oldBackgroundFiles = oldFiles
          .filter(f => f.name.startsWith('background.'))
          .map(f => `${artistId}/${f.name}`);
        
        if (oldBackgroundFiles.length > 0) {
          await supabase.storage
            .from('artist-assets')
            .remove(oldBackgroundFiles);
          console.log('🗑️ Deleted old background files:', oldBackgroundFiles);
        }
      }
    } catch (cleanupError) {
      console.warn('⚠️ Could not delete old background files (non-critical):', cleanupError);
    }

    // Upload file to Supabase Storage with unique filename
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const uniqueId = uuidv4();
    const fileName = `${artistId}/background.${uniqueId}.${fileExtension}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('artist-assets')
      .upload(fileName, file, {
        contentType: file.type,
        cacheControl: '0' // Disable caching
      });

    if (uploadError) {
      console.error('❌ File upload failed:', uploadError);
      return NextResponse.json({ error: 'File upload failed: ' + uploadError.message }, { status: 500 });
    }

    console.log('✅ Background uploaded:', uploadData.path);

    // Get the public URL for the uploaded file with cache-busting
    const { data: urlData } = supabase.storage
      .from('artist-assets')
      .getPublicUrl(uploadData.path);

    // Add cache-busting query parameter
    const cacheBustUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    console.log('📄 Public URL (cache-busted):', cacheBustUrl);

    return NextResponse.json({
      success: true,
      backgroundImageUrl: cacheBustUrl,
      message: 'Background image uploaded successfully'
    });

  } catch (error: any) {
    console.error('❌ Background upload error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

