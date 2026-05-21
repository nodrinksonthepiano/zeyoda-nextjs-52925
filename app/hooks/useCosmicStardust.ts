'use client';

import { useEffect } from 'react';

const PARTICLE_COUNT = 30;

function spawnStardust(container: HTMLElement) {
  container.replaceChildren();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');

    const size = Math.random() * 8 + 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.animationDelay = `${Math.random() * 15}s`;
    particle.style.setProperty('--startX', '0px');
    particle.style.setProperty('--startY', '0px');
    particle.style.setProperty('--endX', `${(Math.random() - 0.5) * 120}px`);
    particle.style.setProperty('--endY', `${(Math.random() - 0.5) * 120}px`);
    particle.style.setProperty('--opacityMax', `${0.25 + Math.random() * 0.45}`);
    particle.style.setProperty('--endScale', `${0.4 + Math.random() * 0.6}`);

    container.appendChild(particle);
  }
}

/** Floating starfield in `#particles` when enabled; clears container when off. */
export function useCosmicStardust(enabled: boolean, containerId = 'particles') {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!enabled) {
      container.replaceChildren();
      return;
    }

    spawnStardust(container);
    return () => {
      container.replaceChildren();
    };
  }, [enabled, containerId]);
}
