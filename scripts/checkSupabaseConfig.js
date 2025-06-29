const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Expected correct addresses
const EXPECTED_ADDRESSES = {
  gosheesh: "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac", // GOSH33SH
  jaitea: "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685"   // JAIT33
};

const EXPECTED_SWAP_ADDRESSES = {
  gosheesh: "0x63349f5190860b4E954639eeFd60b92bE9A01148", // GOSHEESH Swap
  jaitea: "0xd01cFF08a9962e67914a3A3e446D90513915db6f"   // JAITEA Swap
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
            const expectedContract = EXPECTED_ADDRESSES[artist.id];
            const expectedSwap = EXPECTED_SWAP_ADDRESSES[artist.id];
            
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
            const expectedContract = EXPECTED_ADDRESSES[artist.id];
            const expectedSwap = EXPECTED_SWAP_ADDRESSES[artist.id];
            return artist.contract !== expectedContract || artist.swap_address !== expectedSwap;
        });
        
        if (needsUpdate) {
            console.log("🔧 FIXING REQUIRED:");
            console.log("Your Supabase has wrong contract addresses!");
            console.log("\nRun this SQL in your Supabase SQL Editor:");
            console.log("\n-- Update GOSHEESH");
            console.log(`UPDATE artists SET contract = '${EXPECTED_ADDRESSES.gosheesh}', swap_address = '${EXPECTED_SWAP_ADDRESSES.gosheesh}' WHERE id = 'gosheesh';`);
            console.log("\n-- Update JAITEA");
            console.log(`UPDATE artists SET contract = '${EXPECTED_ADDRESSES.jaitea}', swap_address = '${EXPECTED_SWAP_ADDRESSES.jaitea}' WHERE id = 'jaitea';`);
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