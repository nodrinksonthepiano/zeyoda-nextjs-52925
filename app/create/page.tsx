'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import { useWallet } from '../components/MagicProvider'; // Adjust path if needed
import ArtistockArtifact from '../../artifacts/contracts/Artistock.sol/Artistock.json';

export default function CreateProfilePage() {
  const { provider } = useWallet();
  const [artistName, setArtistName] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [artworkTitle, setArtworkTitle] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1a0a3b');
  const [accentColor, setAccentColor] = useState('#7f40ff');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider) {
      setError("Wallet not connected. Please go back and log in.");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const browserProvider = new ethers.BrowserProvider(provider as any);
      const signer = await browserProvider.getSigner();
      const ownerAddress = await signer.getAddress();

      const factory = new ethers.ContractFactory(ArtistockArtifact.abi, ArtistockArtifact.bytecode, signer);
      
      console.log(`Deploying contract for ${tokenName} (${tokenSymbol}) with owner ${ownerAddress}...`);
      
      const contract = await factory.deploy(tokenName, tokenSymbol, ownerAddress);
      await contract.waitForDeployment();
      
      const contractAddress = await contract.getAddress();
      console.log("Contract deployed successfully at:", contractAddress);

      // Create a new Contract instance with the ABI to get correct typings for the mint function
      const artistock = new ethers.Contract(contractAddress, ArtistockArtifact.abi, signer);

      console.log(`Minting initial supply of 1,000,000,000 ${tokenSymbol} to ${ownerAddress}...`);
      const initialSupply = ethers.parseUnits("1000000000", 18); // 1 billion tokens
      const mintTx = await artistock.mint(ownerAddress, initialSupply);
      await mintTx.wait(); // Wait for the minting transaction to be confirmed
      console.log("Initial supply minted successfully. Tx:", mintTx.hash);

      // 1. Create the full artist config object.
      const artistId = tokenSymbol.toLowerCase();
      const newProfile = {
        id: artistId,
        config: {
          name: tokenName,
          displayName: artistName,
          tokenName: tokenName,
          artworkTitle: artworkTitle,
          artworkYear: new Date().getFullYear().toString(),
          tokenPrice: 0.0005, // Default price, can be changed later
          videoSrc: "", // Placeholder for video
          contract: contractAddress,
          theme: {
            primaryColor: primaryColor,
            accentColor: accentColor,
            gradientStart: "#d4af37", // Default gradient
            gradientMiddle: "#f9f295",
            gradientEnd: "#d4af37",
            fontFamily: "Bungee, cursive"
          },
          orbitalTokens: [] // Starts with no orbital tokens
        }
      };

      // 2. POST this data to our API endpoint.
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProfile),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save profile.');
      }

      alert(`Profile for ${artistName} created and saved successfully!`);
      
      // Redirect to the new artist's page
      router.push(`/?artist=${artistId}`);

    } catch (err) {
      console.error("Profile creation failed", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred during profile creation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
      <div className="w-full max-w-2xl p-8 space-y-8 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center">Create Your Artist Profile</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="artistName" className="block text-sm font-medium text-gray-300">Artist Display Name</label>
            <input
              id="artistName"
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 text-gray-300 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accentColor"
              placeholder="e.g., Da Vinci"
            />
          </div>

          <div>
            <label htmlFor="tokenName" className="block text-sm font-medium text-gray-300">Token Name</label>
            <input
              id="tokenName"
              type="text"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 text-gray-300 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accentColor"
              placeholder="e.g., Mona Lisa Token"
            />
          </div>
          
          <div>
            <label htmlFor="tokenSymbol" className="block text-sm font-medium text-gray-300">Token Symbol</label>
            <input
              id="tokenSymbol"
              type="text"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
              required
              maxLength={5}
              className="w-full px-3 py-2 mt-1 text-gray-300 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accentColor"
              placeholder="e.g., MONA"
            />
          </div>

          <div>
            <label htmlFor="artworkTitle" className="block text-sm font-medium text-gray-300">Featured Artwork Title</label>
            <input
              id="artworkTitle"
              type="text"
              value={artworkTitle}
              onChange={(e) => setArtworkTitle(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 text-gray-300 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accentColor"
              placeholder="e.g., The Masterpiece"
            />
          </div>
          
          <div className="flex space-x-4">
            <div className="w-1/2">
              <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-300">Primary Color</label>
              <input
                id="primaryColor"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full h-10 mt-1"
              />
            </div>
            <div className="w-1/2">
              <label htmlFor="accentColor" className="block text-sm font-medium text-gray-300">Accent Color</label>
              <input
                id="accentColor"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-full h-10 mt-1"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2 font-bold text-white bg-accentColor rounded-md hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accentColor disabled:bg-gray-500"
            >
              {isSubmitting ? 'Creating Profile...' : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
} 