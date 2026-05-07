'use client';

import React from 'react';

export type ArtistPortalTitleProps = {
  children: React.ReactNode;
  fontFamily: string;
  color: string;
  /** Optional native tooltip (e.g. treasure token line or onboarding hint). */
  title?: string;
  onDoubleClick?: () => void;
};

/**
 * Shared artist <h1> for live portal and treasure shell.
 * Fluid type + wrapping so long names never clip on narrow phones; short names stay hero-scale.
 */
export default function ArtistPortalTitle({
  children,
  fontFamily,
  color,
  title,
  onDoubleClick,
}: ArtistPortalTitleProps) {
  return (
    <h1
      className="mx-auto w-full max-w-[min(100%,42rem)] px-1 text-center font-bold tracking-wide sm:tracking-wider md:tracking-wider mt-1 md:mt-2 mb-3 md:mb-3 cursor-pointer hover:opacity-80 transition-opacity"
      style={{
        fontFamily,
        color,
        position: 'relative',
        zIndex: 100,
        pointerEvents: onDoubleClick ? 'auto' : 'none',
        lineHeight: 1.15,
        marginLeft: 'auto',
        marginRight: 'auto',
        fontSize: 'clamp(1.25rem, 4vw + 1rem, 3rem)',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      }}
      title={title}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </h1>
  );
}
