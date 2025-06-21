// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ArtistNFT is ERC721, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    string public baseTokenURI;

    constructor(
        string memory name,
        string memory symbol,
        address initialOwner,
        string memory initialBaseURI
    ) ERC721(name, symbol) Ownable(initialOwner) {
        baseTokenURI = initialBaseURI;
    }

    function safeMint(address to, string memory uri) public onlyOwner {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        // Note: OpenZeppelin's ERC721 standard doesn't have a built-in setTokenURI function
        // for individual tokens by default in recent versions. The URI is typically managed
        // off-chain or via a base URI. For this implementation, we assume the URI is
        // managed externally or follows a pattern with the baseTokenURI.
        // If per-token URI is needed, the _setTokenURI function can be exposed.
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function setBaseURI(string memory newBaseURI) public onlyOwner {
        baseTokenURI = newBaseURI;
    }
} 