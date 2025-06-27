import React from 'react';

interface ArtistVideoProps {
  isMuted: boolean;
  isVideoError: boolean;
  setIsVideoError: (error: boolean) => void;
  toggleMute: () => void;
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  videoSrc: string;
  children: React.ReactNode; 
}

const ArtistVideo: React.FC<ArtistVideoProps> = ({
  isMuted,
  isVideoError,
  setIsVideoError,
  toggleMute,
  videoContainerRef,
  videoSrc,
  children,
}) => {

  return (
    <div ref={videoContainerRef} className="relative w-full max-w-4xl aspect-video rounded-xl shadow-2xl shadow-black/50 overflow-hidden mx-auto">
      {videoSrc && !isVideoError ? (
        <video
          id="artistVideo"
          src={videoSrc}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          key={videoSrc}
          className="w-full h-full object-cover"
          onError={() => setIsVideoError(true)}
        />
      ) : (
        <div className="w-full h-full bg-black flex flex-col items-center justify-center text-gray-400">
          <div className="text-4xl">📺</div>
          <h3 className="mt-2 text-lg">Content Preview</h3>
          <p className="text-sm">Video content {isVideoError ? 'could not be loaded' : 'is unavailable'}</p>
        </div>
      )}
      {children}
      <div className="absolute bottom-2 right-2 flex space-x-2">
        <button className="p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-75" aria-label={isMuted ? "Unmute" : "Mute"} onClick={toggleMute}>
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
};

export default ArtistVideo; 