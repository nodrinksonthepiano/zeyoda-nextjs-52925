const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkCancakesTheme() {
  console.log("🎨 CHECKING CANCAKES THEME COLORS");
  console.log("=================================");
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const { data: artist, error } = await supabase
      .from('artists')
      .select('*')
      .eq('id', 'cancakes')
      .single();
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('📊 CANCAKES Current Theme:');
    console.log('Theme Object:', JSON.stringify(artist.theme, null, 2));
    
    if (artist.theme) {
      console.log('\n🎨 Colors:');
      console.log('   Primary Color:', artist.theme.primaryColor);
      console.log('   Accent Color:', artist.theme.accentColor);
      console.log('   Gradient Start:', artist.theme.gradientStart);
      console.log('   Gradient Middle:', artist.theme.gradientMiddle);
      console.log('   Gradient End:', artist.theme.gradientEnd);
      console.log('   Font Family:', artist.theme.fontFamily);
    }
    
    console.log('\n💡 EXPECTED PANCAKE COLORS:');
    console.log('   Should be gold/orange like pancakes');
    console.log('   Current accent:', artist.theme?.accentColor);
    console.log('   Is blue?', artist.theme?.accentColor?.includes('ff') || artist.theme?.accentColor?.includes('blue'));
    
    if (artist.theme?.accentColor === '#1e5cff') {
      console.log('\n❌ PROBLEM FOUND!');
      console.log('   CANCAKES is using BLUE (#1e5cff) instead of pancake gold');
      console.log('   Need to update to pancake colors');
      
      console.log('\n🍰 SUGGESTED PANCAKE THEME:');
      console.log('   Primary: #2D1B00 (dark brown)');
      console.log('   Accent: #FFD700 (gold)');
      console.log('   Gradient Start: #FFD700 (gold)');
      console.log('   Gradient Middle: #FFA500 (orange)');
      console.log('   Gradient End: #FF8C00 (dark orange)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCancakesTheme();
