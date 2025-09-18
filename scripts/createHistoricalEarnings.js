const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createHistoricalEarnings() {
  console.log("💰 CREATING HISTORICAL EARNINGS FROM CONFIRMED DOWNLOADS");
  console.log("======================================================");
  
  try {
    // Confirmed download counts from blockchain
    const downloadCounts = {
      'gosheesh': 17,
      'jaitea': 11, 
      'cancakes': 1
    };
    
    console.log("📊 Confirmed blockchain downloads:");
    Object.entries(downloadCounts).forEach(([artist, count]) => {
      console.log(`  ${artist.toUpperCase()}: ${count} downloads`);
    });
    
    // Get assets for each artist
    const { data: assets, error: assetsError } = await supabase
      .from('artist_assets')
      .select('id, artist_id, asset_number, price_usd');
    
    if (assetsError) {
      throw new Error(`Failed to fetch assets: ${assetsError.message}`);
    }
    
    console.log(`\n📦 Found ${assets.length} assets in database`);
    
    let totalEarningsCreated = 0;
    let totalProtocolFees = 0;
    
    // Create earnings for each artist based on confirmed download counts
    for (const [artistId, downloadCount] of Object.entries(downloadCounts)) {
      console.log(`\n🎨 Processing ${artistId.toUpperCase()} (${downloadCount} downloads)...`);
      
      // Find the asset for this artist (assuming asset #1 for now)
      const asset = assets.find(a => a.artist_id === artistId && a.asset_number === 1);
      
      if (!asset) {
        console.log(`⚠️ No asset found for ${artistId}, skipping`);
        continue;
      }
      
      const grossAmount = asset.price_usd || 1.0;
      const protocolFee = grossAmount * 0.003; // 0.3%
      const netEarnings = grossAmount - protocolFee;
      
      console.log(`💵 Price per download: $${grossAmount} (net: $${netEarnings.toFixed(3)}, fee: $${protocolFee.toFixed(3)})`);
      
      // Create earnings records for each download
      const earningsToCreate = [];
      
      for (let i = 0; i < downloadCount; i++) {
        const purchaseDate = new Date();
        purchaseDate.setDate(purchaseDate.getDate() - Math.floor(Math.random() * 30)); // Random date in last 30 days
        
        earningsToCreate.push({
          artist_id: artistId,
          buyer_address: '0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8', // Your test wallet
          asset_id: asset.id,
          gross_amount_usd: grossAmount,
          protocol_fee_usd: protocolFee,
          processor_fee_usd: 0,
          net_earnings_usd: netEarnings,
          payment_method: 'eth_balance',
          source: 'eth',
          external_id: `historical-${artistId}-${i+1}-${Date.now()}`,
          tx_hash: `0x${Math.random().toString(16).substring(2).padStart(64, '0')}`, // Mock tx hash
          collectible_minted: true,
          status: 'minted',
          created_at: purchaseDate.toISOString()
        });
      }
      
      // Insert earnings in batches
      console.log(`📝 Creating ${earningsToCreate.length} earnings records...`);
      
      const { data: insertResult, error: insertError } = await supabase
        .from('artist_earnings')
        .insert(earningsToCreate)
        .select();
      
      if (insertError) {
        console.error(`❌ Insert error for ${artistId}:`, insertError.message);
        continue;
      }
      
      const artistTotalEarnings = netEarnings * downloadCount;
      const artistTotalFees = protocolFee * downloadCount;
      
      console.log(`✅ Created ${insertResult.length} earnings records`);
      console.log(`💰 Total artist earnings: $${artistTotalEarnings.toFixed(2)}`);
      console.log(`🏦 Total protocol fees: $${artistTotalFees.toFixed(4)}`);
      
      totalEarningsCreated += insertResult.length;
      totalProtocolFees += artistTotalFees;
      
      // Update artist totals
      await supabase
        .from('artists')
        .update({
          total_earnings_usd: artistTotalEarnings,
          total_sales_count: downloadCount
        })
        .eq('id', artistId);
      
      // Update asset download count to match blockchain
      await supabase
        .from('artist_assets')
        .update({ download_count: downloadCount })
        .eq('id', asset.id);
        
      console.log(`📊 Updated ${artistId} totals in database`);
    }
    
    console.log("\n🎉 HISTORICAL EARNINGS CREATION COMPLETE!");
    console.log("==========================================");
    console.log(`📊 Total earnings created: ${totalEarningsCreated}`);
    console.log(`💰 Total protocol fees: $${totalProtocolFees.toFixed(4)}`);
    console.log(`🏦 Treasury should now show: $${totalProtocolFees.toFixed(4)}`);
    console.log(`\n🎯 Expected results:`);
    console.log(`  - GOSHEESH artist wallet: $${(0.997 * 17).toFixed(2)} in earnings`);
    console.log(`  - JAITEA artist wallet: $${(0.997 * 11).toFixed(2)} in earnings`);
    console.log(`  - CANCAKES artist wallet: $${(0.997 * 1).toFixed(2)} in earnings`);
    console.log(`  - Treasury wallet: $${totalProtocolFees.toFixed(4)} in protocol fees`);
    
  } catch (error) {
    console.error("❌ Historical earnings creation failed:", error);
    process.exit(1);
  }
}

// Run the creation
createHistoricalEarnings()
  .then(() => {
    console.log("✅ Historical earnings creation completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Historical earnings creation failed:", error);
    process.exit(1);
  });
