import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield } from 'lucide-react';
import AnalyticsHeader from './components/AnalyticsHeader';
import UploadModal from './components/UploadModal';
import InspectorCanvas from './components/InspectorCanvas';
import ForensicReport from './components/ForensicReport';
import JobQueueStream from './components/JobQueueStream';

export default function App() {
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Fetch summary analytics
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/analytics/summary');
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (e) {
      console.error('Failed to fetch analytics summary:', e);
    }
  }, []);

  // Fetch media items list
  const fetchMedia = useCallback(async (filterTag = activeFilter) => {
    try {
      let url = '/api/v1/media?limit=50';
      if (filterTag && filterTag !== 'ALL') {
        url += `&tag=${filterTag}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const newItems = data.items || [];
        setItems(newItems);
        
        if (newItems.length > 0) {
          setSelectedItem(prev => {
            if (!prev) return newItems[0];
            const updated = newItems.find(i => i.id === prev.id);
            return updated || newItems[0];
          });
        } else {
          setSelectedItem(null);
        }
      }
    } catch (e) {
      console.error('Failed to fetch media list:', e);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  // Combined refresh
  const refreshAll = useCallback(() => {
    fetchSummary();
    fetchMedia(activeFilter);
  }, [fetchSummary, fetchMedia, activeFilter]);

  // Real-time polling timer (every 2.5 seconds)
  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 2500);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // Client-side computed filtered list for zero latency UI switching
  const filteredItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    if (activeFilter === 'ALL') return items;
    return items.filter(item => {
      const tags = item.issueTags || [];
      return tags.includes(activeFilter);
    });
  }, [items, activeFilter]);

  // Auto-adjust selected item when filter changes
  useEffect(() => {
    if (filteredItems.length > 0) {
      if (!selectedItem || !filteredItems.some(i => i.id === selectedItem.id)) {
        setSelectedItem(filteredItems[0]);
      }
    } else {
      setSelectedItem(null);
    }
  }, [filteredItems, selectedItem]);

  // Handle filter change
  const handleFilterChange = (tag) => {
    setActiveFilter(tag);
    fetchMedia(tag);
  };

  // Upload completion handler
  const handleUploadSuccess = (uploadData) => {
    refreshAll();
    setTimeout(() => fetchMedia(activeFilter), 800);
  };

  // Quick sample loader button handler
  const handleSampleLoad = async (sampleType) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/media/sample/${sampleType}`, { method: 'POST' });
      if (!res.ok) {
        const fallbackRes = await fetch('/api/v1/media/sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: sampleType })
        });
        const data = await fallbackRes.json();
        if (data.mediaId) {
          handleUploadSuccess(data);
        }
      } else {
        const data = await res.json();
        handleUploadSuccess(data);
      }
    } catch (e) {
      console.error('Sample load trigger failed:', e);
      refreshAll();
    } finally {
      setLoading(false);
    }
  };

  // Reprocess Handler
  const handleReprocess = async (id) => {
    try {
      await fetch(`/api/v1/media/reprocess/${id}`, { method: 'POST' });
      refreshAll();
    } catch (e) {
      console.error('Reprocess failed:', e);
    }
  };

  // Delete Single Media Handler
  const handleDelete = async (id) => {
    try {
      await fetch(`/api/v1/media/${id}`, { method: 'DELETE' });
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
      refreshAll();
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  // Clear All Data Handler
  const handleClearAll = async () => {
    try {
      await fetch('/api/v1/media/clear', { method: 'POST' });
      setSelectedItem(null);
      refreshAll();
    } catch (e) {
      console.error('Clear all failed:', e);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans antialiased">
      
      {/* Top Navbar */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-50">
        <div className="max-w-[1500px] mx-auto px-6 py-3.5 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-semibold text-base text-zinc-900 tracking-tight">
                Media Processing Pipeline
              </h1>
              <p className="text-xs text-zinc-500">
                Asynchronous Intelligent Vehicle Image Analysis (Neon PostgreSQL)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium text-zinc-500">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Queue Worker Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1500px] w-full mx-auto px-6 py-6 space-y-6 flex-1">
        
        {/* Top Stat Cards & Interactive Filter Bar */}
        <AnalyticsHeader
          summary={summary}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          onRefresh={refreshAll}
          onClearAll={handleClearAll}
        />

        {/* Split View: Left (Upload + Canvas) & Right (Forensic Report) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-7 space-y-6 flex flex-col">
            <UploadModal
              onUploadSuccess={handleUploadSuccess}
            />

            <div className="flex-1">
              <InspectorCanvas mediaItem={selectedItem} />
            </div>
          </div>

          <div className="lg:col-span-5 h-full">
            <ForensicReport mediaItem={selectedItem} />
          </div>

        </div>

        {/* Queue Stream Table */}
        <JobQueueStream
          items={filteredItems}
          selectedId={selectedItem?.id}
          activeFilter={activeFilter}
          onSelect={setSelectedItem}
          onReprocess={handleReprocess}
          onDelete={handleDelete}
          onResetFilter={() => handleFilterChange('ALL')}
        />

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-3 px-6 text-xs text-zinc-500 flex items-center justify-between">
        <div>
          Intelligent Media Processing Pipeline • Node.js + Express + Neon PostgreSQL + Sharp + Tesseract.js
        </div>
        <div className="font-mono text-[11px] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Status: Operational (Neon DB Connected)
        </div>
      </footer>
    </div>
  );
}
