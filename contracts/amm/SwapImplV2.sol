// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SwapImplV1.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SwapV2_Upg
 * @dev Upgrade to SwapV1_Upg adding LP withdrawal functionality
 * Maintains storage layout compatibility
 */
contract SwapImplV2 is SwapImplV1 {
    using SafeERC20 for IERC20;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    event LiquidityRemoved(
        address indexed token, 
        address indexed recipient, 
        uint16 bps, 
        uint256 tokenOut, 
        uint256 ethOut
    );

    /**
     * @dev Quote LP removal (read-only)
     * @param token Artist token address
     * @param bps Basis points to remove (1-10000, where 10000 = 100%)
     * @return tokenOut Amount of tokens that would be returned
     * @return ethOut Amount of ETH that would be returned
     */
    function quoteRemoveLiquidity(address token, uint16 bps) 
        external 
        view 
        returns (uint256 tokenOut, uint256 ethOut) 
    {
        require(bps > 0 && bps <= 10000, "Invalid bps");
        
        Pool memory pool = pools[token];
        require(pool.active, "Pool not active");
        require(pool.tokenReserve > 0 && pool.ethReserve > 0, "No liquidity");

        // Calculate proportional amounts
        tokenOut = (pool.tokenReserve * bps) / 10000;
        ethOut = (pool.ethReserve * bps) / 10000;
    }

    /**
     * @dev Remove liquidity by percentage
     * @param token Artist token address
     * @param bps Basis points to remove (1-10000)
     * @param minTokenOut Minimum tokens to receive (slippage protection)
     * @param minEthOut Minimum ETH to receive (slippage protection)
     * @param recipient Address to receive the withdrawn assets
     * @return tokenOut Actual tokens returned
     * @return ethOut Actual ETH returned
     */
    function removeLiquidityPercent(
        address token,
        uint16 bps,
        uint256 minTokenOut,
        uint256 minEthOut,
        address recipient
    ) external onlyOwner nonReentrant whenNotPaused returns (uint256 tokenOut, uint256 ethOut) {
        require(bps > 0 && bps <= 10000, "Invalid bps");
        require(recipient != address(0), "Invalid recipient");
        
        Pool storage pool = pools[token];
        require(pool.active, "Pool not active");
        require(pool.tokenReserve > 0 && pool.ethReserve > 0, "No liquidity");

        // Calculate proportional amounts to remove
        tokenOut = (pool.tokenReserve * bps) / 10000;
        ethOut = (pool.ethReserve * bps) / 10000;

        // Enforce slippage protection
        require(tokenOut >= minTokenOut, "Insufficient token output");
        require(ethOut >= minEthOut, "Insufficient ETH output");

        // Update pool reserves
        pool.tokenReserve -= tokenOut;
        pool.ethReserve -= ethOut;

        // Transfer assets to recipient
        IERC20(token).safeTransfer(recipient, tokenOut);
        payable(recipient).transfer(ethOut);

        emit LiquidityRemoved(token, recipient, bps, tokenOut, ethOut);
    }

    /**
     * @dev Emergency drain pool (owner only, 100% removal)
     * @param token Artist token address
     * @param recipient Address to receive all assets
     */
    function drainPool(address token, address recipient) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(recipient != address(0), "Invalid recipient");
        
        Pool storage pool = pools[token];
        require(pool.active, "Pool not active");

        uint256 tokenAmount = pool.tokenReserve;
        uint256 ethAmount = pool.ethReserve;

        // Clear pool
        pool.tokenReserve = 0;
        pool.ethReserve = 0;
        pool.active = false;

        // Transfer all assets
        if (tokenAmount > 0) {
            IERC20(token).safeTransfer(recipient, tokenAmount);
        }
        if (ethAmount > 0) {
            payable(recipient).transfer(ethAmount);
        }

        emit LiquidityRemoved(token, recipient, 10000, tokenAmount, ethAmount);
    }

    /**
     * @dev Get version for upgrade verification
     */
    function version() external pure returns (string memory) {
        return "SwapImplV2";
    }
}
