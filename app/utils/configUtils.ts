export interface ArtistTheme {
  primaryColor: string;
  accentColor: string;
  gradientStart: string;
  gradientMiddle: string;
  gradientEnd: string;
  fontFamily: string;
}

export interface OrbitalToken {
  name: string;
  angle: number;
  artistId?: string;
  x?: number;
  y?: number;
  z?: number;
  opacity?: number;
  scale?: number;
  blur?: number;
  isVisible?: boolean;
  element?: HTMLElement | null;
}

// This is the structure expected for individual artist entries in config.json
// (keyed by wallet address or artist ID in the fallback)
export interface ArtistConfigEntry {
  artistId: string; // gosheesh, jaitea etc.
  artistName: string; // GOSHEESH - for display
  displayName?: string; // Optional display name
  tokenName: string; // GOSHEESH Token
  artworkTitle: string;
  artworkYear: string;
  tokenPrice: number;
  videoSrc: string;
  variables?: Record<string, string>; // For new wallet-based theme
  theme?: ArtistTheme; // For old artistId-based theme
  orbitalTokens: OrbitalToken[];
}

// This is the structure of the `artists` map after processing
export interface ProcessedArtistConfig extends Omit<ArtistConfigEntry, 'variables' | 'artistId'> {
  name: string; // Maps from artistName
  theme: ArtistTheme; // Ensured by processing
}

export interface GlobalDefaults {
  minimumPurchase?: number;
  initialTokenAmount?: number;
  maxTokens?: number;
  downloadPrice?: number;
  defaultPurchaseValueUSD?: number;
  [key: string]: any; // Allow other defaults
}

// The final processed configuration structure
export interface ProcessedConfig {
  artists: { [artistId: string]: ProcessedArtistConfig };
  wallets: { [walletAddress: string]: ArtistConfigEntry };
  defaults?: GlobalDefaults;
}

// Ensure config is an empty object initially if not already defined.
export let config: ProcessedConfig = {
  artists: {},
  wallets: {},
  defaults: {}
};

// Also expose config on window for non-modular scripts like wallet.js
if (typeof window !== 'undefined') {
  (window as any).config = config;
}

export function validateArtistConfig(artistConfig: ArtistConfigEntry): boolean {
  if (!artistConfig.artistId) {
    console.error('Invalid artist config: missing artistId', artistConfig);
    return false;
  }
  if (!artistConfig.artistName) {
    console.error('Invalid artist config: missing artistName for artistId:', artistConfig.artistId);
    return false;
  }

  // If using new variable-based theme, check for variables object
  if (artistConfig.variables) {
    if (typeof artistConfig.variables !== 'object') {
      console.error('Invalid artist config: variables should be an object for artistId:', artistConfig.artistId);
      return false;
    }
    const requiredVariables = [
      '--primary-color',
      '--accent-color',
      '--gradient-start',
      // '--gradient-middle', // Optional
      '--gradient-end',
      '--artist-font'
    ];
    for (const variable of requiredVariables) {
      if (!artistConfig.variables[variable]) {
        console.error(`Invalid artist config: missing CSS variable ${variable} for artistId:`, artistConfig.artistId);
        return false;
      }
    }
  } else if (artistConfig.theme) { // Check for legacy theme object
    const requiredThemeProps = ['primaryColor', 'accentColor', 'gradientStart', 'gradientEnd', 'fontFamily'];
    for (const prop of requiredThemeProps) {
      if (!(artistConfig.theme as any)[prop]) {
        console.error(`Invalid artist config: missing theme property ${prop} for artistId:`, artistConfig.artistId);
        return false;
      }
    }
  } else {
    console.error('Invalid artist config: missing theme or variables object for artistId:', artistConfig.artistId);
    return false;
  }

  if (!artistConfig.tokenName) {
    console.error('Invalid artist config: missing tokenName for artistId:', artistConfig.artistId);
    return false;
  }
  if (!artistConfig.artworkTitle) {
    console.error('Invalid artist config: missing artworkTitle for artistId:', artistConfig.artistId);
    return false;
  }
  if (!artistConfig.artworkYear) {
    console.error('Invalid artist config: missing artworkYear for artistId:', artistConfig.artistId);
    return false;
  }
  if (typeof artistConfig.tokenPrice !== 'number' || artistConfig.tokenPrice <= 0) {
    console.error('Invalid artist config: tokenPrice must be a positive number for artistId:', artistConfig.artistId);
    return false;
  }
  if (!artistConfig.videoSrc) {
    console.error('Invalid artist config: missing videoSrc for artistId:', artistConfig.artistId);
    return false;
  }
  if (!Array.isArray(artistConfig.orbitalTokens)) {
    console.error('Invalid artist config: orbitalTokens must be an array for artistId:', artistConfig.artistId);
    return false;
  }

  return true;
}

