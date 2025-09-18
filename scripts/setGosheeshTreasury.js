const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setGosheeshTreasuryWallet() {
  console.log("🔧 SETTING GOSHEESH AS TREASURY WALLET");
  console.log("=====================================");
  
  try {
    const gosheeshWallet = '0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8';
    
    // Update GOSHEESH treasury wallet
    const { error } = await supabase
      .from('artists')
      .update({ treasury_wallet: gosheeshWallet })
      .eq('id', 'gosheesh');
    
    if (error) {
      throw new Error(`Failed to update treasury wallet: ${error.message}`);
    }
    
    console.log('✅ GOSHEESH treasury_wallet set to:', gosheeshWallet);
    console.log('\n🎯 WHEN YOU REFRESH, GOSHEESH WALLET WILL SHOW:');
    console.log('   🎨 Artist Earnings (Purple): $16.95 from GOSHEESH sales');
    console.log('   🏦 Protocol Treasury (Yellow): $0.135 from all protocol fees');
    console.log('\n📱 Both sections will be collapsible with the same privacy toggle');
    
  } catch (error) {
    console.error("❌ Failed to set treasury wallet:", error);
    process.exit(1);
  }
}

// Run the update
setGosheeshTreasuryWallet()
  .then(() => {
    console.log("✅ Treasury wallet setup completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  });
