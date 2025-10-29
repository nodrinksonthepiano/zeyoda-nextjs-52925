// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ArtistTokenUUPS
 * @dev Upgradeable ERC-20 token for artists with automatic distribution:
 * - 10% (1B) to artist wallet
 * - 1% (100M) to owner() for LP seeding
 * - 89% (8.9B) to protocol vault
 * 
 * Features:
 * - Pausable for emergency stops
 * - Upgradeable for bug fixes and enhancements
 * - Artist sovereignty transfer via transferEverything()
 */
contract ArtistTokenUUPS is
    Initializable,
    ERC20Upgradeable,
    ERC20PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // Constants (match legacy exactly)
    uint256 public constant TOTAL_SUPPLY = 10_000_000_000 * 10**18; // 10 billion
    uint256 public constant ARTIST_PERCENT = 10;  // 10%
    uint256 public constant LP_PERCENT = 1;       // 1%
    uint256 public constant PROTOCOL_PERCENT = 89; // 89%
    
    // State variables
    address public artistWallet;
    address public protocolVault;
    bool public hasInitialMinted;
    
    // Storage gap for future upgrades (CRITICAL - never remove or reorder above)
    uint256[47] private __gap;
    
    // Events
    event InitialDistribution(
        address indexed artistWallet,
        address indexed protocolVault,
        uint256 artistAmount,
        uint256 lpAmount,
        uint256 protocolAmount
    );
    
    event TransferEverything(
        address indexed oldOwner,
        address indexed newOwner,
        uint256 tokenAmount
    );
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the contract (replaces constructor for UUPS)
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param artistWallet_ Artist's treasury wallet (receives 1B)
     * @param protocolVault_ Protocol treasury (receives 8.9B)
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        address artistWallet_,
        address protocolVault_
    ) external initializer {
        require(artistWallet_ != address(0), "Artist wallet cannot be zero");
        require(protocolVault_ != address(0), "Protocol vault cannot be zero");
        
        __ERC20_init(name_, symbol_);
        __ERC20Pausable_init();
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        artistWallet = artistWallet_;
        protocolVault = protocolVault_;
    }
    
    /**
     * @dev Mint initial supply with automatic distribution
     * MATCHES LEGACY EXACTLY:
     * - 1B to artistWallet
     * - 100M to owner() (deployer - for immediate LP seeding)
     * - 8.9B to protocolVault
     * 
     * Can only be called once by owner (protocol)
     */
    function initialMint() external onlyOwner nonReentrant {
        require(!hasInitialMinted, "Initial mint already completed");
        
        hasInitialMinted = true;
        
        // Calculate distribution amounts (match legacy formula exactly)
        uint256 artistAmount = (TOTAL_SUPPLY * ARTIST_PERCENT) / 100;
        uint256 lpAmount = (TOTAL_SUPPLY * LP_PERCENT) / 100;
        uint256 protocolAmount = TOTAL_SUPPLY - artistAmount - lpAmount;
        
        // Mint tokens (match legacy distribution exactly)
        _mint(artistWallet, artistAmount);      // 1B to artist
        _mint(owner(), lpAmount);               // 100M to OWNER (for LP seeding)
        _mint(protocolVault, protocolAmount);   // 8.9B to protocol vault
        
        emit InitialDistribution(
            artistWallet,
            protocolVault,
            artistAmount,
            lpAmount,
            protocolAmount
        );
    }
    
    /**
     * @dev Get distribution information
     */
    function getDistributionInfo() external view returns (
        uint256 totalSupply_,
        uint256 artistAmount,
        uint256 lpAmount,
        uint256 protocolAmount,
        address artistWallet_,
        address protocolVault_,
        bool hasInitialMinted_
    ) {
        uint256 artistAmt = (TOTAL_SUPPLY * ARTIST_PERCENT) / 100;
        uint256 lpAmt = (TOTAL_SUPPLY * LP_PERCENT) / 100;
        uint256 protocolAmt = TOTAL_SUPPLY - artistAmt - lpAmt;
        
        return (
            TOTAL_SUPPLY,
            artistAmt,
            lpAmt,
            protocolAmt,
            artistWallet,
            protocolVault,
            hasInitialMinted
        );
    }
    
    /**
     * @dev Transfer protocol vault balance to new owner (artist sovereignty)
     * @param to New owner address (artist's cold wallet)
     */
    function transferEverything(address to) external onlyOwner nonReentrant {
        require(to != address(0), "New owner cannot be zero");
        require(to != owner(), "Cannot transfer to current owner");
        
        uint256 vaultBalance = balanceOf(protocolVault);
        require(vaultBalance > 0, "No vault balance to transfer");
        
        // Use OZ v5 internal _update to move tokens from vault to new owner
        _update(protocolVault, to, vaultBalance);
        
        emit TransferEverything(owner(), to, vaultBalance);
        
        // Transfer contract ownership to artist
        _transferOwnership(to);
    }
    
    /**
     * @dev Pause all token transfers (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Authorize upgrade (only owner can upgrade implementation)
     * @param newImplementation Address of new implementation contract
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
    
    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        super._update(from, to, value);
    }
    
    /**
     * @dev Emergency withdraw any ETH sent to contract
     */
    function emergencyWithdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = payable(owner()).call{value: balance}("");
            require(success, "ETH withdrawal failed");
        }
    }
    
    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}
}