export function processConfig(rawConfig: any): ProcessedConfig {
  const processedConfig: ProcessedConfig = {
    artists: {},
    wallets: {},
    defaults: rawConfig.defaults || {}
  };

  Object.entries(rawConfig).forEach(([key, value]) => {
    if (key === 'defaults') return;

    const entry = value as ArtistConfigEntry;

    if (key.startsWith('0x')) { // Wallet-keyed entry (new format)
      processedConfig.wallets[key.toLowerCase()] = entry; // Normalize wallet address to lowercase
      if (entry.artistId) {
        const artistId = entry.artistId.toLowerCase(); // Normalize artistId
        processedConfig.artists[artistId] = {
          name: entry.artistName,
          displayName: entry.displayName || entry.artistName,
          tokenName: entry.tokenName,
          artworkTitle: entry.artworkTitle,
          artworkYear: entry.artworkYear,
          tokenPrice: entry.tokenPrice,
          videoSrc: entry.videoSrc,
          theme: entry.variables ? {
            primaryColor: entry.variables['--primary-color'],
            accentColor: entry.variables['--accent-color'],
            gradientStart: entry.variables['--gradient-start'],
            gradientMiddle: entry.variables['--gradient-middle'] || entry.variables['--gradient-start'], // Fallback for middle
            gradientEnd: entry.variables['--gradient-end'],
            fontFamily: entry.variables['--artist-font']
          } : entry.theme!,
          orbitalTokens: entry.orbitalTokens
        };
      }
    } else { // ArtistId-keyed entry (potentially old format)
      const artistId = key.toLowerCase(); // Normalize artistId
      // Only add if not already processed from a wallet entry
      if (!processedConfig.artists[artistId]) {
        processedConfig.artists[artistId] = {
          name: entry.artistName || (entry as any).name, // Old config might use "name"
          displayName: entry.displayName || entry.artistName || (entry as any).name,
          tokenName: entry.tokenName,
          artworkTitle: entry.artworkTitle,
          artworkYear: entry.artworkYear,
          tokenPrice: entry.tokenPrice,
          videoSrc: entry.videoSrc,
          theme: entry.theme!, // Old format must have theme
          orbitalTokens: entry.orbitalTokens
        };
      }
    }
  });

  // If rawConfig had a top-level 'artists' object (very old format)
  if (rawConfig.artists && typeof rawConfig.artists === 'object') {
    Object.entries(rawConfig.artists).forEach(([artistIdKey, artistDataValue]) => {
      const artistId = artistIdKey.toLowerCase();
      const artistEntry = artistDataValue as ArtistConfigEntry_Old;
      if (!processedConfig.artists[artistId]) { // Only add if not already there
        processedConfig.artists[artistId] = {
          name: artistEntry.name,
          displayName: artistEntry.displayName || artistEntry.name,
          tokenName: artistEntry.tokenName,
          artworkTitle: artistEntry.artworkTitle,
          artworkYear: artistEntry.artworkYear,
          tokenPrice: artistEntry.tokenPrice,
          videoSrc: artistEntry.videoSrc,
          theme: artistEntry.theme, // Old format must have theme
          orbitalTokens: artistEntry.orbitalTokens
        };
      }
    });
  }

  return processedConfig;
}

// Define the old artist config structure if it differs, for processConfig robustness
interface ArtistConfigEntry_Old {
  name: string;
  displayName?: string;
  tokenName: string;
  artworkTitle: string;
  artworkYear: string;
  tokenPrice: number;
  videoSrc: string;
  theme: ArtistTheme;
  orbitalTokens: OrbitalToken[];
  // artistId might not exist if keyed directly by it in an "artists" object
}

export function getArtistByWallet(walletAddress: string, currentConfig: ProcessedConfig): ArtistConfigEntry | null {
  if (!walletAddress) return null;
  const normalizedAddress = walletAddress.toLowerCase();
  return currentConfig.wallets[normalizedAddress] || null;
}

export function getWalletByArtistId(artistId: string, currentConfig: ProcessedConfig): string | null {
  if (!artistId) return null;
  const normalizedArtistId = artistId.toLowerCase();
  for (const [address, data] of Object.entries(currentConfig.wallets)) {
    if (data.artistId?.toLowerCase() === normalizedArtistId) {
      return address;
    }
  }
  return null;
}

