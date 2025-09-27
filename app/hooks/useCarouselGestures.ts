"use client";
import { useRef, useCallback, useEffect } from 'react';

interface GestureState {
  isActive: boolean;
  startY: number;
  currentY: number;
  velocity: number;
  timestamp: number;
}

interface CarouselGesturesConfig {
  onAdvance: (direction: 'next' | 'prev') => void;
  onDrag: (deltaY: number, progress: number) => void;
  onDragEnd: () => void;
  velocityThreshold?: number;
  distanceThreshold?: number;
  containerRef: React.RefObject<HTMLElement>;
}

export function useCarouselGestures({
  onAdvance,
  onDrag,
  onDragEnd,
  velocityThreshold = 500,
  distanceThreshold = 60,
  containerRef
}: CarouselGesturesConfig) {
  const gestureState = useRef<GestureState>({
    isActive: false,
    startY: 0,
    currentY: 0,
    velocity: 0,
    timestamp: 0
  });

  const velocityTracker = useRef<Array<{ y: number; time: number }>>([]);

  const calculateVelocity = useCallback(() => {
    const points = velocityTracker.current;
    if (points.length < 2) return 0;

    const recent = points.slice(-3); // Use last 3 points for smooth velocity
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    const deltaY = last.y - first.y;
    const deltaTime = last.time - first.time;
    
    return deltaTime > 0 ? (deltaY / deltaTime) * 1000 : 0; // px/second
  }, []);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const isOverContainer = e.clientX >= rect.left && e.clientX <= rect.right && 
                           e.clientY >= rect.top && e.clientY <= rect.bottom;

    if (!isOverContainer) return;

    gestureState.current = {
      isActive: true,
      startY: e.clientY,
      currentY: e.clientY,
      velocity: 0,
      timestamp: Date.now()
    };

    velocityTracker.current = [{ y: e.clientY, time: Date.now() }];
    
    // Capture pointer for smooth tracking
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
  }, [containerRef]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!gestureState.current.isActive) return;

    const currentY = e.clientY;
    const deltaY = currentY - gestureState.current.startY;
    const absDeltaY = Math.abs(deltaY);
    
    // Update velocity tracking
    const now = Date.now();
    velocityTracker.current.push({ y: currentY, time: now });
    if (velocityTracker.current.length > 5) {
      velocityTracker.current.shift(); // Keep only recent points
    }

    // Always prevent default and handle drag once we start moving
    if (absDeltaY > 5) {
      e.preventDefault();
      e.stopPropagation();
      
      // Calculate progress (0 to 1) for smooth animations
      const progress = Math.min(absDeltaY / 100, 1);
      
      gestureState.current.currentY = currentY;
      gestureState.current.velocity = calculateVelocity();
      
      onDrag(deltaY, progress);
    }
  }, [onDrag, calculateVelocity]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!gestureState.current.isActive) return;

    const deltaY = gestureState.current.currentY - gestureState.current.startY;
    const velocity = calculateVelocity();
    const absDeltaY = Math.abs(deltaY);
    const absVelocity = Math.abs(velocity);

    // Determine action based on velocity and distance
    let action: 'next' | 'prev' | 'return' = 'return';

    if (absVelocity > velocityThreshold) {
      // High velocity - REVERSED: swipe up (negative velocity) = next
      action = velocity < 0 ? 'next' : 'prev';
    } else if (absDeltaY > distanceThreshold) {
      // Sufficient distance - REVERSED: swipe up (negative deltaY) = next
      action = deltaY < 0 ? 'next' : 'prev';
    }

    // Reset gesture state
    gestureState.current.isActive = false;
    velocityTracker.current = [];

    // Execute action
    if (action !== 'return') {
      onAdvance(action);
    }
    
    onDragEnd();

    // Release pointer capture
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
  }, [onAdvance, onDragEnd, calculateVelocity, velocityThreshold, distanceThreshold]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target !== document.body) return; // Only when not in input fields

    switch (e.key) {
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        onAdvance('prev');
        break;
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        onAdvance('next');
        break;
    }
  }, [onAdvance]);

  // Touch event handlers as fallback
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    const isOverContainer = touch.clientX >= rect.left && touch.clientX <= rect.right && 
                           touch.clientY >= rect.top && touch.clientY <= rect.bottom;

    if (!isOverContainer) return;

    gestureState.current = {
      isActive: true,
      startY: touch.clientY,
      currentY: touch.clientY,
      velocity: 0,
      timestamp: Date.now()
    };

    velocityTracker.current = [{ y: touch.clientY, time: Date.now() }];
  }, [containerRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!gestureState.current.isActive) return;

    const touch = e.touches[0];
    const currentY = touch.clientY;
    const deltaY = currentY - gestureState.current.startY;
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaY > 5) {
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      velocityTracker.current.push({ y: currentY, time: now });
      if (velocityTracker.current.length > 5) {
        velocityTracker.current.shift();
      }

      const progress = Math.min(absDeltaY / 100, 1);
      gestureState.current.currentY = currentY;
      gestureState.current.velocity = calculateVelocity();
      
      onDrag(deltaY, progress);
    }
  }, [onDrag, calculateVelocity]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!gestureState.current.isActive) return;

    const deltaY = gestureState.current.currentY - gestureState.current.startY;
    const velocity = calculateVelocity();
    const absDeltaY = Math.abs(deltaY);
    const absVelocity = Math.abs(velocity);

    let action: 'next' | 'prev' | 'return' = 'return';

    if (absVelocity > velocityThreshold) {
      action = velocity < 0 ? 'next' : 'prev';
    } else if (absDeltaY > distanceThreshold) {
      action = deltaY < 0 ? 'next' : 'prev';
    }

    gestureState.current.isActive = false;
    velocityTracker.current = [];

    if (action !== 'return') {
      onAdvance(action);
    }
    
    onDragEnd();
  }, [onAdvance, onDragEnd, calculateVelocity, velocityThreshold, distanceThreshold]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Pointer events for unified mouse/touch handling
    container.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    
    // Touch events as fallback
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    document.addEventListener('keydown', handleKeyDown);

    // Prevent context menu on long press
    container.addEventListener('contextmenu', (e) => {
      if (gestureState.current.isActive) {
        e.preventDefault();
      }
    });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('contextmenu', () => {});
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp, handleTouchStart, handleTouchMove, handleTouchEnd, handleKeyDown, containerRef]);

  return {
    isGesturing: gestureState.current.isActive
  };
}
