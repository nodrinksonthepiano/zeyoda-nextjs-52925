const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyRegistryData() {
  console.log("🔍 VERIFYING REGISTRY DATA IN SUPABASE");
  console.log("====================================");
  
  try {
    // Check artists table
    const { data: artists, error: artistsError } = await supabase
      .from('artists')
      .select('id, displayname, treasury_wallet, swap_address')
      .order('id');
    
    if (artistsError) {
      console.error('❌ Artists table error:', artistsError);
      return;
    }
    
    console.log('📋 ARTISTS TABLE:');
    artists.forEach(artist => {
      console.log(`  ${artist.id}: treasury=${artist.treasury_wallet || 'NULL'}, swap=${artist.swap_address || 'NULL'}`);
    });
    
    // Check artist_registry table  
    const { data: registry, error: registryError } = await supabase
      .from('artist_registry')
      .select('id, token, swap, downloads, treasury_wallet')
      .order('id');
    
    if (registryError) {
      console.error('❌ Registry table error:', registryError);
      return;
    }
    
    console.log('\n📋 ARTIST_REGISTRY TABLE:');
    registry.forEach(reg => {
      console.log(`  ${reg.id}: token=${reg.token?.slice(0,8)}..., swap=${reg.swap?.slice(0,8)}..., downloads=${reg.downloads?.slice(0,8)}...`);
    });
    
    // Check for missing swap contracts
    const missingSwap = registry.filter(r => !r.swap || r.swap.length < 42);
    if (missingSwap.length > 0) {
      console.log('\n⚠️ MISSING SWAP CONTRACTS:');
      missingSwap.forEach(r => console.log(`  ${r.id}: ${r.swap || 'NULL'}`));
    } else {
      console.log('\n✅ All artists have valid swap contracts');
    }
    
  } catch (error) {
    console.error("❌ Verification failed:", error);
  }
}

verifyRegistryData().then(() => process.exit(0));
