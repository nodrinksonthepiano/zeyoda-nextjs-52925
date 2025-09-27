"use client";
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useCarouselGestures } from '../hooks/useCarouselGestures';
import { CarouselAsset } from '../hooks/useCarouselAssets';

export interface FeaturedContentCarouselProps {
  assets: CarouselAsset[];
  renderSlide: (asset: CarouselAsset, isActive: boolean) => React.ReactNode;
  onIndexChange?: (index: number) => void;
  className?: string;
}

const FeaturedContentCarousel: React.FC<FeaturedContentCarouselProps> = ({
  assets,
  renderSlide,
  onIndexChange,
  className = ""
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate prev/current/next assets for 3-slide window
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : assets.length - 1;
  const nextIndex = currentIndex < assets.length - 1 ? currentIndex + 1 : 0;
  
  const prevAsset = assets.length > 1 ? assets[prevIndex] : null;
  const currentAsset = assets[currentIndex] || null;
  const nextAsset = assets.length > 1 ? assets[nextIndex] : null;

  // Handle navigation
  const navigateToSlide = useCallback((direction: 'next' | 'prev') => {
    if (assets.length <= 1) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = currentIndex < assets.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : assets.length - 1;
    }

    setCurrentIndex(newIndex);
    onIndexChange?.(newIndex);
    
    console.log(`🎠 Navigated ${direction} to slide ${newIndex + 1}/${assets.length}`);
  }, [currentIndex, assets.length, onIndexChange]);

  // Handle drag interactions
  const handleDrag = useCallback((deltaY: number, progress: number) => {
    setIsDragging(true);
    setDragOffset(deltaY);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  // Set up gesture handling
  useCarouselGestures({
    onAdvance: navigateToSlide,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
    containerRef,
    velocityThreshold: 500,
    distanceThreshold: 50
  });

  // Calculate transforms for 3D ferris-wheel effect
  const getSlideTransform = (position: 'prev' | 'current' | 'next') => {
    let baseTransform = '';
    
    if (isDragging) {
      // During drag: current slide follows finger
      if (position === 'current') {
        const dragY = Math.max(-100, Math.min(100, dragOffset * 0.5));
        baseTransform = `translate3d(0, ${dragY}px, 0)`;
      } else if (position === 'next') {
        // Next slide comes forward as we drag up
        const progress = Math.max(0, Math.min(1, -dragOffset / 100));
        const translateY = 12 - (progress * 8); // From 12% to 4%
        const translateZ = -40 + (progress * 20); // From -40px to -20px
        const rotateX = 8 - (progress * 4); // From 8deg to 4deg
        const opacity = 0.9 + (progress * 0.1); // From 0.9 to 1.0
        baseTransform = `translateY(${translateY}%) translateZ(${translateZ}px) rotateX(${rotateX}deg)`;
        return { transform: baseTransform, opacity };
      } else if (position === 'prev') {
        // Previous slide moves further back as we drag down
        const progress = Math.max(0, Math.min(1, dragOffset / 100));
        const translateY = -100 - (progress * 10); // From -100% to -110%
        const translateZ = -60 - (progress * 20); // From -60px to -80px
        const rotateX = -5 - (progress * 3); // From -5deg to -8deg
        baseTransform = `translateY(${translateY}%) translateZ(${translateZ}px) rotateX(${rotateX}deg)`;
      }
    } else {
      // Static positions
      switch (position) {
        case 'prev':
          baseTransform = 'translateY(-100%) translateZ(-60px) rotateX(-5deg)';
          break;
        case 'current':
          baseTransform = 'translateY(0) translateZ(0) rotateX(0deg)';
          break;
        case 'next':
          baseTransform = 'translateY(12%) translateZ(-40px) rotateX(8deg)';
          break;
      }
    }

    return { transform: baseTransform };
  };

  // Slide wrapper style
  const getSlideStyle = (position: 'prev' | 'current' | 'next') => {
    const baseStyle = getSlideTransform(position);
    
    return {
      position: 'absolute' as const,
      inset: 0,
      willChange: 'transform',
      transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.22, 0.61, 0.36, 1)',
      borderRadius: '0.75rem',
      overflow: 'hidden' as const,
      zIndex: position === 'current' ? 20 : position === 'next' ? 10 : 5,
      opacity: position === 'next' && !isDragging ? 0.9 : (baseStyle.opacity || 1),
      ...baseStyle
    };
  };

  // Don't render if no assets
  if (!assets.length || !currentAsset) {
    return null;
  }

  return (
    <div className={`carousel-stage ${className}`}>
      {/* Outer wrapper - keeps same size as original featured content */}
      <div 
        ref={containerRef}
        className="relative w-full"
        style={{ 
          touchAction: 'pan-y',
          WebkitUserSelect: 'none',
          userSelect: 'none'
        }}
      >
        {/* 3D stage container - ONLY transforms slides, not the parent */}
        <div
          className="featured-stage"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            perspective: '1200px',
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Previous slide (hidden above) */}
          {prevAsset && (
            <div style={getSlideStyle('prev')}>
              {renderSlide(prevAsset, false)}
            </div>
          )}

          {/* Current slide (front and center) */}
          <div style={getSlideStyle('current')}>
            {renderSlide(currentAsset, true)}
          </div>

          {/* Next slide (peeking behind) */}
          {nextAsset && (
            <div style={getSlideStyle('next')}>
              {renderSlide(nextAsset, false)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeaturedContentCarousel;