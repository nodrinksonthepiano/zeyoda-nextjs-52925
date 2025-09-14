import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Use service role for server-side uploads
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  console.log('📤 Asset upload API called...');
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const artistId = formData.get('artistId') as string;
    const title = formData.get('title') as string;
    const price = parseFloat(formData.get('price') as string);
    const userAddress = formData.get('userAddress') as string;

    if (!file || !artistId || !title || !userAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('📋 Upload details:', { artistId, title, price, fileSize: file.size, userAddress });

    // 1. Verify user owns this artist
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('*')
      .eq('id', artistId)
      .single();

    if (artistError || !artist) {
      console.error('❌ Artist not found:', artistError);
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // TODO: Add ownership verification here
    // For now, we'll trust the frontend ownership check

    // 2. Upload file to Supabase Storage
    const fileExtension = file.name.split('.').pop();
    const fileName = `${artistId}/${uuidv4()}.${fileExtension}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('artist-assets')
      .upload(fileName, file, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error('❌ File upload failed:', uploadError);
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
    }

    console.log('✅ File uploaded:', uploadData.path);

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('artist-assets')
      .getPublicUrl(uploadData.path);

    console.log('📄 Public URL:', urlData.publicUrl);

    // 3. Get the next asset number for this artist
    const { data: existingAssets, error: assetsError } = await supabase
      .from('artist_assets')
      .select('asset_number')
      .eq('artist_id', artistId)
      .order('asset_number', { ascending: false })
      .limit(1);

    if (assetsError) {
      console.error('❌ Error checking existing assets:', assetsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const nextAssetNumber = existingAssets.length > 0 ? existingAssets[0].asset_number + 1 : 1;

    // 4. Add asset to artist_assets table (match actual schema)
    const { data: assetData, error: assetError } = await supabase
      .from('artist_assets')
      .insert({
        artist_id: artistId,
        asset_number: nextAssetNumber,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size_bytes: file.size,
        price_usd: price,
        metadata: {
          title: title,
          desc: `${title} - uploaded via Zeyoda`
        }
      })
      .select()
      .single();

    if (assetError) {
      console.error('❌ Asset database insert failed:', assetError);
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
    }

    console.log('✅ Asset added to database:', assetData);

    // 5. Mint ERC-1155 token to user's wallet
    try {
      console.log('🪙 Minting ERC-1155 token...');
      
      // Import required modules for minting
      const { ethers } = require('ethers');
      const ArtistDownloadsArtifact = require('../../../artifacts/contracts/ArtistDownloads.sol/ArtistDownloads.json');
      
      // Get deployer wallet for minting
      const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
      const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
      
      if (!deployerPrivateKey || !rpcUrl) {
        console.warn('⚠️ Missing deployer key or RPC URL - skipping minting');
        return NextResponse.json({
          success: true,
          asset: assetData,
          message: `Asset "${title}" uploaded successfully! Asset #${nextAssetNumber} (minting skipped - missing config)`
        });
      }
      
      // Get download contract address
      const { data: artistData } = await supabase
        .from('artists')
        .select('download_address')
        .eq('id', artistId)
        .single();
        
      if (!artistData?.download_address) {
        console.warn('⚠️ No download contract address - skipping minting');
        return NextResponse.json({
          success: true,
          asset: assetData,
          message: `Asset "${title}" uploaded successfully! Asset #${nextAssetNumber} (minting skipped - no contract)`
        });
      }
      
      // Setup provider and contract
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(deployerPrivateKey, provider);
      const contract = new ethers.Contract(artistData.download_address, ArtistDownloadsArtifact.abi, wallet);
      
      // Mint 1 token to user's wallet
      const tx = await contract.mintDownload(userAddress, nextAssetNumber, 1);
      await tx.wait();
      
      console.log(`✅ Minted ERC-1155 token #${nextAssetNumber} to ${userAddress}`);
      console.log('Transaction hash:', tx.hash);
      
      return NextResponse.json({
        success: true,
        asset: assetData,
        mintTx: tx.hash,
        message: `Asset "${title}" uploaded and minted successfully! Asset #${nextAssetNumber}`
      });
      
    } catch (mintError: any) {
      console.error('❌ Minting failed:', mintError);
      // Return success for upload even if minting fails
      return NextResponse.json({
        success: true,
        asset: assetData,
        message: `Asset "${title}" uploaded successfully! Asset #${nextAssetNumber} (minting failed: ${mintError.message})`
      });
    }

  } catch (error: any) {
    console.error('❌ Asset upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
