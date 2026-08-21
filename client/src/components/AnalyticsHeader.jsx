import React from 'react';
import { Layers, Activity, CheckCircle, AlertTriangle, Clock, RefreshCw, Trash2, Filter } from 'lucide-react';

export default function AnalyticsHeader({ summary, activeFilter, onFilterChange, onRefresh, onClearAll }) {
  const overview = summary?.pipelineOverview || {
    totalMedia: 0,
    pendingCount: 0,
    processingCount: 0,
    completedCount: 0,
    failedCount: 0,
    passRatePercentage: 100,
    avgProcessingTimeMs: 0
  };

  const distribution = summary?.issueDistribution || {};

  const filterOptions = [
    { id: 'ALL', label: 'All Media', count: overview.totalMedia },
    { id: 'BLURRY_IMAGE', label: 'Blurry', count: distribution.BLURRY_IMAGE || 0 },
    { id: 'LOW_LIGHT', label: 'Low Light', count: distribution.LOW_LIGHT || 0 },
    { id: 'INVALID_PLATE_FORMAT', label: 'Bad Plate', count: distribution.INVALID_PLATE_FORMAT || 0 },
    { id: 'DUPLICATE_IMAGE', label: 'Duplicate', count: distribution.DUPLICATE_IMAGE || 0 },
    { id: 'SCREENSHOT_DETECTED', label: 'Screenshot', count: distribution.SCREENSHOT_DETECTED || 0 },
    { id: 'SUSPICIOUS_EDITING', label: 'Tampered', count: distribution.SUSPICIOUS_EDITING || 0 }
  ];

  return (
    <div className="space-y-4">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div className="hud-card p-4">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Total Uploaded</span>
            <Layers className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-2">
            {overview.totalMedia}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {overview.completedCount} processed
          </div>
        </div>

        <div className="hud-card p-4">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>In Queue</span>
            <Activity className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-2">
            {overview.pendingCount + overview.processingCount}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {overview.pendingCount} pending / {overview.processingCount} active
          </div>
        </div>

        <div className="hud-card p-4">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Pass Rate</span>
            <CheckCircle className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-2">
            {overview.passRatePercentage}%
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {overview.cleanImagesCount || 0} clean images
          </div>
        </div>

        <div className="hud-card p-4">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Issues Flagged</span>
            <AlertTriangle className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-2">
            {Object.values(distribution).reduce((a, b) => a + b, 0)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Total anomalies detected
          </div>
        </div>

        <div className="hud-card p-4">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Avg Latency</span>
            <Clock className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-2">
            {overview.avgProcessingTimeMs} <span className="text-sm font-normal text-zinc-500">ms</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Processing time
          </div>
        </div>

        <div className="hud-card p-4 flex flex-col justify-between bg-zinc-900 text-white border-zinc-900">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Controls</span>
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <button
              onClick={onRefresh}
              className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium py-1.5 px-2.5 rounded-md transition border border-zinc-700 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            {overview.totalMedia > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center justify-center gap-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-[11px] font-medium py-1 px-2 rounded-md transition border border-red-800/60 active:scale-95"
              >
                <Trash2 className="w-3 h-3" /> Clear All Data
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Interactive Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-sm flex items-center gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold mr-1 shrink-0">
          <Filter className="w-3.5 h-3.5 text-zinc-700" />
          <span>Filter by:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {filterOptions.map(f => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onFilterChange(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 shrink-0 border cursor-pointer select-none active:scale-95 ${
                  isActive
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/20'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 hover:text-zinc-900'
                }`}
              >
                <span>{f.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  isActive 
                    ? 'bg-zinc-800 text-white' 
                    : f.count > 0 
                      ? 'bg-zinc-200 text-zinc-800 font-semibold' 
                      : 'bg-zinc-100 text-zinc-400'
                }`}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
