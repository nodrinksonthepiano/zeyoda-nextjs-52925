'use client'

import React, { useState, useRef } from 'react';
import { MediaFile, useChatWizard } from '../../contexts/ChatWizardContext';

interface MediaUploadProps {
  onFilesUploaded: (files: MediaFile[]) => void;
  existingFiles: MediaFile[];
}

export function MediaUpload({ onFilesUploaded, existingFiles }: MediaUploadProps) {
  const { updateData, addMessage, nextStep } = useChatWizard();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<MediaFile[]>(existingFiles);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedTypes = [
    'video/mp4', 'video/mov', 'video/quicktime',
    'audio/mp3', 'audio/wav', 'audio/mpeg',
    'image/jpeg', 'image/png', 'image/gif'
  ];

  const handleFiles = (files: FileList) => {
    const newFiles: MediaFile[] = [];
    
    Array.from(files).forEach((file, index) => {
      if (supportedTypes.includes(file.type)) {
        const mediaFile: MediaFile = {
          file,
          title: file.name.split('.')[0], // Default title from filename
          year: new Date().getFullYear().toString(),
          assetNumber: uploadedFiles.length + index + 1,
          preview: URL.createObjectURL(file)
        };
        newFiles.push(mediaFile);
      }
    });

    if (newFiles.length > 0) {
      const allFiles = [...uploadedFiles, ...newFiles];
      setUploadedFiles(allFiles);
      updateData({ mediaFiles: allFiles });
      onFilesUploaded(allFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const updateFileMetadata = (index: number, field: 'title' | 'year', value: string) => {
    const updated = [...uploadedFiles];
    updated[index][field] = value;
    setUploadedFiles(updated);
    updateData({ mediaFiles: updated });
  };

  const removeFile = (index: number) => {
    const updated = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updated);
    updateData({ mediaFiles: updated });
  };

  const handleContinue = () => {
    if (uploadedFiles.length === 0) return;
    
    addMessage({
      type: 'user',
      content: `Uploaded ${uploadedFiles.length} file(s): ${uploadedFiles.map(f => f.title).join(', ')}`
    });

    setTimeout(() => {
      nextStep();
    }, 500);
  };

  return (
    <div className="wizard-media-upload p-4 bg-gray-800 bg-opacity-70 rounded-lg mt-3 max-w-3xl">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging 
            ? 'border-blue-400 bg-blue-900 bg-opacity-20' 
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          onChange={handleFileInput}
          className="hidden"
        />
        <div className="text-gray-300">
          <div className="text-4xl mb-2">📁</div>
          <div className="text-sm">
            Drag & drop your media files here, or <span className="text-blue-400 underline">click to browse</span>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Supports: MP4, MOV, MP3, WAV, JPG, PNG, GIF
          </div>
        </div>
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4">
          <h5 className="text-white text-sm font-medium mb-3">Uploaded Files:</h5>
          <div className="space-y-3">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-3">
                <div className="flex items-start space-x-3">
                  {/* Preview */}
                  <div className="w-16 h-16 bg-gray-600 rounded-lg flex items-center justify-center text-2xl">
                    {file.file.type.startsWith('video/') && '🎬'}
                    {file.file.type.startsWith('audio/') && '🎵'}
                    {file.file.type.startsWith('image/') && (
                      <img src={file.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={file.title}
                      onChange={(e) => updateFileMetadata(index, 'title', e.target.value)}
                      placeholder="Enter title..."
                      className="w-full p-2 text-sm bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
                    />
                    <input
                      type="text"
                      value={file.year}
                      onChange={(e) => updateFileMetadata(index, 'year', e.target.value)}
                      placeholder="Year"
                      className="w-24 p-2 text-sm bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
                    />
                    <div className="text-xs text-gray-400">
                      {file.file.name} ({(file.file.size / 1024 / 1024).toFixed(1)} MB)
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Continue with {uploadedFiles.length} file(s) →
          </button>
        </div>
      )}
    </div>
  );
} 