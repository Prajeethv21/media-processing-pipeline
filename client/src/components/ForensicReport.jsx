import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, FileCode, CheckCircle2, XCircle, Search, Copy, Check } from 'lucide-react';

export default function ForensicReport({ mediaItem }) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!mediaItem) {
    return (
      <div className="hud-card h-full rounded-xl p-6 flex flex-col items-center justify-center text-center text-zinc-400 text-xs border-zinc-200">
        <Search className="w-8 h-8 text-zinc-300 mb-2" />
        <span>Select media specimen to inspect forensic report</span>
      </div>
    );
  }

  const results = mediaItem.results || mediaItem.analysisResults;
  const summary = results?.summary || {};
  const checks = results?.checks || {};
  const tags = mediaItem.issueTags || results?.issueTags || [];

  const qualityScore = summary.qualityScore !== undefined ? summary.qualityScore : 100;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="hud-card rounded-xl p-4 flex flex-col h-full bg-white border-zinc-200 text-xs">
      
      {/* Report Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
        <div>
          <h3 className="font-semibold text-sm text-zinc-900">
            Forensic Audit Report
          </h3>
          <span className="text-zinc-400 text-[11px]">
            Latency: {summary.processingTimeMs || 0} ms
          </span>
        </div>

        {/* Quality Score Badge */}
        <div className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 font-semibold text-xs flex items-center gap-1 text-zinc-900">
          <span>Quality Score:</span>
          <span className="font-bold text-sm">{qualityScore}</span>
          <span className="text-zinc-400 text-[10px]">/ 100</span>
        </div>
      </div>

      {/* Flagged Issues */}
      <div className="mt-3">
        <span className="text-[11px] text-zinc-500 font-medium block mb-1.5">
          Flagged Anomalies ({tags.length}):
        </span>
        {tags.length === 0 ? (
          <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-800 flex items-center gap-2 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Clean specimen — all integrity checks passed</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-900 text-white flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" /> {tag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Diagnostic Checks Breakdown */}
      <div className="mt-4 space-y-2 flex-1 overflow-y-auto pr-1">
        
        {/* Check 1: Blur */}
        <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100">
          <div className="flex items-center justify-between font-medium">
            <span className="text-zinc-900">1. Blur & Sharpness Variance</span>
            {checks.blur?.isBlurry ? (
              <span className="text-amber-600 font-semibold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Blurry</span>
            ) : (
              <span className="text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Optimal</span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span>Variance: <strong>{checks.blur?.score || 0}</strong></span>
            <span>Threshold: &lt; {checks.blur?.threshold || 110}</span>
          </div>
        </div>

        {/* Check 2: Lighting */}
        <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100">
          <div className="flex items-center justify-between font-medium">
            <span className="text-zinc-900">2. Lighting & Exposure</span>
            <span className={checks.lighting?.isLowLight || checks.lighting?.isOverExposed ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
              {checks.lighting?.lightingRating || 'Optimal'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span>Luminance: <strong>{checks.lighting?.brightness || 0} / 255</strong></span>
            <span>Contrast: <strong>{checks.lighting?.contrastStdDev || 0}</strong></span>
          </div>
        </div>

        {/* Check 3: License Plate */}
        <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100">
          <div className="flex items-center justify-between font-medium">
            <span className="text-zinc-900">3. License Plate OCR</span>
            {checks.licensePlate?.isValidFormat ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Valid Format</span>
            ) : (
              <span className="text-zinc-500 font-medium">Invalid / Missing</span>
            )}
          </div>
          {checks.licensePlate?.detectedPlateNumber ? (
            <div className="mt-2 p-2 rounded bg-zinc-900 text-white text-center font-mono font-bold text-xs tracking-wider">
              {checks.licensePlate.detectedPlateNumber} (OCR {checks.licensePlate.ocrConfidence}%)
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-zinc-500 font-mono truncate">
              Extracted: &quot;{checks.licensePlate?.detectedText?.substring(0, 35) || 'None'}&quot;
            </div>
          )}
        </div>

        {/* Check 4: Duplicate */}
        <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100">
          <div className="flex items-center justify-between font-medium">
            <span className="text-zinc-900">4. Perceptual Image Hash</span>
            {checks.duplicate?.isDuplicate ? (
              <span className="text-red-600 font-semibold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Duplicate</span>
            ) : (
              <span className="text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Unique</span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 font-mono truncate">
            dHash: {results?.imageProperties?.dHash || 'N/A'}
          </div>
        </div>

        {/* Check 5: EXIF & Screenshot */}
        <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100">
          <div className="flex items-center justify-between font-medium">
            <span className="text-zinc-900">5. Camera & Metadata Audit</span>
            <span className="text-zinc-600 font-mono text-[11px]">
              {checks.integrity?.softwareTag || 'Standard Camera'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 font-mono">
            Camera Make: <strong>{checks.screenshotHeuristics?.cameraModel || 'None'}</strong>
          </div>
        </div>
      </div>

      {/* Raw JSON Toggle */}
      <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="text-xs text-zinc-700 font-medium hover:underline flex items-center gap-1"
        >
          <FileCode className="w-3.5 h-3.5" /> {showRawJson ? 'Hide Raw JSON' : 'View Raw Results JSON'}
        </button>

        {showRawJson && (
          <button
            onClick={handleCopyJson}
            className="text-[11px] text-zinc-600 hover:text-zinc-900 flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      {showRawJson && (
        <pre className="mt-2 p-3 rounded-lg bg-zinc-900 text-zinc-100 text-[11px] font-mono overflow-x-auto max-h-48 scrollbar-thin">
          {JSON.stringify(results, null, 2)}
        </pre>
      )}
    </div>
  );
}
