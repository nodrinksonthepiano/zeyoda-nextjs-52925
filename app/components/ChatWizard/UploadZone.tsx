'use client';

import React, { useCallback, useState } from 'react';
import { useChatWizard } from '../../contexts/ChatWizardContext';

interface UploadZoneProps {
  className?: string;
}

export function UploadZone({ className = '' }: UploadZoneProps) {
  const { wizardState, submitResponse } = useChatWizard();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const validTypes = ['video/mp4', 'video/mov', 'audio/mp3', 'audio/wav', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      return validTypes.includes(file.type);
    });

    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
      submitResponse({ mediaFiles: validFiles });
    }
  }, [submitResponse]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files]);
      submitResponse({ mediaFiles: files });
    }
  }, [submitResponse]);

  return (
    <div className={`relative w-full max-w-4xl mx-auto ${className}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative w-full h-96 border-4 border-dashed rounded-lg
          transition-all duration-300 ease-in-out
          ${isDragOver 
            ? 'border-yellow-400 bg-yellow-400 bg-opacity-10' 
            : 'border-yellow-600 bg-gray-800 bg-opacity-30'
          }
          flex flex-col items-center justify-center
          cursor-pointer hover:border-yellow-400 hover:bg-yellow-400 hover:bg-opacity-5
        `}
      >
        {/* Upload Icon */}
        <div className="text-6xl mb-4 text-yellow-400">
          {uploadedFiles.length > 0 ? '✅' : '📁'}
        </div>
        
        {/* Upload Text */}
        <div className="text-center text-yellow-100">
          {uploadedFiles.length > 0 ? (
            <>
              <h3 className="text-xl font-bold mb-2">
                {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} uploaded
              </h3>
              <p className="text-sm opacity-75">
                {uploadedFiles.map(f => f.name).join(', ')}
              </p>
              <p className="text-sm mt-2 opacity-50">
                Drop more files or click to add additional media
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold mb-2">Upload Your Featured Media</h3>
              <p className="text-sm opacity-75">
                Drag & drop or click to upload
              </p>
              <p className="text-xs mt-2 opacity-50">
                Supports: .mp4, .mov, .mp3, .wav, .jpg, .png, .gif
              </p>
            </>
          )}
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          multiple
          accept=".mp4,.mov,.mp3,.wav,.jpg,.jpeg,.png,.gif"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {/* Gold trim border overlay */}
        <div className="absolute inset-0 border-2 border-yellow-400 rounded-lg opacity-20 pointer-events-none"></div>
      </div>

      {/* Uploaded files preview */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-3 bg-gray-800 bg-opacity-50 p-3 rounded-lg border border-yellow-600">
              <div className="text-yellow-400">
                {file.type.startsWith('video/') ? '🎥' : 
                 file.type.startsWith('audio/') ? '🎵' : '🖼️'}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-gray-400 text-sm">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 