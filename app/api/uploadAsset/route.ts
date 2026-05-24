import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { requireSecret, rateLimit } from '@/app/utils/apiGuard';
import { createGuardedSigner } from '@/app/utils/guardedSigner';
import { isTrustedLaunchSourceUrl } from '@/app/utils/launchIntegrity';
import { getMagicAuthFromBearer } from '@/app/utils/server/magicBearerEmail';
import { normalizeReservedEmail } from '@/app/utils/server/normalizeReservedEmail';
import { assertMagicArtistUploader } from '@/app/utils/server/assertMagicArtistUploader';
import { ArtistDownloadsUUPSABI } from '@/app/utils/abis/ArtistDownloadsUUPSABI';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MAX_BYTES = 280 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const secretCheck = requireSecret(request);
  if (secretCheck) return secretCheck;

  // Public proxy already verified Magic + whitelist; this internal route trusts
  // x-internal-secret (requireSecret above) plus x-verified-email from that proxy.
  const verifiedEmail = (request.headers.get('x-verified-email') ?? '').trim();
  if (!verifiedEmail) {
    return NextResponse.json(
      { error: 'Missing x-verified-email', message: 'Internal proxy must forward verified email' },
      { status: 400 },
    );
  }
  console.log('[uploadAsset] internal proxy caller:', verifiedEmail);

  const rl = rateLimit(request, 'upload-asset', 10, 60_000);
  if (rl) return rl;

  console.log('📤 Asset upload API called...');

  try {
    const contentType = request.headers.get('content-type') || '';
    let artistId: string;
    let title: string;
    let price: number;
    let description: string;
    let userAddress: string;
    let uploadBody: Buffer;
    let mime: string;
    let fileSize: number;
    let fileExtension: string;
    let requestedAssetNumber: number | null = null;
    let requireMint = false;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      artistId = typeof body.artistId === 'string' ? body.artistId.trim() : '';
      title = typeof body.title === 'string' ? body.title.trim() : '';
      userAddress = typeof body.userAddress === 'string' ? body.userAddress.trim() : '';
      const rawDescription = typeof body.description === 'string' ? body.description : '';
      description = rawDescription.trim().replace(/\r\n/g, '\n');
      price = typeof body.price === 'number' ? body.price : parseFloat(String(body.price ?? ''));
      const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
      const parsedAssetNumber = Number(body.assetNumber);
      requestedAssetNumber =
        Number.isInteger(parsedAssetNumber) && parsedAssetNumber > 0 ? parsedAssetNumber : null;
      requireMint = body.requireMint === true;

      if (!artistId || !title || !userAddress || !isTrustedLaunchSourceUrl(sourceUrl)) {
        return NextResponse.json(
          { error: 'Missing artistId, title, userAddress, or trusted Supabase https sourceUrl' },
          { status: 400 },
        );
      }

      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: 'price must be greater than 0' }, { status: 400 });
      }

      const upstream = await fetch(sourceUrl, { redirect: 'follow' });
      if (!upstream.ok) {
        return NextResponse.json(
          { error: `Could not fetch media: HTTP ${upstream.status}` },
          { status: 502 },
        );
      }

      const lenHeader = upstream.headers.get('content-length');
      if (lenHeader && Number(lenHeader) > MAX_BYTES) {
        return NextResponse.json({ error: 'Asset too large' }, { status: 413 });
      }

      const buf = await upstream.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) {
        return NextResponse.json({ error: 'Asset too large' }, { status: 413 });
      }

      uploadBody = Buffer.from(buf);
      fileSize = uploadBody.length;
      mime =
        upstream.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
      const urlPath = new URL(sourceUrl).pathname;
      fileExtension = urlPath.includes('.')
        ? (urlPath.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin'
        : 'bin';

      console.log('📋 JSON upload (HTTPS source):', { artistId, title, price, fileSize });
    } else {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      artistId = formData.get('artistId') as string;
      title = (formData.get('title') as string) || '';
      userAddress = formData.get('userAddress') as string;
      const rawDescription = (formData.get('description') as string) || '';
      description = rawDescription.trim().replace(/\r\n/g, '\n');
      price = parseFloat(formData.get('price') as string);
      const parsedAssetNumber = Number(formData.get('assetNumber'));
      requestedAssetNumber =
        Number.isInteger(parsedAssetNumber) && parsedAssetNumber > 0 ? parsedAssetNumber : null;
      requireMint = formData.get('requireMint') === 'true';

      if (!file || !artistId || !title || !userAddress) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: 'price must be greater than 0' }, { status: 400 });
      }

      const ab = await file.arrayBuffer();
      uploadBody = Buffer.from(ab);
      fileSize = uploadBody.length;
      mime = file.type || 'application/octet-stream';
      fileExtension = file.name.split('.').pop() || 'bin';

      console.log('📋 Form upload:', { artistId, title, price, fileSize });
    }

    const auth = await getMagicAuthFromBearer(request);
    if (!auth) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Valid Magic DID token required',
        },
        { status: 401 },
      );
    }

    const bearerIdentity = auth.email?.trim() || auth.issuer?.trim();
    if (!bearerIdentity) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Magic session lacks email or issuer — cannot bind to proxy',
        },
        { status: 401 },
      );
    }

    if (normalizeReservedEmail(bearerIdentity) !== normalizeReservedEmail(verifiedEmail)) {
      return NextResponse.json(
        {
          error: 'Identity mismatch',
          message: 'Token identity does not match verified proxy caller',
        },
        { status: 403 },
      );
    }

    const artistUploadForbidden = await assertMagicArtistUploader(request, artistId, auth);
    if (artistUploadForbidden) return artistUploadForbidden;

    const fileName = `${artistId}/${uuidv4()}.${fileExtension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('artist-assets')
      .upload(fileName, uploadBody, { contentType: mime });

    if (uploadError) {
      console.error('❌ File upload failed:', uploadError);
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
    }

    console.log('✅ File uploaded:', uploadData.path);

    const { data: urlData } = supabase.storage.from('artist-assets').getPublicUrl(uploadData.path);

    console.log('📄 Public URL:', urlData.publicUrl);

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

    const assetNumber =
      requestedAssetNumber ?? (existingAssets.length > 0 ? existingAssets[0].asset_number + 1 : 1);

    const assetRecord = {
      artist_id: artistId,
      asset_number: assetNumber,
      file_url: urlData.publicUrl,
      file_type: mime,
      file_size_bytes: fileSize,
      price_usd: price,
      metadata: {
        title: title,
        description: description || `${title} - uploaded via Zeyoda`,
        desc: description || `${title} - uploaded via Zeyoda`,
      },
    };

    const { data: existingTarget, error: existingTargetError } = requestedAssetNumber
      ? await supabase
          .from('artist_assets')
          .select('id, asset_number')
          .eq('artist_id', artistId)
          .eq('asset_number', assetNumber)
          .maybeSingle()
      : { data: null, error: null };

    if (existingTargetError) {
      console.error('❌ Error checking target asset:', existingTargetError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const writeQuery = existingTarget
      ? supabase
          .from('artist_assets')
          .update(assetRecord)
          .eq('artist_id', artistId)
          .eq('asset_number', assetNumber)
          .select()
          .single()
      : supabase.from('artist_assets').insert(assetRecord).select().single();

    const { data: assetData, error: assetError } = await writeQuery;

    if (assetError) {
      console.error('❌ Asset database insert failed:', assetError);
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
    }

    console.log('✅ Asset written to database:', assetData);

    try {
      console.log('🪙 Minting ERC-1155 token...');

      const { ethers } = require('ethers');

      const minterPrivateKey = process.env.MINTER_PRIVATE_KEY;
      const rpcUrl = process.env.SERVER_BASE_SEPOLIA_RPC_URL;

      if (!minterPrivateKey || !rpcUrl) {
        console.warn('⚠️ Missing deployer key or RPC URL - skipping minting');
        if (requireMint) {
          return NextResponse.json(
            {
              success: false,
              error: 'Minting is required for launch but minting config is missing',
              asset: assetData,
            },
            { status: 500 },
          );
        }
        return NextResponse.json({
          success: true,
          asset: assetData,
          message: `Asset "${title}" uploaded successfully! Asset #${assetNumber} (minting skipped - missing config)`,
        });
      }

      const { data: artistData } = await supabase
        .from('artists')
        .select('download_address, treasury_wallet')
        .eq('id', artistId)
        .single();

      if (!artistData?.download_address) {
        console.error('❌ No download contract address');
        return NextResponse.json(
          {
            success: false,
            error: `No ERC-1155 contract deployed for artist ${artistId}. Deploy contracts first.`,
          },
          { status: 400 },
        );
      }

      const artistWallet = artistData.treasury_wallet;
      if (!artistWallet) {
        console.error('❌ Artist treasury wallet not found');
        return NextResponse.json(
          {
            success: false,
            error: 'Artist treasury wallet not configured',
          },
          { status: 400 },
        );
      }

      const wallet = await createGuardedSigner(minterPrivateKey, rpcUrl);
      const contract = new ethers.Contract(
        artistData.download_address,
        ArtistDownloadsUUPSABI,
        wallet,
      );

      const existingBalance = await contract.balanceOf(artistWallet, assetNumber);
      if (existingBalance > 0n) {
        console.log(`✅ Asset #${assetNumber} already minted (balance: ${existingBalance})`);
        return NextResponse.json({
          success: true,
          asset: assetData,
          message: `Asset "${title}" already minted. Asset #${assetNumber}`,
          alreadyMinted: true,
        });
      }

      console.log(`🎨 Minting featured copy to artist: ${artistWallet}`);
      const tx = await contract.mintDownload(artistWallet, assetNumber, 1);
      const receipt = await tx.wait();

      console.log(`✅ Minted ERC-1155 token #${assetNumber} to ${artistWallet}`);
      console.log(`   Transaction: ${receipt.hash}`);

      return NextResponse.json({
        success: true,
        asset: assetData,
        mintTx: receipt.hash,
        explorerUrl: `https://sepolia.basescan.org/tx/${receipt.hash}`,
        message: `Asset "${title}" uploaded and minted! Asset #${assetNumber} - Featured copy minted to artist.`,
      });
    } catch (mintError: any) {
      console.error('❌ Minting failed:', mintError);
      return NextResponse.json(
        {
          success: false,
          error: `Minting failed: ${mintError.message}`,
          details: mintError.reason || mintError.code,
          asset: assetData,
        },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error('❌ Asset upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
