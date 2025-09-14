const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkCancakesToken() {
  console.log("🔍 CHECKING CANCAKES TOKEN ADDRESS");
  console.log("=================================");
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Check artist_registry table
    const { data: registry, error: registryError } = await supabase
      .from('artist_registry')
      .select('*')
      .eq('id', 'cancakes')
      .single();
    
    if (registryError) {
      console.error('❌ Registry error:', registryError);
      return;
    }
    
    console.log('📊 CANCAKES Registry Data:');
    console.log('ID:', registry.id);
    console.log('Token Address:', registry.token);
    console.log('Downloads Address:', registry.downloads);
    console.log('Swap Address:', registry.swap);
    console.log('Treasury Address:', registry.treasury);
    
    // Also check artists table
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('*')
      .eq('id', 'cancakes')
      .single();
    
    if (!artistError) {
      console.log('\n📊 CANCAKES Artists Data:');
      console.log('Token Address:', artist.token_address);
      console.log('Download Address:', artist.download_address);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCancakesToken();
