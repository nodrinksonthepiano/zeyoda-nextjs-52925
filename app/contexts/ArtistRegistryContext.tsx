'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import useArtistRegistry, { ArtistRegistry } from '../hooks/useArtistRegistry';

interface ArtistRegistryContextType {
  registry: ArtistRegistry | null;
  isLoading: boolean;
  error: Error | null;
  refreshRegistry: () => void;
}

const ArtistRegistryContext = createContext<ArtistRegistryContextType | undefined>(undefined);

export const ArtistRegistryProvider = ({ children }: { children: ReactNode }) => {
  const { registry, isLoading, error, refreshRegistry } = useArtistRegistry();

  return (
    <ArtistRegistryContext.Provider value={{ registry, isLoading, error, refreshRegistry }}>
      {children}
    </ArtistRegistryContext.Provider>
  );
};

export const useArtistRegistryContext = () => {
  const context = useContext(ArtistRegistryContext);
  if (context === undefined) {
    throw new Error('useArtistRegistryContext must be used within an ArtistRegistryProvider');
  }
  return context;
}; 