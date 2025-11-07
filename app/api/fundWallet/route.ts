import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const deployerPrivateKey = process.env.MINTER_PRIVATE_KEY; // Using existing deployer key
const rpcUrl = process.env.NEXT_PUBLIC_RPC;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL and service role key are required.');
}

if (!deployerPrivateKey || !rpcUrl) {
  throw new Error('Deployer private key and RPC URL are required for funding.');
}

const serviceSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  // SECURITY: Endpoint disabled pending security hardening
  // This endpoint was vulnerable to mainnet transactions and lacked network guards
  return NextResponse.json({ 
    error: 'Endpoint disabled for security. Contact administrator.',
    funded: false 
  }, { status: 403 });
  
  // Original implementation below (disabled):
  /*
  console.log('💰 Wallet funding API called...');
  
  try {
    const { userAddress, email } = await request.json();
    console.log('🎯 Funding request for:', userAddress, 'Email:', email);

    // 1. Verify email is whitelisted
    const { data: whitelistData, error: whitelistError } = await serviceSupabase
      .from('whitelist_emails')
      .select('email, role')
      .eq('email', email)
      .single();

    if (whitelistError || !whitelistData) {
      console.error('❌ Email not whitelisted:', email);
      return NextResponse.json({ 
        error: 'Email not whitelisted',
        funded: false 
      }, { status: 403 });
    }

    // 2. Check if wallet already funded
    const { data: fundingData, error: fundingError } = await serviceSupabase
      .from('wallet_funding')
      .select('wallet_address, funded_amount')
      .eq('wallet_address', userAddress)
      .single();

    if (fundingData && !fundingError) {
      console.log('⚠️ Wallet already funded:', userAddress);
      return NextResponse.json({
        message: 'Wallet already funded',
        funded: true,
        previousAmount: fundingData.funded_amount,
        treasureMessage: '🏴‍☠️ TREASURE ALREADY DISCOVERED!'
      });
    }

    // 3. Set up provider and deployer wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
    
    // 4. Check deployer balance
    const deployerBalance = await provider.getBalance(deployerWallet.address);
    const fundingAmount = ethers.parseEther("0.01"); // 0.01 ETH
    
    if (deployerBalance < fundingAmount) {
      console.error('❌ Insufficient deployer balance:', ethers.formatEther(deployerBalance));
      return NextResponse.json({ 
        error: 'Insufficient funds in deployer wallet',
        funded: false 
      }, { status: 500 });
    }

    console.log('💸 Sending 0.01 ETH from deployer to user...');
    
    // 5. Send ETH to user wallet
    const tx = await deployerWallet.sendTransaction({
      to: userAddress,
      value: fundingAmount,
      gasLimit: 21000 // Standard ETH transfer
    });

    console.log('⏳ Transaction sent, waiting for confirmation...', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Funding transaction confirmed!', receipt?.hash);

    // 6. Record funding in database
    const { error: recordError } = await serviceSupabase
      .from('wallet_funding')
      .insert([{
        wallet_address: userAddress,
        email: email,
        funded_amount: "0.01",
        transaction_hash: tx.hash,
        funded_at: new Date().toISOString(),
        deployer_address: deployerWallet.address
      }]);

    if (recordError) {
      console.warn('⚠️ Failed to record funding in database:', recordError);
      // Don't fail the request - funding succeeded
    }

    // 7. Get USD equivalent (rough estimate - could integrate real price feed later)
    const ethPriceUsd = 2500; // Rough estimate - replace with real price feed
    const usdValue = (0.01 * ethPriceUsd).toFixed(2);

    console.log('🎉 Wallet funding complete!');
    return NextResponse.json({
      success: true,
      funded: true,
      amount: "0.01",
      amountWei: fundingAmount.toString(),
      transactionHash: tx.hash,
      usdValue: usdValue,
      treasureMessage: `🏴‍☠️ TREASURE DISCOVERED! $${usdValue} USD equivalent`
    });

  } catch (error: any) {
    console.error('❌ Wallet funding error:', error);
    return NextResponse.json({ 
      error: error.message,
      funded: false 
    }, { status: 500 });
  }
  */
}