export const FALLBACK_CONFIG: any = {
  artists: {
    "gosheesh": {
      "name": "GOSHEESH",
      "displayName": "GOSHEESH",
      "tokenName": "GOSHEESH",
      "artworkTitle": "NLi10 #1",
      "artworkYear": "2025",
      "tokenPrice": 0.0005,
      "videoSrc": "assets/gosheesh-video.mp4",
      "theme": {
        "primaryColor": "#0a1a3b",
        "accentColor": "#4073ff",
        "gradientStart": "#d4af37",
        "gradientMiddle": "#f9f295",
        "gradientEnd": "#d4af37",
        "fontFamily": "Bungee, cursive"
      },
      "orbitalTokens": [
        { "name": "LONIARI", "angle": 0 },
        { "name": "ANBRI SPPIR", "angle": 72 },
        { "name": "IJA TEA", "angle": 144, "artistId": "jaitea" },
        { "name": "NYTO SAREGL", "angle": 216 },
        { "name": "LUMLITANIDE\\nSTRIPIS", "angle": 288 }
      ]
    },
    "jaitea": {
      "name": "JAI TEA",
      "displayName": "JAI TEA",
      "tokenName": "JAI TEA",
      "artworkTitle": "Earth #2",
      "artworkYear": "2025",
      "tokenPrice": 0.0004,
      "videoSrc": "assets/jaitea-video.mp4",
      "theme": {
        "primaryColor": "#0a3b1a",
        "accentColor": "#4edfb1",
        "gradientStart": "#4edfb1",
        "gradientMiddle": "#13e7e7",
        "gradientEnd": "#4edfb1",
        "fontFamily": "Times New Roman, serif"
      },
      "orbitalTokens": [
        { "name": "LONIARI", "angle": 0 },
        { "name": "ANBRI SPPIR", "angle": 72 },
        { "name": "GOSHEESH", "angle": 144, "artistId": "gosheesh" },
        { "name": "NYTO SAREGL", "angle": 216 },
        { "name": "LUMLITANIDE\\nSTRIPIS", "angle": 288 }
      ]
    }
  },
  wallets: {
    "0xabc123def456789abcdef0123456789abcdef01": {
      "artistId": "gosheesh",
      "artistName": "GOSHEESH",
      "displayName": "GOSHEESH",
      "tokenName": "GOSHEESH",
      "artworkTitle": "NLi10 #1",
      "artworkYear": "2025",
      "tokenPrice": 0.0005,
      "videoSrc": "assets/gosheesh-video.mp4",
      "variables": {
        "--primary-color": "#0a1a3b",
        "--accent-color": "#4073ff",
        "--gradient-start": "#d4af37",
        "--gradient-middle": "#f9f295",
        "--gradient-end": "#d4af37",
        "--artist-font": "'Bungee', cursive"
      },
      "orbitalTokens": [
        { "name": "LONIARI", "angle": 0 },
        { "name": "ANBRI SPPIR", "angle": 72 },
        { "name": "IJA TEA", "angle": 144, "artistId": "jaitea" },
        { "name": "NYTO SAREGL", "angle": 216 },
        { "name": "LUMLITANIDE\\nSTRIPIS", "angle": 288 }
      ]
    },
    "0xdef456abc789012def3456789abcdef01234567": {
      "artistId": "jaitea",
      "artistName": "JAI TEA",
      "displayName": "JAI TEA",
      "tokenName": "JAI TEA",
      "artworkTitle": "Earth #2",
      "artworkYear": "2025",
      "tokenPrice": 0.0004,
      "videoSrc": "assets/jaitea-video.mp4",
      "variables": {
        "--primary-color": "#0a3b1a",
        "--accent-color": "#4edfb1",
        "--gradient-start": "#4edfb1",
        "--gradient-middle": "#13e7e7",
        "--gradient-end": "#4edfb1",
        "--artist-font": "'Times New Roman', serif"
      },
      "orbitalTokens": [
        { "name": "LONIARI", "angle": 0 },
        { "name": "ANBRI SPPIR", "angle": 72 },
        { "name": "GOSHEESH", "angle": 144, "artistId": "gosheesh" },
        { "name": "NYTO SAREGL", "angle": 216 },
        { "name": "LUMLITANIDE\\nSTRIPIS", "angle": 288 }
      ]
    }
  },
  "defaults": {
    "minimumPurchase": 1,
    "initialTokenAmount": 100,
    "maxTokens": 1000000000,
    "downloadPrice": 1,
    "defaultPurchaseValueUSD": 20
  }
};