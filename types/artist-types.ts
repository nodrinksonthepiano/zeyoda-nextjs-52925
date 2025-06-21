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

export interface ArtistConfig {
  name: string;
  displayName: string;
  tokenName: string;
  artworkTitle: string;
  artworkYear: string;
  tokenPrice: number;
  videoSrc: string;
  contract?: string;
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