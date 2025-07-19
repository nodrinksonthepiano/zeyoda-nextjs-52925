'use client';

import React, { useEffect, useMemo } from 'react';
import { useChatWizard } from '@/app/hooks/useChatWizard'; // Corrected path

export function RealTimePreview() {
  const { wizardState } = useChatWizard();
  const { isActive, data } = wizardState;

  // Memoize data to prevent unnecessary re-renders
  const {
    fontFamily,
    primaryColor,
    accentColor,
    gradientStart,
    gradientMiddle,
    gradientEnd,
  } = useMemo(() => data, [data]);

  // Effect to apply styles to the body
  useEffect(() => {
    if (isActive) {
      document.body.style.setProperty('--primary-color', primaryColor);
      document.body.style.setProperty('--accent-color', accentColor);
      document.body.style.setProperty('--font-family', fontFamily);
      document.body.style.background = `linear-gradient(135deg, ${gradientStart}, ${gradientMiddle}, ${gradientEnd})`;
    }

    // Cleanup effect when wizard is not active
    return () => {
      document.body.style.removeProperty('--primary-color');
      document.body.style.removeProperty('--accent-color');
      document.body.style.removeProperty('--font-family');
      document.body.style.background = '';
    };
  }, [isActive, primaryColor, accentColor, fontFamily, gradientStart, gradientMiddle, gradientEnd]);

  if (!isActive) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-0 transition-all duration-500"
      style={{
        background: `linear-gradient(135deg, ${gradientStart}, ${gradientMiddle}, ${gradientEnd})`,
        fontFamily: fontFamily,
      }}
    />
  );
} 