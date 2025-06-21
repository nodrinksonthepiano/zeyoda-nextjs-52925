import React from 'react';

interface OwnerControlsProps {
  isMinting: boolean;
  mintAmount: string;
  setMintAmount: (amount: string) => void;
  handleInitialMint: () => void;
}

const OwnerControls: React.FC<OwnerControlsProps> = ({
  isMinting,
  mintAmount,
  setMintAmount,
  handleInitialMint,
}) => {
  return (
    <div className="bg-gray-800 bg-opacity-80 p-4 rounded-lg mt-4 w-full max-w-sm mx-auto text-white">
      <h3 className="text-lg font-bold text-center mb-3">Owner Controls</h3>
      <div className="flex flex-col space-y-2">
        <label htmlFor="mintAmount" className="text-sm font-medium">
          Amount to Mint
        </label>
        <input
          id="mintAmount"
          type="number"
          value={mintAmount}
          onChange={(e) => setMintAmount(e.target.value)}
          placeholder="e.g., 1000000"
          className="px-3 py-2 text-gray-300 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accentColor"
          disabled={isMinting}
        />
        <button
          onClick={handleInitialMint}
          disabled={isMinting || !mintAmount}
          className="w-full px-4 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {isMinting ? 'Minting...' : 'Mint New Tokens'}
        </button>
      </div>
    </div>
  );
};

export default OwnerControls; 