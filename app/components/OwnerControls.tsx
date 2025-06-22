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
  const handleMint1B = () => {
    setMintAmount("1000000000");
    // Trigger mint with 1B tokens
    setTimeout(() => handleInitialMint(), 100);
  };

  return (
    <div className="bg-gradient-to-br from-yellow-600 to-orange-600 bg-opacity-90 p-6 rounded-lg mt-4 w-full max-w-md mx-auto text-white shadow-xl">
      <h3 className="text-xl font-bold text-center mb-4">🎨 Artist Owner Control</h3>
      <p className="text-center text-sm mb-4 text-yellow-100">
        You are the owner of this contract.
      </p>
      
      {/* Quick 1B Mint Button */}
      <div className="mb-6">
        <button
          onClick={handleMint1B}
          disabled={isMinting}
          className="w-full px-4 py-3 font-bold text-white bg-yellow-500 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:bg-gray-500 disabled:cursor-not-allowed text-lg shadow-lg transition-all duration-150 hover:scale-105"
        >
          {isMinting ? 'Minting...' : 'Mint Initial 1B Token Supply'}
        </button>
      </div>

      {/* Manual Mint Section */}
      <div className="border-t border-yellow-400 pt-4">
        <h4 className="text-sm font-semibold mb-2 text-yellow-100">Custom Amount</h4>
        <div className="flex flex-col space-y-2">
          <label htmlFor="mintAmount" className="text-sm font-medium text-yellow-100">
            Amount to Mint
          </label>
          <input
            id="mintAmount"
            type="number"
            value={mintAmount}
            onChange={(e) => setMintAmount(e.target.value)}
            placeholder="e.g., 1000000"
            className="px-3 py-2 text-gray-300 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
            disabled={isMinting}
          />
          <button
            onClick={handleInitialMint}
            disabled={isMinting || !mintAmount}
            className="w-full px-4 py-2 font-bold text-white bg-orange-600 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isMinting ? 'Minting...' : 'Mint Custom Amount'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnerControls; 