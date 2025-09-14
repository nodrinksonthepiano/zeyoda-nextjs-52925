import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getArtistContracts } from '../../utils/addressRegistryFallback';

// ERC-1155 ABI for minting download tokens
const DOWNLOAD_CONTRACT_ABI = [
  "function mintDownload(address user, uint256 assetId, uint256 amount) external",
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function owner() view returns (address)"
];

// RPC provider for contract calls
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC, {
  chainId: 84532,
  name: "base-sepolia",
  ensAddress: null // Disable ENS
});

interface MintRequest {
  artistId: string;
  userAddress: string;
  assetId: number;
  txHash: string;
  amount: number;
}

export async function POST(request: NextRequest) {
  console.log('📨 Mint API called - starting request processing...');
  
  try {
    const body: MintRequest = await request.json();
    const { artistId, userAddress, assetId, txHash, amount } = body;
    
    console.log('🔍 Raw request body:', {
      artistId,
      userAddress,
      assetId,
      txHash,
      amount,
      bodyType: typeof body
    });
    
    // 1. Validate request schema
    if (!artistId || !userAddress || !assetId || !txHash || !amount) {
      const missingFields = [];
      if (!artistId) missingFields.push('artistId');
      if (!userAddress) missingFields.push('userAddress'); 
      if (!assetId) missingFields.push('assetId');
      if (!txHash) missingFields.push('txHash');
      if (!amount) missingFields.push('amount');
      
      console.error('❌ Validation failed - missing fields:', missingFields);
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validate Ethereum address
    if (!ethers.isAddress(userAddress)) {
      console.error('❌ Invalid user address format:', userAddress);
      return NextResponse.json(
        { error: 'Invalid user address format' },
        { status: 400 }
      );
    }
    
    // Validate artist exists in registry
    const artistContracts = getArtistContracts(artistId);
    console.log('🎨 Artist contracts lookup:', {
      artistId,
      found: !!artistContracts,
      contracts: artistContracts
    });
    
    if (!artistContracts?.downloads) {
      console.error('❌ Download contract not found for artist:', artistId);
      return NextResponse.json(
        { error: `Download contract not found for artist: ${artistId}` },
        { status: 404 }
      );
    }
    
    console.log(`🪙 Processing mint request for ${artistId} asset ${assetId} → ${userAddress}`);
    
    // 2. Verify transaction exists and is confirmed
    console.log('🔗 Verifying transaction on blockchain...');
    
    // Add retry logic for transaction verification (handles timing issues)
    let verificationAttempts = 0;
    const maxAttempts = 30; // Increased from 10 to 30 attempts
    const retryDelay = 3000; // Increased from 2 to 3 seconds between retries
    
    while (verificationAttempts < maxAttempts) {
      try {
        const tx = await provider.getTransaction(txHash);
        console.log(`🔍 Transaction lookup attempt ${verificationAttempts + 1}:`, {
          found: !!tx,
          txHash,
          network: process.env.NEXT_PUBLIC_RPC
        });
        
        if (!tx) {
          verificationAttempts++;
          if (verificationAttempts < maxAttempts) {
            console.log(`⏳ Transaction not found yet (attempt ${verificationAttempts}/${maxAttempts})`);
            console.log(`   This is normal! New transactions take time to be visible.`);
            console.log(`   Waiting ${retryDelay}ms before next check...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error('❌ Transaction not found after maximum retries:', {
              txHash,
              attempts: maxAttempts,
              totalTimeWaited: `${(maxAttempts * retryDelay) / 1000} seconds`
            });
            return NextResponse.json(
              { 
                error: 'Transaction not found on blockchain',
                details: {
                  txHash,
                  attempts: maxAttempts,
                  timeWaited: `${(maxAttempts * retryDelay) / 1000} seconds`,
                  suggestion: 'The swap transaction may need more time to be confirmed. Please wait a minute and try again.'
                }
              },
              { status: 400 }
            );
          }
        }
        
        // Transaction found, now check if it's confirmed
        const receipt = await provider.getTransactionReceipt(txHash);
        console.log(`📋 Receipt lookup (attempt ${verificationAttempts + 1}):`, {
          found: !!receipt,
          status: receipt?.status,
          blockNumber: receipt?.blockNumber,
          confirmations: receipt?.confirmations
        });
        
        if (!receipt) {
          verificationAttempts++;
          if (verificationAttempts < maxAttempts) {
            console.log(`⏳ Transaction pending confirmation (attempt ${verificationAttempts}/${maxAttempts})`);
            console.log(`   This is normal! Transactions need multiple confirmations.`);
            console.log(`   Waiting ${retryDelay}ms before next check...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error('❌ Transaction not confirmed after maximum retries:', {
              txHash,
              attempts: maxAttempts,
              totalTimeWaited: `${(maxAttempts * retryDelay) / 1000} seconds`
            });
            return NextResponse.json(
              { 
                error: 'Transaction still pending confirmation',
                details: {
                  txHash,
                  attempts: maxAttempts,
                  timeWaited: `${(maxAttempts * retryDelay) / 1000} seconds`,
                  suggestion: 'The network is experiencing delays. Please wait a minute and try again.'
                }
              },
              { status: 400 }
            );
          }
        }
        
        if (receipt.status !== 1) {
          console.error('❌ Transaction failed on chain:', {
            txHash,
            status: receipt.status,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString()
          });
          return NextResponse.json(
            { 
              error: 'Transaction failed on blockchain',
              details: {
                txHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed?.toString(),
                suggestion: 'The swap transaction failed. Please try the swap again.'
              }
            },
            { status: 400 }
          );
        }
        
        // Wait for at least 1 confirmation
        const confirmations = await receipt.confirmations();
        if (confirmations < 1) {
          verificationAttempts++;
          if (verificationAttempts < maxAttempts) {
            console.log(`⏳ Waiting for confirmations (current: ${confirmations})`);
            console.log(`   This is normal! New blocks take time to be confirmed.`);
            console.log(`   Waiting ${retryDelay}ms before next check...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
        
        console.log(`✅ Transaction verified:`, {
          txHash,
          blockNumber: receipt.blockNumber,
          confirmations,
          gasUsed: receipt.gasUsed?.toString()
        });
        break; // Success, exit the retry loop
        
      } catch (error) {
        console.error(`❌ Verification error (attempt ${verificationAttempts + 1}):`, error);
        verificationAttempts++;
        
        if (verificationAttempts < maxAttempts) {
          console.log(`⏳ Retrying verification in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          return NextResponse.json(
            { 
              error: 'Transaction verification failed',
              details: {
                txHash,
                attempts: maxAttempts,
                timeWaited: `${(maxAttempts * retryDelay) / 1000} seconds`,
                error: error instanceof Error ? error.message : 'Unknown error',
                suggestion: 'The network may be congested. Please wait and try again.'
              }
            },
            { status: 400 }
          );
        }
      }
    }
    
    // 3. Load owner wallet from server-side environment
    const ownerPrivateKey = process.env.DOWNLOAD_MINTER_PK;
    if (!ownerPrivateKey) {
      console.error('❌ DOWNLOAD_MINTER_PK not configured in environment');
      return NextResponse.json(
        { error: 'Server configuration error: DOWNLOAD_MINTER_PK missing' },
        { status: 500 }
      );
    }
    
    console.log('🔑 Environment configured, creating signer...');
    
    // 4. Create signer and contract instance
    const ownerWallet = new ethers.Wallet(ownerPrivateKey, provider);
    const downloadContract = new ethers.Contract(
      artistContracts.downloads,
      DOWNLOAD_CONTRACT_ABI,
      ownerWallet
    );
    
    console.log('👤 Signer created:', {
      signerAddress: ownerWallet.address,
      contractAddress: artistContracts.downloads
    });
    
    // Verify the signer is actually the contract owner
    try {
      const contractOwner = await downloadContract.owner();
      console.log('🔍 Contract ownership check:', {
        contractOwner,
        signerAddress: ownerWallet.address,
        matches: contractOwner.toLowerCase() === ownerWallet.address.toLowerCase()
      });
      
      if (contractOwner.toLowerCase() !== ownerWallet.address.toLowerCase()) {
        console.error(`❌ Wallet mismatch: Contract owner is ${contractOwner}, signer is ${ownerWallet.address}`);
        return NextResponse.json(
          { error: 'Server wallet is not contract owner' },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('❌ Owner verification failed:', error);
      return NextResponse.json(
        { error: `Failed to verify contract ownership: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
    
    // 5. Check if user already owns this download (prevent duplicate minting)
    try {
      const existingBalance = await downloadContract.balanceOf(userAddress, assetId);
      console.log('📊 Existing balance check:', {
        userAddress,
        assetId,
        balance: existingBalance.toString()
      });
      
      if (existingBalance > 0) {
        console.log(`⚠️ User already owns ${existingBalance} of asset ${assetId}`);
        
        // 🧪 TESTING OVERRIDE: Allow minting additional tokens for testing purposes
        // Remove this in production to prevent duplicate minting
        console.log('🧪 TESTING MODE: Allowing additional mint for testing purposes');
        console.log('💡 In production, this would return: User already owns this download');
        
        // Return success without minting for now (to avoid spam)
        // Uncomment the lines below to actually prevent duplicate minting in production:
        /*
        return NextResponse.json({
          success: true,
          message: 'User already owns this download',
          alreadyOwned: true,
          balance: Number(existingBalance)
        });
        */
      }
    } catch (error) {
      console.warn('⚠️ Balance check failed, proceeding with mint:', error);
    }
    
    // 6. Execute the mint transaction
    console.log(`🪙 Minting ${amount} download token(s) for asset ${assetId}...`);
    
    try {
      const mintTx = await downloadContract.mintDownload(
        userAddress,
        assetId,
        amount,
        {
          gasLimit: 150000 // Conservative gas limit
        }
      );
      
      console.log(`⏳ Mint transaction submitted: ${mintTx.hash}`);
      console.log('📊 Mint transaction details:', {
        hash: mintTx.hash,
        from: mintTx.from,
        to: mintTx.to,
        gasLimit: mintTx.gasLimit?.toString(),
        gasPrice: mintTx.gasPrice?.toString()
      });
      
      // Wait for confirmation
      const mintReceipt = await mintTx.wait();
      
      if (mintReceipt.status !== 1) {
        throw new Error('Mint transaction failed on-chain');
      }
      
      console.log(`✅ Download token minted successfully!`);
      console.log(`   Transaction: ${mintTx.hash}`);
      console.log(`   Block: ${mintReceipt.blockNumber}`);
      console.log(`   Gas used: ${mintReceipt.gasUsed}`);
      console.log(`   Events emitted: ${mintReceipt.logs.length}`);
      
      // 7. Return success response with transaction hash
      return NextResponse.json({
        success: true,
        mintTxHash: mintTx.hash,
        blockNumber: mintReceipt.blockNumber,
        gasUsed: Number(mintReceipt.gasUsed),
        message: `Successfully minted ${amount} download token(s) for ${artistId} asset ${assetId}`
      });
      
    } catch (mintError: any) {
      console.error('❌ Mint transaction failed:', {
        error: mintError,
        message: mintError.message,
        code: mintError.code,
        reason: mintError.reason,
        data: mintError.data
      });
      
      // Extract the actual revert reason if available
      let errorMessage = 'Mint failed';
      
      if (mintError.reason) {
        errorMessage = `Contract revert: ${mintError.reason}`;
      } else if (mintError.message?.includes('execution reverted')) {
        // Try to extract revert reason from message
        const revertMatch = mintError.message.match(/execution reverted: (.+)/);
        if (revertMatch) {
          errorMessage = `Contract revert: ${revertMatch[1]}`;
        } else {
          errorMessage = 'Contract execution reverted (no reason provided)';
        }
      } else if (mintError.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas';
      } else if (mintError.message?.includes('nonce')) {
        errorMessage = 'Nonce error - transaction conflict';
      } else {
        errorMessage = `Mint failed: ${mintError.message || 'Unknown error'}`;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('❌ API Error:', {
      error: error,
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}

// Handle GET requests for debugging/status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get('artistId');
  
  if (!artistId) {
    return NextResponse.json(
      { error: 'Missing artistId parameter' },
      { status: 400 }
    );
  }
  
  const artistContracts = getArtistContracts(artistId);
  if (!artistContracts?.downloads) {
    return NextResponse.json(
      { error: `Download contract not found for artist: ${artistId}` },
      { status: 404 }
    );
  }
  
  try {
    const downloadContract = new ethers.Contract(
      artistContracts.downloads,
      DOWNLOAD_CONTRACT_ABI,
      provider
    );
    
    const owner = await downloadContract.owner();
    
    return NextResponse.json({
      artistId,
      downloadContract: artistContracts.downloads,
      contractOwner: owner,
      serverConfigured: !!process.env.DOWNLOAD_MINTER_PK,
      rpcConnected: true
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to check contract: ${error.message}` },
      { status: 500 }
    );
  }
} 