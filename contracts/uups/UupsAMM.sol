// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title UupsAMM
 * @dev UUPS Upgradeable AMM matching legacy Swap.sol exactly
 * - Multi-pool support (one AMM for all artists)
 * - 0.3% trading fee (30 basis points)
 * - No LP tokens (simple reserve tracking)
 * - Protocol owns all liquidity
 * - Constant product formula: x * y = k
 */
contract UupsAMM is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    struct Pool {
        address token;
        uint256 tokenReserve;
        uint256 ethReserve;
        bool active;
    }

    mapping(address => Pool) public pools;
    address[] public supportedTokens;
    
    uint256 public constant FEE_DENOMINATOR = 10000; // 0.01% precision
    uint256 public tradingFee; // 0.3% = 30 basis points
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    // Storage gap for future upgrades
    uint256[47] private __gap;

    // Events (match legacy)
    event PoolCreated(address indexed token, uint256 tokenAmount, uint256 ethAmount);
    event LiquidityAdded(address indexed token, uint256 tokenAmount, uint256 ethAmount);
    event LiquidityRemoved(address indexed token, uint256 tokenAmount, uint256 ethAmount);
    event TokenSwapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the AMM
     * @param initialOwner Contract owner (protocol)
     * @param _tradingFee Trading fee in basis points (30 = 0.3%)
     */
    function initialize(address initialOwner, uint256 _tradingFee) external initializer {
        require(initialOwner != address(0), "Invalid owner");
        require(_tradingFee <= 1000, "Fee too high"); // Max 10%
        
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        tradingFee = _tradingFee; // 30 for 0.3%
    }

    /**
     * @dev Authorize upgrade (only owner can upgrade)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Create a new liquidity pool for an artist token
     * @param token Artist token address
     * @param tokenAmount Amount of tokens to add
     */
    function createPool(
        address token,
        uint256 tokenAmount
    ) external payable onlyOwner nonReentrant {
        require(token != address(0), "Invalid token address");
        require(pools[token].token == address(0), "Pool already exists");
        require(tokenAmount > MINIMUM_LIQUIDITY, "Insufficient token amount");
        require(msg.value > 0, "ETH required");

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        pools[token] = Pool({
            token: token,
            tokenReserve: tokenAmount,
            ethReserve: msg.value,
            active: true
        });

        supportedTokens.push(token);

        emit PoolCreated(token, tokenAmount, msg.value);
    }

    /**
     * @dev Add liquidity to an existing pool
     * @param token Artist token address
     * @param tokenAmount Amount of tokens to add
     */
    function addLiquidity(address token, uint256 tokenAmount) 
        external 
        payable 
        onlyOwner 
        nonReentrant 
        whenNotPaused
    {
        Pool storage pool = pools[token];
        require(pool.active, "Pool not active");
        require(tokenAmount > 0 && msg.value > 0, "Invalid amounts");

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        pool.tokenReserve += tokenAmount;
        pool.ethReserve += msg.value;

        emit LiquidityAdded(token, tokenAmount, msg.value);
    }

    /**
     * @dev Get quote for swapping ETH to tokens
     * @param token Token to receive
     * @param ethAmount Amount of ETH to swap
     * @return Amount of tokens that would be received
     */
    function getTokenQuote(address token, uint256 ethAmount) 
        external 
        view 
        returns (uint256) 
    {
        Pool memory pool = pools[token];
        require(pool.active, "Pool not active");
        require(ethAmount > 0, "Invalid amount");

        return _getAmountOut(ethAmount, pool.ethReserve, pool.tokenReserve);
    }

    /**
     * @dev Get quote for swapping tokens to ETH
     * @param token Token to sell
     * @param tokenAmount Amount of tokens to swap
     * @return Amount of ETH that would be received
     */
    function getEthQuote(address token, uint256 tokenAmount) 
        external 
        view 
        returns (uint256) 
    {
        Pool memory pool = pools[token];
        require(pool.active, "Pool not active");
        require(tokenAmount > 0, "Invalid amount");

        return _getAmountOut(tokenAmount, pool.tokenReserve, pool.ethReserve);
    }

    /**
     * @dev Swap ETH for tokens
     * @param token Token to receive
     * @param minTokens Minimum tokens to receive (slippage protection)
     */
    function swapEthForTokens(address token, uint256 minTokens) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
    {
        Pool storage pool = pools[token];
        require(pool.active, "Pool not active");
        require(msg.value > 0, "Invalid ETH amount");

        uint256 tokensOut = _getAmountOut(msg.value, pool.ethReserve, pool.tokenReserve);
        require(tokensOut >= minTokens, "Insufficient output amount");

        pool.ethReserve += msg.value;
        pool.tokenReserve -= tokensOut;

        IERC20(token).safeTransfer(msg.sender, tokensOut);

        emit TokenSwapped(msg.sender, address(0), token, msg.value, tokensOut);
    }

    /**
     * @dev Swap tokens for ETH
     * @param token Token to sell
     * @param tokenAmount Amount of tokens to swap
     * @param minEth Minimum ETH to receive (slippage protection)
     */
    function swapTokensForEth(
        address token, 
        uint256 tokenAmount, 
        uint256 minEth
    ) external nonReentrant whenNotPaused {
        Pool storage pool = pools[token];
        require(pool.active, "Pool not active");
        require(tokenAmount > 0, "Invalid token amount");

        uint256 ethOut = _getAmountOut(tokenAmount, pool.tokenReserve, pool.ethReserve);
        require(ethOut >= minEth, "Insufficient output amount");

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        pool.tokenReserve += tokenAmount;
        pool.ethReserve -= ethOut;

        payable(msg.sender).transfer(ethOut);

        emit TokenSwapped(msg.sender, token, address(0), tokenAmount, ethOut);
    }

    /**
     * @dev Swap one token for another through ETH (two-hop)
     * @param tokenIn Token to sell
     * @param tokenOut Token to buy
     * @param tokenAmountIn Amount of tokens to swap
     * @param minTokensOut Minimum tokens to receive
     */
    function swapTokens(
        address tokenIn,
        address tokenOut,
        uint256 tokenAmountIn,
        uint256 minTokensOut
    ) external nonReentrant whenNotPaused {
        require(tokenIn != tokenOut, "Same token");
        
        Pool storage poolIn = pools[tokenIn];
        Pool storage poolOut = pools[tokenOut];
        require(poolIn.active && poolOut.active, "Pool not active");

        // First swap tokenIn to ETH
        uint256 ethAmount = _getAmountOut(tokenAmountIn, poolIn.tokenReserve, poolIn.ethReserve);
        
        // Then swap ETH to tokenOut
        uint256 tokensOut = _getAmountOut(ethAmount, poolOut.ethReserve, poolOut.tokenReserve);
        require(tokensOut >= minTokensOut, "Insufficient output amount");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), tokenAmountIn);

        poolIn.tokenReserve += tokenAmountIn;
        poolIn.ethReserve -= ethAmount;
        poolOut.ethReserve += ethAmount;
        poolOut.tokenReserve -= tokensOut;

        IERC20(tokenOut).safeTransfer(msg.sender, tokensOut);

        emit TokenSwapped(msg.sender, tokenIn, tokenOut, tokenAmountIn, tokensOut);
    }

    /**
     * @dev Calculate output amount using constant product formula with fee
     * Formula: amountOut = (amountIn * 0.997 * reserveOut) / (reserveIn + amountIn * 0.997)
     * @param amountIn Input amount
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return Output amount after fee
     */
    function _getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal view returns (uint256) {
        require(amountIn > 0, "Invalid input amount");
        require(reserveIn > 0 && reserveOut > 0, "Invalid reserves");

        // Apply 0.3% fee (9970 / 10000 = 0.997)
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - tradingFee);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;

        return numerator / denominator;
    }

    /**
     * @dev Get pool information
     * @param token Token address
     * @return Pool struct with reserves and status
     */
    function getPool(address token) external view returns (Pool memory) {
        return pools[token];
    }

    /**
     * @dev Get reserves for a specific pool
     * @param token Token address
     * @return tokenReserve Token reserve amount
     * @return ethReserve ETH reserve amount
     */
    function getReserves(address token) external view returns (uint256 tokenReserve, uint256 ethReserve) {
        Pool memory pool = pools[token];
        return (pool.tokenReserve, pool.ethReserve);
    }

    /**
     * @dev Get all supported tokens
     * @return Array of token addresses with pools
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    /**
     * @dev Set trading fee (only owner)
     * @param newFee New fee in basis points (max 1000 = 10%)
     */
    function setTradingFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high");
        tradingFee = newFee;
    }

    /**
     * @dev Toggle pool active status
     * @param token Token address
     */
    function togglePool(address token) external onlyOwner {
        pools[token].active = !pools[token].active;
    }

    /**
     * @dev Emergency withdraw (only owner)
     * @param token Token to withdraw (address(0) for ETH)
     */
    function emergencyWithdraw(address token) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(address(this).balance);
        } else {
            IERC20(token).safeTransfer(owner(), IERC20(token).balanceOf(address(this)));
        }
    }

    /**
     * @dev Pause contract (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}
}

