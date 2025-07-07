import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getArtistContracts } from '@/app/utils/addressRegistry';

// --- Constants ---
const ERC1155_ABI = ["function balanceOf(address owner, uint256 id) view returns (uint256)"];

// --- Environment & Provider ---
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const provider = new ethers.JsonRpcProvider(RPC_URL);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get('artist');
  const userAddress = searchParams.get('addr');
  const assetNumber = searchParams.get('asset');

  // 1. Input Validation
  if (!artistId || !userAddress || !assetNumber) {
    return NextResponse.json({ error: 'Missing required query parameters: artist, addr, asset' }, { status: 400 });
  }

  if (!ethers.isAddress(userAddress)) {
    return NextResponse.json({ error: 'malformed user address' }, { status: 400 });
  }
  
  const assetNum = parseInt(assetNumber, 10);
  if (isNaN(assetNum)) {
      return NextResponse.json({ error: 'asset must be a number' }, { status: 400 });
  }

  // 2. On-Chain Verification
  try {
    const artistContracts = getArtistContracts(artistId);
    if (!artistContracts?.download) {
      return NextResponse.json({ error: `Configuration not found for artist: ${artistId}` }, { status: 404 });
    }

    const contract = new ethers.Contract(artistContracts.download, ERC1155_ABI, provider);
    const balance = await contract.balanceOf(userAddress, assetNum);
    const owned = balance > 0n;

    return NextResponse.json({ owned });

  } catch (error: any) {
    console.error(`Ownership verification failed for ${userAddress} on ${artistId}#${assetNumber}:`, error.message);
    return NextResponse.json(
      { owned: false, error: error.reason || 'Contract query failed' },
      { status: 502 }
    );
  }
} 