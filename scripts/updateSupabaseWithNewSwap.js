const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// New swap contract address
const NEW_GOSHEESH_SWAP = "0xC7Ddb4F5310405758e4D609dA1E6aba4228E29ae";

async function main() {
    console.log("📝 UPDATING SUPABASE WITH NEW SWAP CONTRACT");
    console.log("=" * 40);
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ Missing Supabase environment variables");
        return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        // Update GOSHEESH swap address
        console.log("🚀 Updating GOSHEESH swap address...");
        
        const { data, error } = await supabase
            .from('artists')
            .update({ swap_address: NEW_GOSHEESH_SWAP })
            .eq('id', 'gosheesh')
            .select();
            
        if (error) {
            console.error("❌ Error updating Supabase:", error.message);
            return;
        }
        
        console.log("✅ Successfully updated GOSHEESH swap address");
        console.log("Updated data:", data);
        
        // Verify the update
        console.log("\n🔍 Verifying update...");
        const { data: verifyData, error: verifyError } = await supabase
            .from('artists')
            .select('id, name, contract, swap_address')
            .eq('id', 'gosheesh');
            
        if (verifyError) {
            console.error("❌ Error verifying update:", verifyError.message);
            return;
        }
        
        console.log("📊 Current GOSHEESH configuration:");
        console.log(`  Contract: ${verifyData[0].contract}`);
        console.log(`  Swap Address: ${verifyData[0].swap_address}`);
        
        if (verifyData[0].swap_address === NEW_GOSHEESH_SWAP) {
            console.log("✅ Supabase update confirmed!");
        } else {
            console.log("❌ Update verification failed");
        }
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
    
    console.log("\n🎯 NEXT STEPS:");
    console.log("1. Hard refresh your browser (Cmd+Shift+R)");
    console.log("2. Try the GOSHEESH swap with a small amount ($1-5)");
    console.log("3. Swap should now work automatically!");
    console.log("4. Deploy JAITEA swap when you have more ETH");
    
    console.log("\n💡 FOR MANUAL TESTING:");
    console.log("The new GOSHEESH swap contract is ready at:");
    console.log(`${NEW_GOSHEESH_SWAP}`);
    console.log("Fixed rate: 1 ETH = 1,000,000 GOSH33SH tokens");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 