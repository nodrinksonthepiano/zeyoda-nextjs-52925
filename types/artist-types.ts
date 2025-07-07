export interface OrbitalToken {
  name: string; 
  angle: number; 
  artistId?: string;
}

export interface RenderableToken extends OrbitalToken {
  x?: number;
  y?: number;
  z?: number;
  opacity?: number;
  scale?: number;
  blur?: number;
  isVisible?: boolean;
  element?: HTMLElement | null;
}

// Database schema types
export interface ArtistRegistryEntry {
  token: string;
  swap: string;
  downloads: string | null;
  treasury_wallet: string | null;
}

export interface ArtistDatabaseEntry {
  id: string;
  name: string;
  display_name: string;
  token_name: string;
  artwork_title: string;
  artwork_year: string;
  token_price: number;
  video_src: string;
  primary_color: string;
  accent_color: string;
  gradient_start: string;
  gradient_middle: string;
  gradient_end: string;
  font_family: string;
  orbital_tokens: OrbitalToken[];
  created_at: string;
  updated_at: string;
}

// Application types
export interface ArtistConfig {
  name: string;
  displayName: string;
  tokenName: string;
  artworkTitle: string;
  artworkYear: string;
  tokenPrice: number;
  realTimePrice?: number;
  hasLiquidityPool?: boolean;
  videoSrc: string;
  contract?: string;
  swap?: string;               // TreasurySwapLite contract address
  downloads?: string;          // ERC-1155 downloads contract
  treasury_wallet?: string;    // Treasury wallet address
  paused?: boolean;           // Emergency pause state
  theme: {
    primaryColor: string;
    accentColor: string;
    gradientStart: string;
    gradientMiddle: string;
    gradientEnd: string;
    fontFamily: string;
  };
  orbitalTokens: OrbitalToken[];
}

export interface PriceDetails {
  currentDisplayPrice: number;
  artistShare: number;
  platformShare: number;
  investorShare: number;
}

export interface UserTokenBalances {
  [tokenSymbol: string]: number;
}

export interface PurchasedDownloadInfo {
  artistId: string;
  artworkTitle: string;
  artistDisplayName: string;
  ipfsHash: string | null;
} 