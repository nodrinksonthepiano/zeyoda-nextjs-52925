// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ArtistNFT is ERC721, Ownable {
    uint256 private _nextTokenId;
    string public baseTokenURI;

    constructor(
        string memory name,
        string memory symbol,
        address initialOwner,
        string memory initialBaseURI
    ) ERC721(name, symbol) Ownable(initialOwner) {
        baseTokenURI = initialBaseURI;
        _nextTokenId = 1; // Start token IDs at 1
    }

    function safeMint(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function setBaseURI(string memory newBaseURI) public onlyOwner {
        baseTokenURI = newBaseURI;
    }

    function totalSupply() public view returns (uint256) {
        return _nextTokenId - 1;
    }
} 