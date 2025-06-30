const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// NEW swap contract addresses from latest deployment
const NEW_GOSHEESH_SWAP = "0x984A009d3113342F004C40A0934b77A81c66a42e";
const NEW_JAITEA_SWAP = "0x5da3a34555EbfA9FC780F869d2F68898E9010DB6";

async function main() {
    console.log("📝 UPDATING SUPABASE WITH NEW SWAP CONTRACTS");
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
        
        const { data: gosheeshData, error: gosheeshError } = await supabase
            .from('artists')
            .update({ swap_address: NEW_GOSHEESH_SWAP })
            .eq('id', 'gosheesh')
            .select();
            
        if (gosheeshError) {
            console.error("❌ Error updating GOSHEESH:", gosheeshError.message);
        } else {
            console.log("✅ Successfully updated GOSHEESH swap address");
        }
        
        // Update JAITEA swap address
        console.log("🚀 Updating JAITEA swap address...");
        
        const { data: jaiteaData, error: jaiteaError } = await supabase
            .from('artists')
            .update({ swap_address: NEW_JAITEA_SWAP })
            .eq('id', 'jaitea')
            .select();
            
        if (jaiteaError) {
            console.error("❌ Error updating JAITEA:", jaiteaError.message);
        } else {
            console.log("✅ Successfully updated JAITEA swap address");
        }
        
        // Verify the updates
        console.log("\n🔍 Verifying updates...");
        const { data: verifyData, error: verifyError } = await supabase
            .from('artists')
            .select('id, name, contract, swap_address')
            .in('id', ['gosheesh', 'jaitea']);
            
        if (verifyError) {
            console.error("❌ Error verifying updates:", verifyError.message);
            return;
        }
        
        console.log("📊 Current configuration:");
        verifyData.forEach(artist => {
            console.log(`  ${artist.name}:`);
            console.log(`    Contract: ${artist.contract}`);
            console.log(`    Swap Address: ${artist.swap_address}`);
        });
        
        // Check if updates were successful
        const gosheeshCorrect = verifyData.find(a => a.id === 'gosheesh')?.swap_address === NEW_GOSHEESH_SWAP;
        const jaiteaCorrect = verifyData.find(a => a.id === 'jaitea')?.swap_address === NEW_JAITEA_SWAP;
        
        if (gosheeshCorrect && jaiteaCorrect) {
            console.log("✅ All Supabase updates confirmed!");
        } else {
            console.log("❌ Some updates failed verification");
        }
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
    
    console.log("\n🎯 NEXT STEPS:");
    console.log("1. Hard refresh your browser (Cmd+Shift+R)");
    console.log("2. Try both GOSHEESH and JAITEA swaps with small amounts ($1-5)");
    console.log("3. Both swaps should now work automatically!");
    
    console.log("\n💡 NEW SWAP CONTRACT ADDRESSES:");
    console.log(`GOSHEESH: ${NEW_GOSHEESH_SWAP}`);
    console.log(`JAITEA: ${NEW_JAITEA_SWAP}`);
    console.log("Fixed rate: 1 ETH = 1,000,000 tokens");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 