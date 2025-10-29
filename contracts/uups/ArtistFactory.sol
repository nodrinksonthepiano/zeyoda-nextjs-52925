// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IArtistTokenUUPS {
    function initialize(string memory name, string memory symbol, address artistWallet, address protocolVault) external;
    function initialMint() external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IArtistDownloadsUUPS {
    function initialize(string memory artistId, string memory uri, address owner) external;
}

interface IUupsAMM {
    function createPool(address token, uint256 tokenAmount) external payable;
}

/**
 * @title ArtistFactory
 * @dev One-click deployment of complete UUPS artist infrastructure
 * - Deploys ArtistTokenUUPS proxy (with 10B distribution)
 * - Deploys ArtistDownloadsUUPS proxy
 * - Creates AMM pool (100M tokens + ETH from factory balance)
 * - Protocol-subsidized deployment (factory is pre-funded)
 */
contract ArtistFactory is Ownable, ReentrancyGuard {
    
    // Implementation addresses (set at deployment)
    address public immutable tokenImplementation;
    address public immutable downloadsImplementation;
    address public immutable ammProxy;
    address public immutable protocolVault;
    
    uint256 public artistCount;
    
    // Events
    event ArtistCreated(
        string indexed artistId,
        address indexed tokenProxy,
        address downloadsProxy,
        address ammProxy,
        uint256 lpTokenSeed,
        uint256 lpEthSeed
    );
    
    event FactoryFunded(address indexed funder, uint256 amount);
    
    /**
     * @dev Constructor sets implementation addresses
     * @param _tokenImpl ArtistTokenUUPS implementation address
     * @param _downloadsImpl ArtistDownloadsUUPS implementation address  
     * @param _ammProxy UupsAMM proxy address
     * @param _protocolVault Protocol vault address
     * @param _initialOwner Factory owner (protocol)
     */
    constructor(
        address _tokenImpl,
        address _downloadsImpl,
        address _ammProxy,
        address _protocolVault,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_tokenImpl != address(0), "Invalid token implementation");
        require(_downloadsImpl != address(0), "Invalid downloads implementation");
        require(_ammProxy != address(0), "Invalid AMM proxy");
        require(_protocolVault != address(0), "Invalid protocol vault");
        
        tokenImplementation = _tokenImpl;
        downloadsImplementation = _downloadsImpl;
        ammProxy = _ammProxy;
        protocolVault = _protocolVault;
    }
    
    /**
     * @dev Create complete artist infrastructure in one transaction
     * @param name Token name
     * @param symbol Token symbol
     * @param artistId Lowercase artist identifier
     * @param artistWallet Artist's Magic.link wallet
     * @return tokenProxy Address of deployed token proxy
     * @return downloadsProxy Address of deployed downloads proxy
     */
    function createArtist(
        string memory name,
        string memory symbol,
        string memory artistId,
        address artistWallet
    ) external onlyOwner nonReentrant returns (
        address tokenProxy,
        address downloadsProxy
    ) {
        require(artistWallet != address(0), "Invalid artist wallet");
        require(address(this).balance >= 0.005 ether, "Insufficient factory ETH balance");
        
        // Step 1: Deploy token proxy
        tokenProxy = _deployTokenProxy(name, symbol, artistWallet);
        
        // Step 2: Call initialMint (factory becomes temporary owner, receives 100M)
        IArtistTokenUUPS(tokenProxy).initialMint();
        
        // Step 3: Deploy downloads proxy (artist is owner from start)
        downloadsProxy = _deployDownloadsProxy(artistId, artistWallet);
        
        // Step 4: Create AMM pool with factory's 100M tokens + 0.005 ETH
        uint256 lpTokenAmount = 100_000_000 * 10**18; // 100M tokens
        uint256 lpEthAmount = 0.005 ether;
        
        // Approve AMM to spend factory's 100M tokens
        IArtistTokenUUPS(tokenProxy).approve(ammProxy, lpTokenAmount);
        
        // Create pool (transfers tokens from factory to AMM)
        IUupsAMM(ammProxy).createPool{value: lpEthAmount}(tokenProxy, lpTokenAmount);
        
        // Increment counter
        artistCount++;
        
        emit ArtistCreated(
            artistId,
            tokenProxy,
            downloadsProxy,
            ammProxy,
            lpTokenAmount,
            lpEthAmount
        );
        
        return (tokenProxy, downloadsProxy);
    }
    
    /**
     * @dev Deploy token proxy with initialization
     */
    function _deployTokenProxy(
        string memory name,
        string memory symbol,
        address artistWallet
    ) internal returns (address) {
        bytes memory initData = abi.encodeWithSignature(
            "initialize(string,string,address,address)",
            name,
            symbol,
            artistWallet,
            protocolVault
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(tokenImplementation, initData);
        return address(proxy);
    }
    
    /**
     * @dev Deploy downloads proxy with initialization
     */
    function _deployDownloadsProxy(
        string memory artistId,
        address owner
    ) internal returns (address) {
        bytes memory initData = abi.encodeWithSignature(
            "initialize(string,string,address)",
            artistId,
            "https://zeyoda.com/metadata/",
            owner
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(downloadsImplementation, initData);
        return address(proxy);
    }
    
    /**
     * @dev Fund factory with ETH for LP seeding (protocol subsidizes)
     */
    function fundFactory() external payable onlyOwner {
        emit FactoryFunded(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw ETH from factory (emergency)
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(owner()).transfer(amount);
    }
    
    /**
     * @dev Get factory ETH balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Allow factory to receive ETH
     */
    receive() external payable {
        emit FactoryFunded(msg.sender, msg.value);
    }
}

