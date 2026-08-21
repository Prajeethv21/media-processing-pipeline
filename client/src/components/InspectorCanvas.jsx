import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Eye, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function InspectorCanvas({ mediaItem }) {
  const [zoom, setZoom] = useState(1);
  const [filterMode, setFilterMode] = useState('NORMAL');
  const [showOverlays, setShowOverlays] = useState(true);

  if (!mediaItem) {
    return (
      <div className="hud-card h-[440px] rounded-xl flex flex-col items-center justify-center text-center p-6 border-dashed border-zinc-200">
        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3">
          <Eye className="w-6 h-6" />
        </div>
        <p className="font-semibold text-zinc-800 text-sm">No Image Selected</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
          Upload an image or select an item from the stream below to inspect real-time processing results.
        </p>
      </div>
    );
  }

  const results = mediaItem.results || mediaItem.analysisResults;
  const checks = results?.checks || {};
  const tags = mediaItem.issueTags || results?.issueTags || [];

  const licensePlate = checks.licensePlate || {};
  const blur = checks.blur || {};
  const screenshot = checks.screenshotHeuristics || {};

  const getFilterStyle = () => {
    switch (filterMode) {
      case 'GRAYSCALE':
        return { filter: 'grayscale(100%)' };
      case 'HIGH_CONTRAST':
        return { filter: 'contrast(180%) brightness(110%)' };
      default:
        return {};
    }
  };

  return (
    <div className="hud-card rounded-xl overflow-hidden flex flex-col h-full bg-white border-zinc-200">
      {/* Inspector Header Toolbar */}
      <div className="p-3 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-2 bg-zinc-50/50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-zinc-900 truncate max-w-[220px]">
            {mediaItem.originalName || mediaItem.filename}
          </span>
          <span className="text-[11px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded font-mono">
            {results?.imageProperties?.width || 0} x {results?.imageProperties?.height || 0} px
          </span>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 border border-zinc-200">
            {['NORMAL', 'GRAYSCALE', 'HIGH_CONTRAST'].map(mode => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  filterMode === mode ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {mode.replace('_', ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowOverlays(!showOverlays)}
            className={`p-1.5 rounded-lg border transition ${
              showOverlays ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'
            }`}
            title="Toggle Markers"
          >
            <Eye className="w-4 h-4" />
          </button>

          <div className="flex items-center bg-white border border-zinc-200 rounded-lg p-0.5">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className="p-1 text-zinc-600 hover:bg-zinc-100 rounded"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-zinc-600 w-10 text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.25))}
              className="p-1 text-zinc-600 hover:bg-zinc-100 rounded"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setZoom(1); setFilterMode('NORMAL'); }}
              className="p-1 text-zinc-400 hover:text-zinc-700 rounded"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Specimen Image Stage */}
      <div className="relative flex-1 min-h-[380px] bg-zinc-900 overflow-hidden flex items-center justify-center p-4">
        <div 
          className="relative transition-transform duration-200 ease-out max-w-full max-h-[400px] flex items-center justify-center"
          style={{ transform: `scale(${zoom})` }}
        >
          <img
            src={mediaItem.url}
            alt="Uploaded Media Specimen"
            className="max-h-[360px] object-contain rounded-lg border border-zinc-800 shadow-md"
            style={getFilterStyle()}
          />

          {/* Real-time Dynamic Overlays based strictly on analysis results */}
          {showOverlays && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3">
              
              {/* Top Banner: Screenshot or Blur Warning */}
              <div className="flex flex-col gap-1.5 items-start">
                {screenshot.isScreenshot && (
                  <div className="bg-white text-zinc-900 px-3 py-1 rounded-md shadow-md border border-zinc-200 text-xs font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-zinc-900" />
                    <span>Screenshot Detected (Aspect Ratio: {screenshot.aspectRatio})</span>
                  </div>
                )}

                {blur.isBlurry && (
                  <div className="bg-amber-50 text-amber-900 px-3 py-1 rounded-md shadow-md border border-amber-200 text-xs font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Blurry Image (Variance: {blur.score})</span>
                  </div>
                )}
              </div>

              {/* Bottom Badge: Detected License Plate */}
              {licensePlate.detectedPlateNumber && (
                <div className="self-center bg-zinc-900 text-white px-3 py-1.5 rounded-lg shadow-lg border border-zinc-700 flex items-center gap-2">
                  <span className="font-mono font-bold text-xs">OCR: {licensePlate.detectedPlateNumber}</span>
                  <span className="text-[10px] text-zinc-400 font-mono">({licensePlate.ocrConfidence}%)</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Real-time Image Metadata Footer Bar */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs font-mono text-zinc-300 bg-zinc-900/95 px-3 py-1.5 rounded-lg border border-zinc-800 backdrop-blur">
          <span>SHA-256: {results?.imageProperties?.sha256?.substring(0, 16) || 'Processing...'}</span>
          <div>
            {tags.length === 0 ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Clean Image
              </span>
            ) : (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {tags.length} Issues Flagged
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
