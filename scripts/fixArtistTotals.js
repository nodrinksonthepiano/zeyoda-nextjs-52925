const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixArtistTotals() {
  console.log("🔧 FIXING ARTIST TOTALS FROM EXISTING EARNINGS RECORDS");
  console.log("====================================================");
  
  try {
    const artists = ['gosheesh', 'jaitea', 'cancakes'];
    
    for (const artistId of artists) {
      console.log(`\n🎨 Processing ${artistId.toUpperCase()}...`);
      
      // Get all earnings for this artist
      const { data: earnings, error: earningsError } = await supabase
        .from('artist_earnings')
        .select('net_earnings_usd, error_reason')
        .eq('artist_id', artistId);
      
      if (earningsError) {
        console.error(`❌ Error fetching earnings for ${artistId}:`, earningsError);
        continue;
      }
      
      console.log(`📊 Found ${earnings.length} earnings records`);
      
      // Separate downloads from LP fees
      const downloadEarnings = earnings.filter(e => e.error_reason !== 'LP_FEE');
      const lpFeeEarnings = earnings.filter(e => e.error_reason === 'LP_FEE');
      
      const totalDownloads = downloadEarnings.reduce((sum, e) => sum + parseFloat(e.net_earnings_usd || 0), 0);
      const totalLPFees = lpFeeEarnings.reduce((sum, e) => sum + parseFloat(e.net_earnings_usd || 0), 0);
      const totalEarnings = totalDownloads + totalLPFees;
      
      console.log(`💰 Download earnings: $${totalDownloads.toFixed(2)} (${downloadEarnings.length} records)`);
      console.log(`💎 LP fee earnings: $${totalLPFees.toFixed(2)} (${lpFeeEarnings.length} records)`);
      console.log(`🎯 Total earnings: $${totalEarnings.toFixed(2)}`);
      
      // Update artist totals
      const { error: updateError } = await supabase
        .from('artists')
        .update({
          total_earnings_usd: totalEarnings,
          total_sales_count: earnings.length
        })
        .eq('id', artistId);
      
      if (updateError) {
        console.error(`❌ Update error for ${artistId}:`, updateError);
      } else {
        console.log(`✅ Updated ${artistId} totals successfully`);
      }
    }
    
    console.log("\n🎉 ARTIST TOTALS FIXED!");
    console.log("======================");
    console.log("Refresh your browser to see corrected earnings!");
    
  } catch (error) {
    console.error("❌ Fix failed:", error);
    process.exit(1);
  }
}

fixArtistTotals()
  .then(() => {
    console.log("✅ Artist totals fix completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fix failed:", error);
    process.exit(1);
  });
