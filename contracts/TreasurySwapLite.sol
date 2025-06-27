// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title TreasurySwapLite  
 * @dev Minimal swap contract for Day-0 MVP testing
 * Fixed rate: 1 ETH = 1,000,000 tokens (easily changeable)
 * No circuit breaker, just emergency pause
 * UUPSUpgradeable for future enhancements
 */
contract TreasurySwapLite is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // MINIMAL STORAGE
    IERC20 public artistToken;
    address public artist;        // Reserved for future features
    bool public paused;          // Emergency pause only

    // PLACEHOLDER MATH (easily updatable)
    // 1 ETH (1e18 wei) = 1,000,000 tokens (1e6 * 1e18 wei)
    uint256 public constant TOKENS_PER_ETH = 1_000_000;

    event SwapIn(address indexed user, uint256 ethAmount, uint256 tokenAmount);
    event SwapOut(address indexed user, uint256 tokenAmount, uint256 ethAmount);
    event EmergencyPaused(bool state);

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract with token and artist addresses
     */
    function initialize(address _token, address _artist) external initializer {
        require(_token != address(0), "Invalid token address");
        require(_artist != address(0), "Invalid artist address");
        
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        artistToken = IERC20(_token);
        artist = _artist;
        paused = false;
    }

    /**
     * @dev Swap ETH for Artistocks
     * Rate: 1 ETH = 1,000,000 tokens
     */
    function swapIn() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Must send ETH");
        
        // Calculate tokens: tokenAmount = msg.value * 1e6 / 1e18 = msg.value / 1e12
        uint256 tokenAmount = (msg.value * TOKENS_PER_ETH) / 1e18;
        require(tokenAmount > 0, "Token amount too small");
        
        // Check contract has enough tokens
        uint256 contractBalance = artistToken.balanceOf(address(this));
        require(contractBalance >= tokenAmount, "Insufficient token liquidity");
        
        // Transfer tokens to user
        artistToken.safeTransfer(msg.sender, tokenAmount);
        
        emit SwapIn(msg.sender, msg.value, tokenAmount);
    }

    /**
     * @dev Swap Artistocks for ETH
     * Rate: 1,000,000 tokens = 1 ETH
     */
    function swapOut(uint256 tokenAmount) external nonReentrant whenNotPaused {
        require(tokenAmount > 0, "Must specify token amount");
        
        // Calculate ETH: ethAmount = tokenAmount * 1e18 / 1e6 = tokenAmount * 1e12
        uint256 ethAmount = (tokenAmount * 1e18) / (TOKENS_PER_ETH * 1e18);
        require(ethAmount > 0, "ETH amount too small");
        
        // Check contract has enough ETH
        require(address(this).balance >= ethAmount, "Insufficient ETH liquidity");
        
        // Transfer tokens from user
        artistToken.safeTransferFrom(msg.sender, address(this), tokenAmount);
        
        // Transfer ETH to user
        payable(msg.sender).transfer(ethAmount);
        
        emit SwapOut(msg.sender, tokenAmount, ethAmount);
    }

    /**
     * @dev Emergency pause toggle (owner only)
     */
    function emergencyPause(bool _state) external onlyOwner {
        paused = _state;
        emit EmergencyPaused(_state);
    }

    /**
     * @dev Get quote for ETH → tokens
     */
    function getTokenQuote(uint256 ethAmount) external pure returns (uint256) {
        return (ethAmount * TOKENS_PER_ETH) / 1e18;
    }

    /**
     * @dev Get quote for tokens → ETH
     */
    function getEthQuote(uint256 tokenAmount) external pure returns (uint256) {
        return (tokenAmount * 1e18) / (TOKENS_PER_ETH * 1e18);
    }

    /**
     * @dev Withdraw ETH (owner only)
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(owner()).transfer(amount);
    }

    /**
     * @dev Withdraw tokens (owner only)
     */
    function withdrawTokens(uint256 amount) external onlyOwner {
        require(amount <= artistToken.balanceOf(address(this)), "Insufficient token balance");
        artistToken.safeTransfer(owner(), amount);
    }

    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}

    /**
     * @dev Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
} 