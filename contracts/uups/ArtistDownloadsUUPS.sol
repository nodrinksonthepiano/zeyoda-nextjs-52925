// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ArtistDownloadsUUPS
 * @dev Upgradeable ERC-1155 contract for artist download NFTs
 * - Server-sponsored purchases via buyFor()
 * - Artist receives 100% of sale price (NO platform fee)
 * - Protocol pays gas via MINTER_PRIVATE_KEY
 * - Pausable and upgradeable for artist sovereignty
 */
contract ArtistDownloadsUUPS is 
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // Artist identifier (e.g., "gosheesh", "jaitea")
    string public artistId;
    
    // Track total minted for each asset
    mapping(uint256 => uint256) public totalMinted;
    
    // Sponsor address (server wallet that can gas-sponsor mints)
    address public sponsor;
    
    // Storage gap for future upgrades (CRITICAL - never remove or reorder above variables)
    uint256[47] private __gap;
    
    // Events
    event DownloadPurchased(
        address indexed recipient,
        uint256 indexed tokenId,
        uint256 quantity,
        uint256 amount
    );
    
    event DownloadMinted(
        address indexed user,
        uint256 indexed tokenId,
        uint256 amount,
        string artistId
    );
    
    event SponsorUpdated(
        address indexed oldSponsor,
        address indexed newSponsor
    );
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Modifier to allow owner OR sponsor to call function
     * Enables server-sponsored gas while keeping artist as owner (for payments)
     */
    modifier onlyOwnerOrSponsor() {
        require(
            msg.sender == owner() || msg.sender == sponsor,
            "Not owner or sponsor"
        );
        _;
    }
    
    /**
     * @dev Initialize the contract (replaces constructor for UUPS)
     * @param _artistId Artist identifier
     * @param _uri Base URI for token metadata
     * @param _owner Contract owner (artist treasury or protocol)
     * @param _sponsor Server wallet that can gas-sponsor mints
     */
    function initialize(
        string memory _artistId,
        string memory _uri,
        address _owner,
        address _sponsor
    ) external initializer {
        require(bytes(_artistId).length > 0, "Artist ID required");
        require(_owner != address(0), "Invalid owner address");
        require(_sponsor != address(0), "Invalid sponsor address");
        
        __ERC1155_init(_uri);
        __Ownable_init(_owner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        artistId = _artistId;
        sponsor = _sponsor;
    }
    
    /**
     * @dev Server-sponsored purchase - mints to recipient, protocol pays gas
     * Artist receives 100% of msg.value (NO platform fee)
     * @param recipient Address to receive the NFT (user wallet)
     * @param tokenId Asset number to mint
     * @param quantity Number of tokens to mint
     */
    function buyFor(
        address recipient,
        uint256 tokenId,
        uint256 quantity
    ) external payable onlyOwnerOrSponsor nonReentrant whenNotPaused {
        require(recipient != address(0), "Invalid recipient");
        require(quantity > 0, "Quantity must be > 0");
        
        // Mint NFT to recipient (user gets the token)
        _mint(recipient, tokenId, quantity, "");
        totalMinted[tokenId] += quantity;
        
        // Handle payment to artist owner (100% - NO FEE)
        if (msg.value > 0) {
            // Forward 100% of payment to owner (artist treasury)
            (bool success, ) = payable(owner()).call{value: msg.value}("");
            require(success, "Payment transfer failed");
            
            emit DownloadPurchased(recipient, tokenId, quantity, msg.value);
        } else {
            // Free giveaway - no payment
            emit DownloadPurchased(recipient, tokenId, quantity, 0);
        }
    }
    
    /**
     * @dev Legacy mint function for backward compatibility
     * No payment involved - simple mint operation
     * @param user Address to receive tokens
     * @param tokenId Asset number to mint
     * @param amount Number of tokens to mint
     */
    function mintDownload(
        address user,
        uint256 tokenId,
        uint256 amount
    ) external onlyOwnerOrSponsor whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(tokenId > 0, "Invalid token ID");
        require(amount > 0, "Invalid amount");
        
        _mint(user, tokenId, amount, "");
        totalMinted[tokenId] += amount;
        
        emit DownloadMinted(user, tokenId, amount, artistId);
    }
    
    /**
     * @dev Batch mint for multiple assets at once
     * @param user Address to receive tokens
     * @param tokenIds Array of asset numbers
     * @param amounts Array of amounts for each asset
     */
    function batchMintDownloads(
        address user,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external onlyOwner whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(tokenIds.length == amounts.length, "Arrays length mismatch");
        require(tokenIds.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(tokenIds[i] > 0, "Invalid token ID");
            require(amounts[i] > 0, "Invalid amount");
            totalMinted[tokenIds[i]] += amounts[i];
        }
        
        _mintBatch(user, tokenIds, amounts, "");
    }
    
    /**
     * @dev Check if user owns download access to a specific asset
     * @param user Address to check
     * @param tokenId Asset number to check
     * @return bool True if user owns at least 1 token
     */
    function hasDownloadAccess(
        address user,
        uint256 tokenId
    ) external view returns (bool) {
        return balanceOf(user, tokenId) > 0;
    }
    
    /**
     * @dev Update the base URI for metadata
     * @param newUri New base URI
     */
    function setURI(string calldata newUri) external onlyOwner {
        _setURI(newUri);
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
     * @dev Authorize upgrade (only owner can upgrade)
     * @param newImplementation Address of new implementation contract
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
    
    /**
     * @dev Get metadata URI for a specific asset
     * @param tokenId Asset number
     * @return string URI for the asset metadata
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(super.uri(tokenId), artistId, "/", _toString(tokenId)));
    }
    
    /**
     * @dev Convert uint256 to string
     */
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    /**
     * @dev Set sponsor address (server wallet that can gas-sponsor mints)
     * @param _sponsor Address of sponsor (server signer)
     */
    function setSponsor(address _sponsor) external onlyOwner {
        emit SponsorUpdated(sponsor, _sponsor);
        sponsor = _sponsor;
    }
    
    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}
}

