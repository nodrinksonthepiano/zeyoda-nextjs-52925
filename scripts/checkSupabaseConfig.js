const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Import the centralized registry
const ARTIST_REGISTRY = {
  gosheesh: {
    token: "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac",
    swap:  "0xFCdc6C04bC0e1625178883c64567e1218Ee97DFf",
    treasuryWallet: "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8"
  },
  jaitea: {
    token: "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685",
    swap:  "0xd01cFF08a9962e67914a3A3e446D90513915db6f",
    treasuryWallet: "0x0B893D9D0dA09096C75e43c310316dC61b2773be"
  }
};

async function main() {
    console.log("🔍 CHECKING SUPABASE CONFIGURATION");
    console.log("=" * 40);
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ Missing Supabase environment variables");
        console.log("Make sure .env.local has:");
        console.log("NEXT_PUBLIC_SUPABASE_URL=...");
        console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY=...");
        return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        // Fetch current artists data
        const { data, error } = await supabase
            .from('artists')
            .select('*')
            .order('id');
            
        if (error) {
            console.error("❌ Error fetching from Supabase:", error.message);
            return;
        }
        
        if (!data || data.length === 0) {
            console.log("❌ No artists found in Supabase");
            return;
        }
        
        console.log(`📊 Found ${data.length} artists in Supabase:\n`);
        
        data.forEach(artist => {
            console.log(`🎨 ${artist.id.toUpperCase()}:`);
            console.log(`   Name: ${artist.name}`);
            console.log(`   Contract: ${artist.contract || 'NOT SET'}`);
            console.log(`   Swap Address: ${artist.swap_address || 'NOT SET'}`);
            console.log(`   Token Price: ${artist.tokenprice || 'NOT SET'}`);
            
            // Check if contract address is correct
            const expectedContract = ARTIST_REGISTRY[artist.id]?.token;
            const expectedSwap = ARTIST_REGISTRY[artist.id]?.swap;
            
            if (artist.contract === expectedContract) {
                console.log("   ✅ Contract address is CORRECT");
            } else {
                console.log("   ❌ Contract address is WRONG");
                console.log(`      Expected: ${expectedContract}`);
                console.log(`      Current:  ${artist.contract || 'NULL'}`);
            }
            
            if (artist.swap_address === expectedSwap) {
                console.log("   ✅ Swap address is CORRECT");
            } else {
                console.log("   ❌ Swap address is WRONG");
                console.log(`      Expected: ${expectedSwap}`);
                console.log(`      Current:  ${artist.swap_address || 'NULL'}`);
            }
            
            console.log("");
        });
        
        // Check if we need to update
        const needsUpdate = data.some(artist => {
            const expectedContract = ARTIST_REGISTRY[artist.id]?.token;
            const expectedSwap = ARTIST_REGISTRY[artist.id]?.swap;
            return artist.contract !== expectedContract || artist.swap_address !== expectedSwap;
        });
        
        if (needsUpdate) {
            console.log("🔧 FIXING REQUIRED:");
            console.log("Your Supabase has wrong contract addresses!");
            console.log("\nRun this SQL in your Supabase SQL Editor:");
            console.log("\n-- Update GOSHEESH");
            console.log(`UPDATE artists SET contract = '${ARTIST_REGISTRY.gosheesh.token}', swap_address = '${ARTIST_REGISTRY.gosheesh.swap}' WHERE id = 'gosheesh';`);
            console.log("\n-- Update JAITEA");
            console.log(`UPDATE artists SET contract = '${ARTIST_REGISTRY.jaitea.token}', swap_address = '${ARTIST_REGISTRY.jaitea.swap}' WHERE id = 'jaitea';`);
            console.log("\n-- Verify");
            console.log("SELECT id, name, contract, swap_address FROM artists;");
        } else {
            console.log("✅ All contract addresses are correct in Supabase!");
        }
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 