import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function GET() {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC;
    if (!rpcUrl) {
      throw new Error('RPC URL not configured');
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: 84532,
      name: "base-sepolia",
      ensAddress: null // Disable ENS
    });
    
    const tokenAddress = "0xd88B1b69Cf6Cd4E52ad1F661fe24EF414D52f8";
    
    const contract = new ethers.Contract(tokenAddress, [
      "function balanceOf(address) view returns (uint256)",
      "function symbol() view returns (string)",
      "function totalSupply() view returns (uint256)"
    ], provider);
    
    const symbol = await contract.symbol();
    const totalSupply = await contract.totalSupply();
    
    // Check key wallets
    const wallets = {
      deployer: "0x615258a5263DBEe0DDEED3166ddC1f442D937eB3",
      cancakes: "0xe42C291143e03f3Bd7D5a095815DAD3e82835C05", 
      gosheesh: "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8",
      jaitea: "0x0B893D9D0dA09096C75e43c310316dC61b2773be"
    };
    
    const balances = {};
    for (const [name, address] of Object.entries(wallets)) {
      const balance = await contract.balanceOf(address);
      balances[name] = {
        address,
        balance: ethers.formatUnits(balance, 18),
        balanceRaw: balance.toString()
      };
    }
    
    return NextResponse.json({
      token: symbol,
      totalSupply: ethers.formatUnits(totalSupply, 18),
      balances
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
