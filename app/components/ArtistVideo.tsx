import React, { useState, useRef, useEffect } from 'react';

interface ArtistVideoProps {
  isMuted: boolean;
  isVideoError: boolean;
  setIsVideoError: (error: boolean) => void;
  toggleMute: () => void;
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  videoSrc: string;
  fileType?: string; // Add file type to determine if it's image or video
  children?: React.ReactNode; 
}

const ArtistVideo: React.FC<ArtistVideoProps> = ({
  isMuted,
  isVideoError,
  setIsVideoError,
  toggleMute,
  videoContainerRef,
  videoSrc,
  fileType,
  children,
}) => {
  
  // Determine if this is an image or video
  const isImage = fileType?.startsWith('image/') || false;
  const isVideo = fileType?.startsWith('video/') || !fileType; // Default to video for legacy content
  
  // Dynamic sizing state
  const [contentDimensions, setContentDimensions] = useState({ width: 0, height: 0, aspectRatio: 16/9 });
  const [isLoaded, setIsLoaded] = useState(false);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

  // Handle media load to get natural dimensions
  const handleMediaLoad = (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
    const element = e.currentTarget;
    let naturalWidth = 0;
    let naturalHeight = 0;
    
    if (element instanceof HTMLImageElement) {
      naturalWidth = element.naturalWidth;
      naturalHeight = element.naturalHeight;
    } else if (element instanceof HTMLVideoElement) {
      naturalWidth = element.videoWidth;
      naturalHeight = element.videoHeight;
    }
    
    if (naturalWidth && naturalHeight) {
      const aspectRatio = naturalWidth / naturalHeight;
      setContentDimensions({ width: naturalWidth, height: naturalHeight, aspectRatio });
      console.log(`📐 Content dimensions: ${naturalWidth}x${naturalHeight}, aspect ratio: ${aspectRatio.toFixed(2)}`);
    }
    setIsLoaded(true);
  };

  // Calculate responsive container style - natural aspect ratio with mobile-first sizing
  const getContainerStyle = () => {
    const { aspectRatio } = contentDimensions;
    
    // Use natural aspect ratio when available, fallback to 16:9
    const finalAspectRatio = isLoaded && aspectRatio ? aspectRatio : 16/9;
    
    // Mobile-first responsive width with gentle buffer
    let maxWidth = '90vw'; // Default mobile width
    let desktopMaxWidth = '800px'; // Default desktop max
    
    if (finalAspectRatio > 1.5) {
      // Wide content (landscape) - use more screen width
      maxWidth = '95vw';
      desktopMaxWidth = '900px';
    } else if (finalAspectRatio < 0.8) {
      // Tall content (portrait) - use less screen width
      maxWidth = '75vw';
      desktopMaxWidth = '500px';
    }
    
    return {
      width: '100%',
      maxWidth: `min(${maxWidth}, ${desktopMaxWidth})`,
      aspectRatio: finalAspectRatio.toString()
    };
  };

  return (
    <div 
      ref={videoContainerRef} 
      className="relative mx-auto rounded-xl shadow-2xl shadow-black/50 overflow-hidden transition-all duration-300"
      style={getContainerStyle()}
    >
      {videoSrc && !isVideoError ? (
        isImage ? (
          // Display image content with dynamic sizing
          <img
            ref={mediaRef as React.RefObject<HTMLImageElement>}
            id="artistImage"
            src={videoSrc}
            alt="Artist content"
            className="w-full h-full object-cover"
            onLoad={handleMediaLoad}
            onError={() => setIsVideoError(true)}
            style={{ opacity: isLoaded ? 1 : 0 }}
          />
        ) : (
          // Display video content with dynamic sizing
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            id="artistVideo"
            src={videoSrc}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            key={videoSrc}
            className="w-full h-full object-cover"
            onLoadedMetadata={handleMediaLoad}
            onError={() => setIsVideoError(true)}
            style={{ opacity: isLoaded ? 1 : 0 }}
          />
        )
      ) : (
        <div className="w-full h-full bg-black flex flex-col items-center justify-center text-gray-400 min-h-[300px]">
          <div className="text-4xl">{isImage ? '🖼️' : '📺'}</div>
          <h3 className="mt-2 text-lg">Content Preview</h3>
          <p className="text-sm">{isImage ? 'Image' : 'Video'} content {isVideoError ? 'could not be loaded' : 'is unavailable'}</p>
        </div>
      )}
      
      {/* Orbital tokens and other children */}
      {children}
      
      {/* Only show mute button for videos */}
      {isVideo && (
        <div className="absolute bottom-2 right-2 flex space-x-2 z-10">
          <button 
            className="p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-75 transition-all" 
            aria-label={isMuted ? "Unmute" : "Mute"} 
            onClick={toggleMute}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      )}
      
      {/* Loading indicator */}
      {!isLoaded && videoSrc && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-white text-lg">Loading content...</div>
        </div>
      )}
    </div>
  );
};

export default ArtistVideo; 