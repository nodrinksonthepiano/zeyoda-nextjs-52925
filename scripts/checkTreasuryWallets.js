const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTreasuryWallets() {
  console.log("🔍 CHECKING ARTIST TREASURY WALLETS");
  console.log("===================================");
  
  try {
    const { data: artists, error } = await supabase
      .from('artists')
      .select('id, name, displayname, treasury_wallet, total_earnings_usd, total_sales_count');
    
    if (error) {
      throw new Error(`Failed to fetch artists: ${error.message}`);
    }
    
    console.log(`📋 Found ${artists.length} artists:\n`);
    
    artists.forEach(artist => {
      console.log(`🎨 ${artist.id.toUpperCase()}:`);
      console.log(`  Display Name: ${artist.displayname || artist.name}`);
      console.log(`  Treasury Wallet: ${artist.treasury_wallet || '❌ NOT SET'}`);
      console.log(`  Total Earnings: $${artist.total_earnings_usd || 0}`);
      console.log(`  Total Sales: ${artist.total_sales_count || 0}`);
      console.log('');
    });
    
    // Show your current connected wallet
    console.log("🔑 YOUR CURRENT WALLET: 0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8");
    console.log("👆 This wallet should match an artist's treasury_wallet to see Artist Earnings");
    
  } catch (error) {
    console.error("❌ Check failed:", error);
    process.exit(1);
  }
}

// Run the check
checkTreasuryWallets()
  .then(() => {
    console.log("✅ Treasury wallet check completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Check failed:", error);
    process.exit(1);
  });
