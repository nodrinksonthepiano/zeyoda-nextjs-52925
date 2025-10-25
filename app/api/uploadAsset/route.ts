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
    const rawDescription = (formData.get('description') as string) || '';
    const description = rawDescription.trim().replace(/\r\n/g, '\n'); // Sanitize whitespace
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
          description: description || `${title} - uploaded via Zeyoda`, // New field
          desc: description || `${title} - uploaded via Zeyoda` // Keep for backward compat (remove after 1 week)
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
      
      // Get minter wallet for minting
      const minterPrivateKey = process.env.MINTER_PRIVATE_KEY;
      const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
      
      if (!minterPrivateKey || !rpcUrl) {
        console.warn('⚠️ Missing deployer key or RPC URL - skipping minting');
        return NextResponse.json({
          success: true,
          asset: assetData,
          message: `Asset "${title}" uploaded successfully! Asset #${nextAssetNumber} (minting skipped - missing config)`
        });
      }
      
      // Get download contract address and treasury wallet
      const { data: artistData } = await supabase
        .from('artists')
        .select('download_address, treasury_wallet')
        .eq('id', artistId)
        .single();
        
      if (!artistData?.download_address) {
        console.error('❌ No download contract address');
        return NextResponse.json({
          success: false,
          error: `No ERC-1155 contract deployed for artist ${artistId}. Deploy contracts first.`
        }, { status: 400 });
      }
      
      const artistWallet = artistData.treasury_wallet;
      if (!artistWallet) {
        console.error('❌ Artist treasury wallet not found');
        return NextResponse.json({
          success: false,
          error: 'Artist treasury wallet not configured'
        }, { status: 400 });
      }
      
      // Setup provider and contract
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(minterPrivateKey, provider);
      const contract = new ethers.Contract(artistData.download_address, ArtistDownloadsArtifact.abi, wallet);
      
      // Check if already minted (idempotency)
      const existingBalance = await contract.balanceOf(artistWallet, nextAssetNumber);
      if (existingBalance > 0n) {
        console.log(`✅ Asset #${nextAssetNumber} already minted (balance: ${existingBalance})`);
        return NextResponse.json({
          success: true,
          asset: assetData,
          message: `Asset "${title}" already minted. Asset #${nextAssetNumber}`,
          alreadyMinted: true
        });
      }
      
      // Mint 1 "featured copy" to artist's treasury wallet
      console.log(`🎨 Minting featured copy to artist: ${artistWallet}`);
      const tx = await contract.mintDownload(artistWallet, nextAssetNumber, 1);
      const receipt = await tx.wait();
      
      console.log(`✅ Minted ERC-1155 token #${nextAssetNumber} to ${artistWallet}`);
      console.log(`   Transaction: ${receipt.hash}`);
      
      return NextResponse.json({
        success: true,
        asset: assetData,
        mintTx: receipt.hash,
        explorerUrl: `https://sepolia.basescan.org/tx/${receipt.hash}`,
        message: `Asset "${title}" uploaded and minted! Asset #${nextAssetNumber} - Featured copy minted to artist.`
      });
      
    } catch (mintError: any) {
      console.error('❌ Minting failed:', mintError);
      // Return FAILURE if minting fails
      return NextResponse.json({
        success: false,
        error: `Minting failed: ${mintError.message}`,
        details: mintError.reason || mintError.code,
        asset: assetData
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ Asset upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
