export interface ArtistConfig {
  artistName: string;
  contractAddress: string;
  tokenPrice: number;
  downloadPrice: number;
  mainVideo: string;
  artwork: {
    title: string;
    year: string;
    description: string;
    downloadUrl: string;
  };
  socials: {
    twitter?: string;
    instagram?: string;
    website?: string;
  };
  theme: {
    primaryColor: string;
    accentColor: string;
    gradientStart: string;
    gradientMiddle: string;
    gradientEnd: string;
    fontFamily: string;
    orbitPerspective: string;
  };
  orbitingTokens: {
    id: string;
    name: string;
    period: number;
    xRadius: number;
    zRadius: number;
    yRotation: number;
    xRotation: number;
  }[];
} 