import { ethers } from 'ethers';
import erc20Abi from '@/contracts/Artistock.json';

export function getArtistockContract(address: string, signer: ethers.Signer) {
  return new ethers.Contract(address, erc20Abi.abi, signer);
} 