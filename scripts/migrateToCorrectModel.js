const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateToCorrectModel() {
  console.log("🔧 MIGRATING TO CORRECT ECONOMICS MODEL");
  console.log("=====================================");
  console.log("📋 Plan:");
  console.log("  - 0.3% swap fees → Treasury");
  console.log("  - 99.7% LP position → Artist withdrawable");
  console.log("  - Download sales → Artist (existing)");
  
  try {
    // Step 1: Create treasury pseudo-artist
    console.log("\n🏦 Step 1: Creating treasury pseudo-artist...");
    
    const { error: insertError } = await supabase
      .from('artists')
      .insert({
        id: 'treasury',
        name: 'Protocol Treasury',
        displayname: 'Protocol Treasury',
        tokenName: 'TREASURY',
        artworktitle: 'Protocol Revenue',
        artworkyear: '2025',
        tokenprice: 0,
        videosrc: '/assets/treasury.mp4',
        theme: JSON.stringify({
          primaryColor: '#FFD700',
          accentColor: '#FFA500',
          gradientStart: '#FFD700',
          gradientMiddle: '#FFA500',
          gradientEnd: '#FF8C00'
        }),
        orbitaltokens: JSON.stringify([]),
        total_earnings_usd: 0,
        total_sales_count: 0,
        treasury_wallet: '0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8' // Your treasury wallet
      })
      .select();
    
    if (insertError && !insertError.message?.includes('duplicate')) {
      console.error('❌ Treasury creation error:', insertError);
    } else {
      console.log('✅ Treasury pseudo-artist created/verified');
    }
    
    // Step 2: Check current LP fee attribution
    console.log("\n📊 Step 2: Checking current LP fee attribution...");
    
    const { data: lpFees, error: lpError } = await supabase
      .from('artist_earnings')
      .select('artist_id, COUNT(*) as count, SUM(net_earnings_usd) as total')
      .eq('error_reason', 'LP_FEE')
      .group('artist_id');
    
    if (lpError) {
      console.error('❌ LP fee check error:', lpError);
      return;
    }
    
    console.log('💰 Current LP fee attribution:');
    (lpFees || []).forEach(row => {
      console.log(`  ${row.artist_id}: ${row.count} records, $${parseFloat(row.total || 0).toFixed(2)}`);
    });
    
    // Step 3: Re-attribute LP fees to treasury
    console.log("\n🔄 Step 3: Re-attributing LP fees to treasury...");
    
    const { data: updateResult, error: updateError } = await supabase
      .from('artist_earnings')
      .update({ artist_id: 'treasury' })
      .neq('artist_id', 'treasury')
      .eq('error_reason', 'LP_FEE')
      .select();
    
    if (updateError) {
      console.error('❌ Re-attribution error:', updateError);
      return;
    }
    
    console.log(`✅ Re-attributed ${updateResult?.length || 0} LP fee records to treasury`);
    
    // Step 4: Recalculate artist totals (downloads only)
    console.log("\n📊 Step 4: Recalculating artist totals (downloads only)...");
    
    const artists = ['gosheesh', 'jaitea', 'cancakes'];
    
    for (const artistId of artists) {
      // Get download earnings only (exclude LP fees)
      const { data: downloadEarnings, error: downloadError } = await supabase
        .from('artist_earnings')
        .select('net_earnings_usd')
        .eq('artist_id', artistId)
        .neq('error_reason', 'LP_FEE'); // Exclude LP fees
      
      if (downloadError) {
        console.error(`❌ Download earnings error for ${artistId}:`, downloadError);
        continue;
      }
      
      const totalDownloads = downloadEarnings.reduce((sum, e) => sum + parseFloat(e.net_earnings_usd || 0), 0);
      const downloadCount = downloadEarnings.length;
      
      // Update artist totals (downloads only)
      const { error: artistUpdateError } = await supabase
        .from('artists')
        .update({
          total_earnings_usd: totalDownloads,
          total_sales_count: downloadCount
        })
        .eq('id', artistId);
      
      if (artistUpdateError) {
        console.error(`❌ Artist update error for ${artistId}:`, artistUpdateError);
      } else {
        console.log(`✅ ${artistId}: $${totalDownloads.toFixed(2)} downloads (${downloadCount} sales)`);
      }
    }
    
    // Step 5: Calculate treasury totals
    console.log("\n🏦 Step 5: Calculating treasury totals...");
    
    const { data: treasuryEarnings, error: treasuryError } = await supabase
      .from('artist_earnings')
      .select('net_earnings_usd, error_reason')
      .eq('artist_id', 'treasury');
    
    if (treasuryError) {
      console.error('❌ Treasury earnings error:', treasuryError);
    } else {
      const totalTreasuryFees = treasuryEarnings.reduce((sum, e) => sum + parseFloat(e.net_earnings_usd || 0), 0);
      
      await supabase
        .from('artists')
        .update({
          total_earnings_usd: totalTreasuryFees,
          total_sales_count: treasuryEarnings.length
        })
        .eq('id', 'treasury');
      
      console.log(`✅ Treasury: $${totalTreasuryFees.toFixed(4)} total protocol fees (${treasuryEarnings.length} transactions)`);
    }
    
    console.log("\n🎉 DATA MIGRATION COMPLETE!");
    console.log("===========================");
    console.log("📊 Expected results after refresh:");
    console.log("  - Artist earnings: Downloads only (correct)");
    console.log("  - Treasury earnings: All protocol fees (download + swap)");
    console.log("  - LP withdrawable: Will be calculated live from pool reserves");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateToCorrectModel()
  .then(() => {
    console.log("✅ Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  });
