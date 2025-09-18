const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupArtistWallets() {
  console.log("🔧 SETTING UP ARTIST TREASURY WALLETS");
  console.log("====================================");
  
  try {
    // For now, let's set up the wallet ownership clearly
    // In your case, you want to test as different artists
    
    const walletSetup = [
      {
        artistId: 'gosheesh',
        treasuryWallet: '0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8', // Your main wallet
        description: 'GOSHEESH + Protocol Treasury'
      },
      {
        artistId: 'jaitea', 
        treasuryWallet: '0xb8933d90d0da09096c75e43c310316dc61b2773be', // Your current connected wallet
        description: 'JAITEA artist wallet'
      }
      // CANCAKES can remain unset for now
    ];
    
    console.log('🎯 Setting up wallets:');
    
    for (const setup of walletSetup) {
      console.log(`\n🎨 ${setup.artistId.toUpperCase()}:`);
      console.log(`  Treasury Wallet: ${setup.treasuryWallet}`);
      console.log(`  Purpose: ${setup.description}`);
      
      const { error } = await supabase
        .from('artists')
        .update({ treasury_wallet: setup.treasuryWallet })
        .eq('id', setup.artistId);
      
      if (error) {
        console.error(`❌ Error setting ${setup.artistId}:`, error);
        continue;
      }
      
      console.log(`✅ ${setup.artistId} treasury wallet set`);
    }
    
    console.log('\n🎯 EXPECTED BEHAVIOR:');
    console.log('When connected as 0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8:');
    console.log('  - 🎨 GOSHEESH Earnings: $16.95 (17 sales)');
    console.log('  - 🏦 Protocol Treasury: $0.135 (all fees)');
    console.log('');
    console.log('When connected as 0xb8933d90d0da09096c75e43c310316dc61b2773be:');
    console.log('  - 🎨 JAITEA Earnings: $10.97 (11 sales)');
    console.log('  - (No treasury section)');
    
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
}

// Run the setup
setupArtistWallets()
  .then(() => {
    console.log("✅ Artist wallet setup completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  });
