const { ethers } = require("hardhat");
const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Contract ABI for DownloadMinted events
const DOWNLOAD_ABI = [
  "event DownloadMinted(address indexed user, uint256 indexed assetId, uint256 amount, string artistId)"
];

async function backfillEarningsChunked() {
  console.log("🔍 BACKFILLING EARNINGS (CHUNKED FOR FREE TIER)");
  console.log("===============================================");
  
  try {
    // Get all artist registry data
    const { data: registry, error: registryError } = await supabase
      .from('artist_registry')
      .select('id, downloads, treasury_wallet');
    
    if (registryError) {
      throw new Error(`Failed to fetch registry: ${registryError.message}`);
    }
    
    console.log(`📋 Found ${registry.length} artists in registry`);
    
    // Get all artist assets for mapping
    const { data: assets, error: assetsError } = await supabase
      .from('artist_assets')
      .select('id, artist_id, asset_number, price_usd');
    
    if (assetsError) {
      throw new Error(`Failed to fetch assets: ${assetsError.message}`);
    }
    
    console.log(`📦 Found ${assets.length} assets`);
    
    // Setup provider
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    console.log(`🔗 Current block: ${currentBlock}`);
    
    let totalSalesFound = 0;
    let totalProtocolFees = 0;
    
    // Process each artist
    for (const artist of registry) {
      if (!artist.downloads) {
        console.log(`⚠️ No download contract for ${artist.id}, skipping`);
        continue;
      }
      
      console.log(`\n🎨 Processing ${artist.id.toUpperCase()}...`);
      console.log(`📄 Download contract: ${artist.downloads}`);
      
      try {
        // Create contract instance
        const contract = new ethers.Contract(artist.downloads, DOWNLOAD_ABI, provider);
        
        // Query in chunks of 10,000 blocks (well under the limit)
        const CHUNK_SIZE = 5000; // Conservative chunk size
        let allEvents = [];
        
        console.log("🔍 Fetching DownloadMinted events in chunks...");
        
        // Start from a reasonable deployment block (Base Sepolia is relatively new)
        const startBlock = Math.max(0, currentBlock - 50000); // Last ~50k blocks
        
        for (let fromBlock = startBlock; fromBlock < currentBlock; fromBlock += CHUNK_SIZE) {
          const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
          
          try {
            console.log(`  📊 Scanning blocks ${fromBlock} to ${toBlock}...`);
            
            const chunkEvents = await contract.queryFilter(
              contract.filters.DownloadMinted(),
              fromBlock,
              toBlock
            );
            
            if (chunkEvents.length > 0) {
              console.log(`    ✅ Found ${chunkEvents.length} events in this chunk`);
              allEvents = allEvents.concat(chunkEvents);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (chunkError) {
            console.log(`    ⚠️ Chunk ${fromBlock}-${toBlock} failed: ${chunkError.message}`);
            // Continue with next chunk
          }
        }
        
        console.log(`📊 Total events found for ${artist.id}: ${allEvents.length}`);
        
        // Process each event
        for (const event of allEvents) {
          const { user, assetId, amount, artistId } = event.args;
          const txHash = event.transactionHash;
          const blockNumber = event.blockNumber;
          
          // Get block timestamp
          const block = await provider.getBlock(blockNumber);
          const timestamp = new Date(block.timestamp * 1000);
          
          console.log(`💰 Processing sale: ${user.slice(0,8)}... → Asset #${assetId} (${amount} tokens)`);
          
          // Find matching asset in our database
          const asset = assets.find(a => a.artist_id === artist.id && a.asset_number === parseInt(assetId));
          
          if (!asset) {
            console.log(`⚠️ No asset found for ${artist.id} asset #${assetId}, skipping`);
            continue;
          }
          
          // Calculate fees (0.3% protocol fee)
          const grossAmount = asset.price_usd || 1.0;
          const protocolFee = grossAmount * 0.003;
          const netEarnings = grossAmount - protocolFee;
          
          // Generate external_id from transaction hash
          const externalId = `backfill-${txHash}`;
          
          try {
            // Insert into artist_earnings table
            const { data: insertResult, error: insertError } = await supabase
              .from('artist_earnings')
              .insert({
                artist_id: artist.id,
                buyer_address: user.toLowerCase(),
                asset_id: asset.id,
                gross_amount_usd: grossAmount,
                protocol_fee_usd: protocolFee,
                processor_fee_usd: 0,
                net_earnings_usd: netEarnings,
                payment_method: 'eth_balance',
                source: 'eth',
                external_id: externalId,
                tx_hash: txHash,
                collectible_minted: true,
                status: 'minted',
                created_at: timestamp.toISOString()
              })
              .select();
            
            if (insertError) {
              if (insertError.code === '23505') {
                console.log(`   ⚠️ Duplicate sale (already backfilled): ${txHash}`);
              } else {
                console.error(`   ❌ Insert error:`, insertError.message);
              }
              continue;
            }
            
            console.log(`   ✅ Sale recorded: $${grossAmount} (net: $${netEarnings.toFixed(3)}, fee: $${protocolFee.toFixed(3)})`);
            totalSalesFound++;
            totalProtocolFees += protocolFee;
            
            // Update asset download count
            await supabase
              .from('artist_assets')
              .update({ download_count: (asset.download_count || 0) + parseInt(amount) })
              .eq('id', asset.id);
              
          } catch (dbError) {
            console.error(`   ❌ Database error:`, dbError.message);
          }
        }
        
      } catch (contractError) {
        console.error(`❌ Error processing ${artist.id}:`, contractError.message);
      }
    }
    
    // Update artist totals
    console.log("\n📊 UPDATING ARTIST TOTALS...");
    for (const artist of registry) {
      const { data: earnings } = await supabase
        .from('artist_earnings')
        .select('net_earnings_usd')
        .eq('artist_id', artist.id);
      
      if (earnings && earnings.length > 0) {
        const totalEarnings = earnings.reduce((sum, e) => sum + parseFloat(e.net_earnings_usd), 0);
        const totalSales = earnings.length;
        
        await supabase
          .from('artists')
          .update({
            total_earnings_usd: totalEarnings,
            total_sales_count: totalSales
          })
          .eq('id', artist.id);
        
        console.log(`✅ ${artist.id}: $${totalEarnings.toFixed(2)} (${totalSales} sales)`);
      }
    }
    
    console.log("\n🎉 BACKFILL COMPLETE!");
    console.log("====================");
    console.log(`📊 New sales found: ${totalSalesFound}`);
    console.log(`💰 New protocol fees: $${totalProtocolFees.toFixed(4)}`);
    console.log(`🏦 Treasury should show updated totals`);
    
  } catch (error) {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  }
}

// Run the backfill
backfillEarningsChunked()
  .then(() => {
    console.log("✅ Chunked backfill completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Chunked backfill failed:", error);
    process.exit(1);
  });
