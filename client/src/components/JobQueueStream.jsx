import React from 'react';
import { Activity, CheckCircle2, Clock, XCircle, RotateCcw, Trash2, Eye, FilterX } from 'lucide-react';

export default function JobQueueStream({ items, selectedId, activeFilter, onSelect, onReprocess, onDelete, onResetFilter }) {
  if (!items || items.length === 0) {
    return (
      <div className="hud-card rounded-xl p-8 text-center text-zinc-500 text-xs border-zinc-200 bg-white flex flex-col items-center justify-center gap-2">
        <FilterX className="w-8 h-8 text-zinc-300" />
        <span className="font-semibold text-zinc-700">No media specimens found matching filter</span>
        {activeFilter && activeFilter !== 'ALL' && (
          <button
            onClick={onResetFilter}
            className="mt-1 px-3 py-1.5 rounded-md bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition shadow-sm"
          >
            Reset Filter (Show All Media)
          </button>
        )}
      </div>
    );
  }

  const getStatusBadge = (item) => {
    switch (item.status) {
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'processing':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <Activity className="w-3 h-3 animate-spin" /> Processing ({item.progress || 25}%)
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Queued
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="hud-card rounded-xl p-4 bg-white border-zinc-200 text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-zinc-900">
            Media Ingestion Stream & Queue
          </h3>
          {activeFilter && activeFilter !== 'ALL' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-900 text-white">
              Filter: {activeFilter.replace('_', ' ')}
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          {items.length} items
        </span>
      </div>

      {/* Stream Table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-100 text-[11px] text-zinc-400 font-medium">
              <th className="py-2.5 px-3">Specimen</th>
              <th className="py-2.5 px-3">File / Media ID</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Flagged Issues</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item) => {
              const isSelected = item.id === selectedId;
              const tags = item.issueTags || [];

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className={`cursor-pointer transition hover:bg-zinc-50 ${
                    isSelected ? 'bg-zinc-100/80 font-medium' : ''
                  }`}
                >
                  {/* Specimen Thumbnail */}
                  <td className="py-2.5 px-3">
                    <div className="w-10 h-10 rounded-lg border border-zinc-200 overflow-hidden bg-zinc-900 flex items-center justify-center shrink-0">
                      <img src={item.url} alt="Thumbnail" className="w-full h-full object-cover" />
                    </div>
                  </td>

                  {/* File Name & Media ID */}
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-zinc-900 truncate max-w-[180px]">
                      {item.originalName || item.filename}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono truncate max-w-[140px]">
                      {item.id}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col gap-1 max-w-[150px]">
                      {getStatusBadge(item)}
                      {item.status === 'processing' || item.status === 'pending' ? (
                        <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden border border-zinc-200">
                          <div
                            className="bg-zinc-900 h-full transition-all duration-300"
                            style={{ width: `${item.progress || 10}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </td>

                  {/* Issue Tags */}
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap gap-1 max-w-[240px]">
                      {tags.length === 0 ? (
                        <span className="text-[11px] text-emerald-600 font-medium">✓ Clean Specimen</span>
                      ) : (
                        tags.map(t => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200"
                          >
                            {t.replace('_', ' ')}
                          </span>
                        ))
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onSelect(item)}
                        className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-600 border border-zinc-200 text-xs"
                        title="Inspect"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onReprocess(item.id)}
                        className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-600 border border-zinc-200 text-xs"
                        title="Re-enqueue"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1.5 rounded-md hover:bg-red-50 text-red-600 border border-red-200 text-xs"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
