const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function main() {
    console.log("🔍 CHECKING TOKEN NAME MISMATCH");
    console.log("=" * 40);
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ Missing Supabase environment variables");
        return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check environment variables
    console.log("🔧 ENVIRONMENT VARIABLES:");
    console.log("NEXT_PUBLIC_GOSH33SH_TOKEN:", process.env.NEXT_PUBLIC_GOSH33SH_TOKEN || "NOT SET");
    console.log("NEXT_PUBLIC_JAIT33_TOKEN:", process.env.NEXT_PUBLIC_JAIT33_TOKEN || "NOT SET");
    
    // Check if they have < characters
    if (process.env.NEXT_PUBLIC_GOSH33SH_TOKEN?.includes('<')) {
        console.log("❌ GOSH33SH_TOKEN has < character - INVALID!");
    }
    if (process.env.NEXT_PUBLIC_JAIT33_TOKEN?.includes('<')) {
        console.log("❌ JAIT33_TOKEN has < character - INVALID!");
    }
    
    try {
        // Fetch current artists data
        const { data, error } = await supabase
            .from('artists')
            .select('id, name, tokenName, contract')
            .order('id');
            
        if (error) {
            console.error("❌ Error fetching from Supabase:", error.message);
            return;
        }
        
        if (!data || data.length === 0) {
            console.log("❌ No artists found in Supabase");
            return;
        }
        
        console.log("\n📊 SUPABASE TOKEN NAMES vs ENVIRONMENT:");
        
        // Expected mapping from frontend code
        const expectedEnvMapping = {
            'GOSH33SH': 'NEXT_PUBLIC_GOSH33SH_TOKEN',
            'JAIT33': 'NEXT_PUBLIC_JAIT33_TOKEN'
        };
        
        data.forEach(artist => {
            console.log(`\n🎨 ${artist.id.toUpperCase()}:`);
            console.log(`   Supabase tokenName: "${artist.tokenName}"`);
            console.log(`   Contract: ${artist.contract}`);
            
            // Check if tokenName matches any environment variable key
            const envVarName = expectedEnvMapping[artist.tokenName];
            if (envVarName) {
                const envValue = process.env[envVarName];
                console.log(`   ✅ Matches env var: ${envVarName}`);
                console.log(`   Env value: ${envValue}`);
                
                if (envValue === artist.contract) {
                    console.log("   ✅ Environment and Supabase match!");
                } else {
                    console.log("   ❌ Environment and Supabase don't match!");
                }
            } else {
                console.log(`   ❌ NO MATCHING ENV VAR for tokenName "${artist.tokenName}"`);
                console.log("   Expected tokenName should be one of:", Object.keys(expectedEnvMapping));
            }
        });
        
        console.log("\n🔧 SOLUTION:");
        console.log("The frontend expects tokenName to be exactly 'GOSH33SH' and 'JAIT33'");
        console.log("But your Supabase has different tokenName values.");
        console.log("\nYou need to either:");
        console.log("1. Update Supabase tokenName values to 'GOSH33SH' and 'JAIT33'");
        console.log("2. OR fix the frontend to use Supabase contract addresses directly");
        
        console.log("\nSQL to fix Supabase:");
        console.log("UPDATE artists SET tokenName = 'GOSH33SH' WHERE id = 'gosheesh';");
        console.log("UPDATE artists SET tokenName = 'JAIT33' WHERE id = 'jaitea';");
        
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