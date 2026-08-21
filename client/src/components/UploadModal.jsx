import React, { useState } from 'react';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';

export default function UploadModal({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await processUpload(e.target.files[0]);
    }
  };

  const processUpload = async (file) => {
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/v1/media/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload image.');
      }

      onUploadSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="hud-card p-5 bg-white border-zinc-200 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm text-zinc-900">
          Upload Image Specimen
        </h2>
        <span className="text-xs text-zinc-400 font-mono">
          Async Worker Pipeline
        </span>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer relative overflow-hidden ${
          isDragging
            ? 'border-zinc-900 bg-zinc-100 shadow-inner'
            : 'border-zinc-200 hover:border-zinc-400 bg-zinc-50/50'
        }`}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={uploading}
        />

        <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
          {uploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-zinc-900 animate-spin mb-2" />
              <p className="text-xs text-zinc-900 font-medium">
                Uploading to async pipeline worker...
              </p>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700 mb-1 border border-zinc-200">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-zinc-800 font-medium">
                  Drag and drop image here or <span className="underline font-semibold">browse files</span>
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Supports JPEG, PNG, WEBP, BMP up to 25MB
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
