import { renderHook } from '@testing-library/react';
import { useOrbitTokens } from '../app/hooks/useOrbitTokens';
import { ArtistConfig } from '../types/artist-types';

// Mock artist config for testing
const mockAllArtistsConfig: { [key: string]: ArtistConfig } = {
  gosheesh: {
    name: 'gosheesh',
    displayName: 'GOSHEESH',
    tokenName: 'GOSH33SH',
    artworkTitle: 'Test Artwork',
    artworkYear: '2024',
    tokenPrice: 1.0,
    videoSrc: '/assets/1GOSHEESH.mp4',
    theme: {
      primaryColor: '#ff0000',
      accentColor: '#00ff00',
      gradientStart: '#ff0000',
      gradientMiddle: '#00ff00',
      gradientEnd: '#0000ff',
      fontFamily: 'Arial'
    },
    orbitalTokens: []
  },
  jaitea: {
    name: 'jaitea',
    displayName: 'JAI TEA',
    tokenName: 'JAIT33',
    artworkTitle: 'Test Artwork 2',
    artworkYear: '2024',
    tokenPrice: 1.0,
    videoSrc: '/assets/2JAITEA.mp4',
    theme: {
      primaryColor: '#0000ff',
      accentColor: '#ff0000',
      gradientStart: '#0000ff',
      gradientMiddle: '#ff0000',
      gradientEnd: '#00ff00',
      fontFamily: 'Arial'
    },
    orbitalTokens: []
  }
};

describe('useOrbitTokens', () => {
  it('should return empty array when allArtistsConfig is null', () => {
    const { result } = renderHook(() => 
      useOrbitTokens({}, null)
    );
    
    expect(result.current).toEqual([]);
  });

  it('should return all tokens with zero balance when user has no tokens', () => {
    const { result } = renderHook(() => 
      useOrbitTokens({}, mockAllArtistsConfig)
    );
    
    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toEqual({
      symbol: 'GOSH33SH',
      displayName: 'GOSHEESH',
      img: '/assets/1GOSHEESH.mp4',
      balance: 0n,
      artistId: 'gosheesh'
    });
    expect(result.current[1]).toEqual({
      symbol: 'JAIT33',
      displayName: 'JAI TEA',
      img: '/assets/2JAITEA.mp4',
      balance: 0n,
      artistId: 'jaitea'
    });
  });

  it('should return tokens with correct balances when user owns tokens', () => {
    const userTokenBalances = {
      'GOSH33SH': 100n,
      'JAIT33': 50n
    };
    
    const { result } = renderHook(() => 
      useOrbitTokens(userTokenBalances, mockAllArtistsConfig)
    );
    
    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toEqual({
      symbol: 'GOSH33SH',
      displayName: 'GOSHEESH',
      img: '/assets/1GOSHEESH.mp4',
      balance: 100n,
      artistId: 'gosheesh'
    });
    expect(result.current[1]).toEqual({
      symbol: 'JAIT33',
      displayName: 'JAI TEA',
      img: '/assets/2JAITEA.mp4',
      balance: 50n,
      artistId: 'jaitea'
    });
  });

  it('should sort tokens deterministically by displayName', () => {
    const { result } = renderHook(() => 
      useOrbitTokens({}, mockAllArtistsConfig)
    );
    
    expect(result.current[0].displayName).toBe('GOSHEESH');
    expect(result.current[1].displayName).toBe('JAI TEA');
  });

  it('should handle unknown token symbols gracefully', () => {
    const userTokenBalances = {
      'UNKNOWN_TOKEN': 100n
    };
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    const { result } = renderHook(() => 
      useOrbitTokens(userTokenBalances, mockAllArtistsConfig)
    );
    
    expect(result.current).toHaveLength(2); // Still returns all known tokens
    expect(consoleSpy).toHaveBeenCalledWith(
      'useOrbitTokens: No artist config found for token symbol "UNKNOWN_TOKEN"'
    );
    
    consoleSpy.mockRestore();
  });
}); 