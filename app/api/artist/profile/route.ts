import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isPlaceholderVideoSrc } from '@/app/utils/launchIntegrity';
import { assertMagicArtistUploader } from '@/app/utils/server/assertMagicArtistUploader';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// PATCH body keys must match this allowlist exactly (reject treasury, contracts, money, paused, etc.).
const SAFE_PROFILE_PATCH_KEYS = new Set([
  'artistId',
  'primary_color',
  'accent_color',
  'font_family',
  'gradient_start',
  'gradient_end',
  'stardust',
  'logo_url',
  'background_image_url',
  'logo_use_background',
  'background_use_image',
  'videosrc',
]);

// Allowed font families
const ALLOWED_FONTS = ["Inter", "DM Sans", "Space Grotesk", "Instrument Sans", "Bungee", "Geist", "Bungee, cursive", "Inter, sans-serif", "Arial, sans-serif"];

interface ProfileUpdateRequest {
  artistId: string;
  primary_color?: string;
  accent_color?: string;
  font_family?: string;
  gradient_start?: string;
  gradient_end?: string;
  stardust?: boolean;
  logo_url?: string;
  background_image_url?: string;
  logo_use_background?: boolean;
  background_use_image?: boolean;
  /** Hero / featured media public URL (launch retry path). */
  videosrc?: string;
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PATCH(request: NextRequest) {
  try {
    const updateData: ProfileUpdateRequest = await request.json();
    console.log('✏️ Profile update request:', { artistId: updateData.artistId, fields: Object.keys(updateData).filter(k => k !== 'artistId') });
    console.log('✏️ Full request data:', updateData);

    // Validate required fields
    if (!updateData.artistId) {
      return NextResponse.json({ 
        error: 'Missing artistId' 
      }, { status: 400 });
    }

    const disallowedKeys = Object.keys(updateData).filter((k) => !SAFE_PROFILE_PATCH_KEYS.has(k));
    if (disallowedKeys.length > 0) {
      return NextResponse.json(
        {
          error:
            'Disallowed profile fields (treasury, contracts, withdrawals, paused state, etc. cannot be PATCHed here)',
          disallowedKeys,
        },
        { status: 400 },
      );
    }

    const profileForbidden = await assertMagicArtistUploader(request, updateData.artistId);
    if (profileForbidden) return profileForbidden;

    // Verify artist exists and get theme column
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, name, displayname, theme')
      .eq('id', updateData.artistId)
      .single();

    if (artistError || !artist) {
      return NextResponse.json({ 
        error: `Artist not found: ${updateData.artistId}` 
      }, { status: 404 });
    }

    // Validate and sanitize inputs - build theme JSONB object
    const validationErrors: string[] = [];
    const currentTheme = (artist.theme || {}) as Record<string, unknown>;
    const newTheme: Record<string, unknown> = { ...currentTheme };

    // Validate colors (hex format)
    const hexRegex = /^#([0-9a-fA-F]{6})$/;
    
    if (updateData.primary_color !== undefined) {
      if (hexRegex.test(updateData.primary_color)) {
        newTheme.primaryColor = updateData.primary_color;
      } else {
        validationErrors.push('primary_color must be valid hex format (#RRGGBB)');
      }
    }

    if (updateData.accent_color !== undefined) {
      if (hexRegex.test(updateData.accent_color)) {
        newTheme.accentColor = updateData.accent_color;
      } else {
        validationErrors.push('accent_color must be valid hex format (#RRGGBB)');
      }
    }

    if (updateData.gradient_start !== undefined) {
      if (hexRegex.test(updateData.gradient_start)) {
        newTheme.gradientStart = updateData.gradient_start;
      } else {
        validationErrors.push('gradient_start must be valid hex format (#RRGGBB)');
      }
    }

    if (updateData.gradient_end !== undefined) {
      if (hexRegex.test(updateData.gradient_end)) {
        newTheme.gradientEnd = updateData.gradient_end;
      } else {
        validationErrors.push('gradient_end must be valid hex format (#RRGGBB)');
      }
    }

    // Validate font family (allow any reasonable font string)
    if (updateData.font_family !== undefined) {
      if (updateData.font_family.length > 0 && updateData.font_family.length < 100) {
        newTheme.fontFamily = updateData.font_family;
      } else {
        validationErrors.push('font_family must be a valid font string');
      }
    }

    if (updateData.stardust !== undefined) {
      newTheme.stardust = updateData.stardust === true;
    }

    let videosrcUpdate: string | undefined;
    if (updateData.videosrc !== undefined) {
      const v = String(updateData.videosrc).trim();
      if (!v.startsWith('https://') || isPlaceholderVideoSrc(v)) {
        validationErrors.push('videosrc must be a valid https URL (not a placeholder)');
      } else {
        videosrcUpdate = v;
      }
    }

    // Return validation errors
    if (validationErrors.length > 0) {
      console.log('❌ Validation errors:', validationErrors);
      return NextResponse.json({ 
        error: 'Validation failed',
        details: validationErrors
      }, { status: 400 });
    }

    // Check if theme has changes
    const hasThemeChanges = JSON.stringify(newTheme) !== JSON.stringify(currentTheme);
    
    // Prepare updates for JSONB theme column and logo fields
    const updates: any = { theme: newTheme };
    
    // Handle logo fields (store directly in artists table, not in theme JSONB)
    if (updateData.logo_url !== undefined) {
      updates.logo_url = updateData.logo_url;
    }
    if (updateData.background_image_url !== undefined) {
      updates.background_image_url = updateData.background_image_url;
    }
    if (updateData.logo_use_background !== undefined) {
      updates.logo_use_background = updateData.logo_use_background;
    }
    if (updateData.background_use_image !== undefined) {
      updates.background_use_image = updateData.background_use_image;
    }

    if (videosrcUpdate !== undefined) {
      updates.videosrc = videosrcUpdate;
    }
    
    // Check if there are any changes (theme or logo fields)
    const hasLogoChanges = updateData.logo_url !== undefined || 
                          updateData.background_image_url !== undefined ||
                          updateData.logo_use_background !== undefined ||
                          updateData.background_use_image !== undefined;

    const hasVideosrcChange = videosrcUpdate !== undefined;
    
    if (!hasThemeChanges && !hasLogoChanges && !hasVideosrcChange) {
      return NextResponse.json({ 
        error: 'No valid fields to update' 
      }, { status: 400 });
    }

    console.log('💾 Updating artist profile:', { 
      artistId: updateData.artistId, 
      themeChanges: hasThemeChanges ? Object.keys(newTheme) : [],
      logoChanges: hasLogoChanges ? ['logo_url', 'background_image_url', 'logo_use_background', 'background_use_image'].filter(f => updateData[f as keyof ProfileUpdateRequest] !== undefined) : [],
      videosrc: hasVideosrcChange,
    });

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

    // Extract theme fields from JSONB theme column (not separate columns)
    const themeData = updateResult.theme as any || {};
    
    return NextResponse.json({
      success: true,
      updated: {
        primary_color: themeData.primaryColor || updateData.primary_color,
        accent_color: themeData.accentColor || updateData.accent_color,
        font_family: themeData.fontFamily || updateData.font_family,
        gradient_start: themeData.gradientStart || updateData.gradient_start,
        gradient_end: themeData.gradientEnd || updateData.gradient_end,
        stardust: themeData.stardust === true,
        logo_url: updateResult.logo_url,
        background_image_url: updateResult.background_image_url,
        logo_use_background: updateResult.logo_use_background,
        background_use_image: updateResult.background_use_image,
        videosrc: updateResult.videosrc,
      }
    });

  } catch (error: any) {
    console.error('❌ Profile API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
