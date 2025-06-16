import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import ArtistockABI from '../../../contracts/Artistock.json';

export async function POST(request: Request) {
  const { contractAddress, userAddress, amount } = await request.json();

  if (!contractAddress || !userAddress || !amount) {
    return NextResponse.json({ message: 'Missing required parameters' }, { status: 400 });
  }

  const minterPrivateKey = process.env.MINTER_PRIVATE_KEY;
  if (!minterPrivateKey) {
    console.error("MINTER_PRIVATE_KEY not set in .env.local");
    return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_RPC;
  if (!rpcUrl) {
    console.error("NEXT_PUBLIC_RPC not set");
    return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const minterWallet = new ethers.Wallet(minterPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, ArtistockABI.abi, minterWallet);

    console.log(`Minting ${amount} tokens for ${userAddress} on contract ${contractAddress}...`);

    const tx = await contract.mint(userAddress, amount);
    await tx.wait(); // Wait for the transaction to be mined

    console.log('Minting successful! Transaction hash:', tx.hash);
    return NextResponse.json({ message: 'Minting successful', txHash: tx.hash }, { status: 200 });

  } catch (error) {
    console.error('Error minting tokens:', error);
    return NextResponse.json({ message: 'Internal Server Error while minting' }, { status: 500 });
  }
} 