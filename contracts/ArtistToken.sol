// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArtistToken
 * @dev ERC20 token for artists with automatic distribution:
 * - 10% to artist wallet
 * - 1% to LP seeding
 * - 89% to protocol vault
 */
contract ArtistToken is ERC20, Ownable, ReentrancyGuard {
    uint256 public constant TOTAL_SUPPLY = 10_000_000_000 * 10**18; // 10 billion tokens
    uint256 public constant ARTIST_PERCENT = 10; // 10%
    uint256 public constant LP_PERCENT = 1; // 1%
    uint256 public constant PROTOCOL_PERCENT = 89; // 89%
    
    address public immutable artistWallet;
    address public immutable protocolVault;
    bool public hasInitialMinted = false;
    
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
        uint256 tokenAmount,
        address indexed tokenContract
    );
    
    /**
     * @dev Constructor sets up token with artist and protocol addresses
     */
    constructor(
        string memory name,
        string memory symbol,
        address _artistWallet,
        address _protocolVault
    ) ERC20(name, symbol) Ownable(msg.sender) {
        require(_artistWallet != address(0), "Artist wallet cannot be zero address");
        require(_protocolVault != address(0), "Protocol vault cannot be zero address");
        
        artistWallet = _artistWallet;
        protocolVault = _protocolVault;
    }
    
    /**
     * @dev Mint initial supply with automatic distribution
     * Can only be called once by owner (protocol deployer)
     */
    function initialMint() external onlyOwner {
        require(!hasInitialMinted, "Initial mint already completed");
        
        hasInitialMinted = true;
        
        // Calculate distribution amounts
        uint256 artistAmount = (TOTAL_SUPPLY * ARTIST_PERCENT) / 100;
        uint256 lpAmount = (TOTAL_SUPPLY * LP_PERCENT) / 100;
        uint256 protocolAmount = TOTAL_SUPPLY - artistAmount - lpAmount;
        
        // Mint tokens
        _mint(artistWallet, artistAmount);          // 1B to artist
        _mint(owner(), lpAmount);                   // 100M to LP seeding
        _mint(protocolVault, protocolAmount);       // 8.9B to protocol vault
        
        emit InitialDistribution(
            artistWallet,
            protocolVault,
            artistAmount,
            lpAmount,
            protocolAmount
        );
    }
    
    /**
     * @dev Get distribution info
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
     * @dev Transfer everything to new owner (for artist handoff)
     * Only callable by current owner (protocol)
     */
    function transferEverything(address newOwner) external onlyOwner nonReentrant {
        require(newOwner != address(0), "New owner cannot be zero address");
        require(newOwner != owner(), "New owner cannot be current owner");
        
        // Transfer any remaining tokens from protocol vault
        uint256 protocolBalance = balanceOf(protocolVault);
        if (protocolBalance > 0) {
            // This requires protocolVault to approve this contract first
            _transfer(protocolVault, newOwner, protocolBalance);
        }
        
        // Transfer any tokens held by this contract
        uint256 contractBalance = balanceOf(address(this));
        if (contractBalance > 0) {
            _transfer(address(this), newOwner, contractBalance);
        }
        
        emit TransferEverything(owner(), newOwner, protocolBalance + contractBalance, address(this));
        
        // Transfer ownership last
        _transferOwnership(newOwner);
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