// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArtistDownloads
 * @dev ERC-1155 contract for download access tokens
 * - tokenId = asset_number from artist_assets table
 * - Owning a token grants download access to that asset
 * - Protocol controls minting (payment processing happens off-chain)
 */
contract ArtistDownloads is ERC1155, Ownable, ReentrancyGuard {
    
    // Artist ID for this contract (e.g., "gosheesh", "jaitea")
    string public artistId;
    
    // Track total minted for each asset
    mapping(uint256 => uint256) public totalMinted;
    
    // Events
    event DownloadMinted(
        address indexed user,
        uint256 indexed assetId,
        uint256 amount,
        string artistId
    );
    
    event BatchDownloadMinted(
        address indexed user,
        uint256[] assetIds,
        uint256[] amounts,
        string artistId
    );
    
    constructor(
        string memory _artistId,
        string memory _uri
    ) ERC1155(_uri) Ownable(msg.sender) {
        artistId = _artistId;
    }
    
    /**
     * @dev Mint download token for a specific asset
     * @param user Address to receive the download token
     * @param assetId Asset number (tokenId) to mint
     * @param amount Number of tokens to mint (usually 1)
     */
    function mintDownload(
        address user,
        uint256 assetId,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(user != address(0), "Invalid user address");
        require(assetId > 0, "Invalid asset ID");
        require(amount > 0, "Invalid amount");
        
        _mint(user, assetId, amount, "");
        totalMinted[assetId] += amount;
        
        emit DownloadMinted(user, assetId, amount, artistId);
    }
    
    /**
     * @dev Mint multiple download tokens at once
     * @param user Address to receive the download tokens
     * @param assetIds Array of asset numbers to mint
     * @param amounts Array of amounts for each asset
     */
    function batchMintDownloads(
        address user,
        uint256[] calldata assetIds,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        require(user != address(0), "Invalid user address");
        require(assetIds.length == amounts.length, "Arrays length mismatch");
        require(assetIds.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < assetIds.length; i++) {
            require(assetIds[i] > 0, "Invalid asset ID");
            require(amounts[i] > 0, "Invalid amount");
            totalMinted[assetIds[i]] += amounts[i];
        }
        
        _mintBatch(user, assetIds, amounts, "");
        
        emit BatchDownloadMinted(user, assetIds, amounts, artistId);
    }
    
    /**
     * @dev Check if user owns download access to a specific asset
     * @param user Address to check
     * @param assetId Asset number to check
     * @return bool True if user owns download access
     */
    function hasDownloadAccess(
        address user,
        uint256 assetId
    ) external view returns (bool) {
        return balanceOf(user, assetId) > 0;
    }
    
    /**
     * @dev Get user's download balances for multiple assets
     * @param user Address to check
     * @param assetIds Array of asset numbers to check
     * @return balances Array of balances for each asset
     */
    function getDownloadBalances(
        address user,
        uint256[] calldata assetIds
    ) external view returns (uint256[] memory) {
        return balanceOfBatch(_fillAddressArray(user, assetIds.length), assetIds);
    }
    
    /**
     * @dev Update the base URI for metadata
     * @param newUri New base URI
     */
    function setURI(string calldata newUri) external onlyOwner {
        _setURI(newUri);
    }
    
    /**
     * @dev Get metadata URI for a specific asset
     * @param assetId Asset number
     * @return string URI for the asset metadata
     */
    function uri(uint256 assetId) public view override returns (string memory) {
        return string(abi.encodePacked(super.uri(assetId), artistId, "/", _toString(assetId)));
    }
    
    /**
     * @dev Helper function to fill address array for batch operations
     */
    function _fillAddressArray(
        address user,
        uint256 length
    ) private pure returns (address[] memory) {
        address[] memory addresses = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            addresses[i] = user;
        }
        return addresses;
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
} 