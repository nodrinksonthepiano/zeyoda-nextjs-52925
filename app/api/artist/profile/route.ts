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

// Allowed font families
const ALLOWED_FONTS = ["Inter", "DM Sans", "Space Grotesk", "Instrument Sans", "Bungee", "Geist"];

interface ProfileUpdateRequest {
  artistId: string;
  primary_color?: string;
  accent_color?: string;
  font_family?: string;
  gradient_start?: string;
  gradient_end?: string;
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PATCH(request: NextRequest) {
  try {
    const updateData: ProfileUpdateRequest = await request.json();
    console.log('✏️ Profile update request:', { artistId: updateData.artistId, fields: Object.keys(updateData).filter(k => k !== 'artistId') });

    // Validate required fields
    if (!updateData.artistId) {
      return NextResponse.json({ 
        error: 'Missing artistId' 
      }, { status: 400 });
    }

    // Get wallet address from header for auth
    const walletAddress = request.headers.get('x-wallet-address');
    if (!walletAddress) {
      return NextResponse.json({ 
        error: 'Missing x-wallet-address header' 
      }, { status: 400 });
    }

    // Verify artist exists and get treasury wallet
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, name, displayname, treasury_wallet')
      .eq('id', updateData.artistId)
      .single();

    if (artistError || !artist) {
      return NextResponse.json({ 
        error: `Artist not found: ${updateData.artistId}` 
      }, { status: 404 });
    }

    // Verify caller is the artist's treasury wallet
    if (!artist.treasury_wallet || artist.treasury_wallet.toLowerCase() !== walletAddress.toLowerCase()) {
      console.log('🚫 Permission denied for profile update:', { 
        caller: walletAddress.slice(0, 8) + '...', 
        required: artist.treasury_wallet?.slice(0, 8) + '...' 
      });
      return NextResponse.json({ 
        error: 'Permission denied: only artist treasury wallet can edit profile' 
      }, { status: 403 });
    }

    // Validate and sanitize inputs
    const updates: any = {};
    const validationErrors: string[] = [];

    // Validate colors (hex format)
    const hexRegex = /^#([0-9a-fA-F]{6})$/;
    
    if (updateData.primary_color !== undefined) {
      if (hexRegex.test(updateData.primary_color)) {
        updates.primary_color = updateData.primary_color;
      } else {
        validationErrors.push('primary_color must be valid hex format (#RRGGBB)');
      }
    }

    if (updateData.accent_color !== undefined) {
      if (hexRegex.test(updateData.accent_color)) {
        updates.accent_color = updateData.accent_color;
      } else {
        validationErrors.push('accent_color must be valid hex format (#RRGGBB)');
      }
    }

    if (updateData.gradient_start !== undefined) {
      if (hexRegex.test(updateData.gradient_start)) {
        updates.gradient_start = updateData.gradient_start;
      } else {
        validationErrors.push('gradient_start must be valid hex format (#RRGGBB)');
      }
    }

    if (updateData.gradient_end !== undefined) {
      if (hexRegex.test(updateData.gradient_end)) {
        updates.gradient_end = updateData.gradient_end;
      } else {
        validationErrors.push('gradient_end must be valid hex format (#RRGGBB)');
      }
    }

    // Validate font family
    if (updateData.font_family !== undefined) {
      if (ALLOWED_FONTS.includes(updateData.font_family)) {
        updates.font_family = updateData.font_family;
      } else {
        validationErrors.push(`font_family must be one of: ${ALLOWED_FONTS.join(', ')}`);
      }
    }

    // Return validation errors
    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: validationErrors
      }, { status: 400 });
    }

    // Check if any updates to make
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ 
        error: 'No valid fields to update' 
      }, { status: 400 });
    }

    // Add timestamp
    updates.updated_at = new Date().toISOString();

    console.log('💾 Updating artist profile:', { artistId: updateData.artistId, updates: Object.keys(updates) });

    // Update artist profile
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from('artists')
      .update(updates)
      .eq('id', updateData.artistId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Profile update error:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update profile',
        details: updateError.message
      }, { status: 500 });
    }

    console.log('✅ Profile updated successfully for:', updateData.artistId);

    return NextResponse.json({
      success: true,
      updated: {
        primary_color: updateResult.primary_color,
        accent_color: updateResult.accent_color,
        font_family: updateResult.font_family,
        gradient_start: updateResult.gradient_start,
        gradient_end: updateResult.gradient_end
      }
    });

  } catch (error: any) {
    console.error('❌ Profile API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
