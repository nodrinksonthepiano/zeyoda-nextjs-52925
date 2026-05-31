import { createClient } from '@supabase/supabase-js';
import { createGuardedSigner } from '@/app/utils/guardedSigner';
import { ArtistDownloadsUUPSABI } from '@/app/utils/abis/ArtistDownloadsUUPSABI';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export type MintArtistAssetResult =
  | {
      ok: true;
      message: string;
      mintTx?: string;
      explorerUrl?: string;
      alreadyMinted?: boolean;
      mintSkipped?: boolean;
    }
  | { ok: false; status: number; error: string; details?: string };

export async function mintArtistAssetToken(params: {
  artistId: string;
  assetNumber: number;
  title: string;
  requireMint: boolean;
}): Promise<MintArtistAssetResult> {
  const { artistId, assetNumber, title, requireMint } = params;

  const minterPrivateKey = process.env.MINTER_PRIVATE_KEY;
  const rpcUrl = process.env.SERVER_BASE_SEPOLIA_RPC_URL;

  if (!minterPrivateKey || !rpcUrl) {
    if (requireMint) {
      return {
        ok: false,
        status: 500,
        error: 'Minting is required for launch but minting config is missing',
      };
    }
    return {
      ok: true,
      mintSkipped: true,
      message: `Asset "${title}" uploaded successfully! Asset #${assetNumber} (minting skipped - missing config)`,
    };
  }

  const { data: artistData } = await supabase
    .from('artists')
    .select('download_address, treasury_wallet')
    .eq('id', artistId)
    .single();

  if (!artistData?.download_address) {
    return {
      ok: false,
      status: 400,
      error: `No ERC-1155 contract deployed for artist ${artistId}. Deploy contracts first.`,
    };
  }

  const artistWallet = artistData.treasury_wallet;
  if (!artistWallet) {
    return { ok: false, status: 400, error: 'Artist treasury wallet not configured' };
  }

  try {
    const { ethers } = require('ethers');
    const wallet = await createGuardedSigner(minterPrivateKey, rpcUrl);
    const contract = new ethers.Contract(
      artistData.download_address,
      ArtistDownloadsUUPSABI,
      wallet,
    );

    const existingBalance = await contract.balanceOf(artistWallet, assetNumber);
    if (existingBalance > 0n) {
      return {
        ok: true,
        alreadyMinted: true,
        message: `Asset "${title}" already minted. Asset #${assetNumber}`,
      };
    }

    const tx = await contract.mintDownload(artistWallet, assetNumber, 1);
    const receipt = await tx.wait();

    return {
      ok: true,
      mintTx: receipt.hash,
      explorerUrl: `https://sepolia.basescan.org/tx/${receipt.hash}`,
      message: `Asset "${title}" uploaded and minted! Asset #${assetNumber} - Featured copy minted to artist.`,
    };
  } catch (mintError: unknown) {
    const err = mintError as { message?: string; reason?: string; code?: string };
    return {
      ok: false,
      status: 500,
      error: `Minting failed: ${err.message || 'Unknown error'}`,
      details: err.reason || err.code,
    };
  }
}
