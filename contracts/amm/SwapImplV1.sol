// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title SwapV1_Upg
 * @dev UUPS Upgradeable AMM with per-artist pools (V1 - core functionality)
 * Maintains storage layout compatibility for future upgrades
 */
contract SwapImplV1 is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable 
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
    uint256 public tradingFee; // 0.3% trading fee (30 bps)
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    // Storage gaps for future upgrades
    uint256[47] private __gap;

    event PoolCreated(address indexed token, uint256 tokenAmount, uint256 ethAmount);
    event LiquidityAdded(address indexed token, uint256 tokenAmount, uint256 ethAmount);
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

    function initialize(address initialOwner, uint256 _tradingFee) external initializer {
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        tradingFee = _tradingFee; // 30 for 0.3%
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Create a new liquidity pool for an artistock token
     */
    function createPool(
        address token,
        uint256 tokenAmount
    ) external payable onlyOwner nonReentrant {
        require(token != address(0), "Invalid token");
        require(!pools[token].active, "Pool already exists");
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
     * @dev Add liquidity to existing pool
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
     * @dev Get token quote for ETH input
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
     * @dev Get ETH quote for token input
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
     * @dev Swap one token for another through ETH
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
     * @dev Calculate output amount using constant product formula
     */
    function _getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal view returns (uint256) {
        require(amountIn > 0, "Invalid input amount");
        require(reserveIn > 0 && reserveOut > 0, "Invalid reserves");

        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - tradingFee);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;

        return numerator / denominator;
    }

    /**
     * @dev Get pool information
     */
    function getPool(address token) external view returns (Pool memory) {
        return pools[token];
    }

    /**
     * @dev Get all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    /**
     * @dev Set trading fee (owner only)
     */
    function setTradingFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        tradingFee = newFee;
    }

    /**
     * @dev Toggle pool active state
     */
    function togglePool(address token) external onlyOwner {
        pools[token].active = !pools[token].active;
    }

    /**
     * @dev Emergency withdraw (owner only)
     */
    function emergencyWithdraw(address token) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(address(this).balance);
        } else {
            IERC20(token).safeTransfer(owner(), IERC20(token).balanceOf(address(this)));
        }
    }

    /**
     * @dev Pause contract
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
}
