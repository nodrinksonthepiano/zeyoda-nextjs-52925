const { ethers } = require("hardhat");

async function findCancakesToken() {
  console.log("🔍 SEARCHING FOR COMPLETE CANCAKES TOKEN ADDRESS");
  console.log("===============================================");
  
  const truncatedAddress = "0xd88B1b69Cf6Cd4E52ad1F661fe24EF414D52f8";
  
  console.log("❌ Current truncated address:", truncatedAddress);
  console.log("❌ Length:", truncatedAddress.length, "(should be 42)");
  console.log("❌ Missing characters:", 42 - truncatedAddress.length);
  
  console.log("\n🔍 Checking if this address exists on Base Sepolia...");
  
  try {
    const [deployer] = await ethers.getSigners();
    const provider = ethers.provider;
    
    // Try to get code at the truncated address (will fail)
    const code = await provider.getCode(truncatedAddress);
    console.log("Code length:", code.length);
    
    if (code === "0x") {
      console.log("❌ No contract found at truncated address");
      console.log("\n💡 SOLUTION: Need to redeploy CANCAKES token");
      console.log("   The address was truncated during original deployment/saving");
      console.log("   We need to deploy a new CANCAKES token with complete address");
    } else {
      console.log("✅ Contract exists at truncated address (unexpected!)");
    }
    
  } catch (error) {
    console.log("❌ Error checking address:", error.message);
    console.log("\n💡 This confirms the address is invalid/incomplete");
  }
  
  console.log("\n🚀 RECOMMENDED ACTION:");
  console.log("1. Deploy new CANCAKES token");
  console.log("2. Update database with complete address");
  console.log("3. Fund LP with 100M tokens");
  console.log("4. Transfer 1B tokens to CANCAKES wallet");
}

findCancakesToken();
