import React, { useState } from 'react';
import {
  Search,
  Eye,
  Download,
  Maximize2,
} from 'lucide-react';

export const EventGallery = ({
  event,
  photos,
  onOpenLightbox,
  onDownloadSingle,
}) => {
  const [selectedSession, setSelectedSession] = useState('All Sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');

  const filteredPhotos = photos
    .filter((photo) => {
      if (selectedSession !== 'All Sessions' && photo.sessionTag !== selectedSession) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesFile = photo.filename.toLowerCase().includes(q);
        const matchesSession = photo.sessionTag.toLowerCase().includes(q);
        const matchesPhotographer = photo.photographerName.toLowerCase().includes(q);
        const matchesFace = photo.faces.some((f) =>
          f.participantName?.toLowerCase().includes(q)
        );
        if (!matchesFile && !matchesSession && !matchesPhotographer && !matchesFace) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'popular') return b.viewCount - a.viewCount;
      if (sortBy === 'downloads') return b.downloadCount - a.downloadCount;
      if (sortBy === 'taken') {
        // Actual capture date from EXIF; falls back to upload time when a
        // photo carries no EXIF timestamp, so ordering is always sensible.
        const taken = (p) => new Date(p.exif?.capturedAt || p.uploadedAt).getTime();
        return taken(b) - taken(a);
      }
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by participant name, session, or filename..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 shrink-0 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
            >
              <option value="taken">Date Taken (newest)</option>
              <option value="newest">Recently Uploaded</option>
              <option value="popular">Most Viewed</option>
              <option value="downloads">Most Downloaded</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-slate-400 font-bold text-[11px] uppercase tracking-wider shrink-0">Sessions:</span>
            {event.sessions.map((sess) => (
              <button
                key={sess}
                onClick={() => setSelectedSession(sess)}
                className={`px-3 py-1 rounded-lg text-xs transition-colors shrink-0 cursor-pointer ${
                  selectedSession === sess
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {sess}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Photo count header */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing <strong className="text-slate-900">{filteredPhotos.length}</strong> of{' '}
          <strong className="text-slate-900">{photos.length}</strong> published photos
        </span>
        <span className="text-emerald-700 font-mono font-medium">Live Media Store</span>
      </div>

      {/* Empty state */}
      {photos.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 space-y-2 shadow-sm">
          <div className="text-sm font-semibold text-slate-700">No photos published yet</div>
          <div className="text-xs text-slate-500">
            Upload photos from the Admin Panel to populate this gallery.
          </div>
        </div>
      )}

      {/* Photos Masonry / Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredPhotos.map((photo) => (
          <div
            key={photo.id}
            className="group relative bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-slate-300 shadow-sm transition-all"
          >
            <div
              className="relative aspect-4/3 overflow-hidden cursor-pointer bg-slate-900"
              onClick={() => onOpenLightbox(photo)}
            >
              <img
                src={photo.thumbnailUrl || photo.url}
                alt={photo.filename}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
                <div className="flex justify-end">
                  <span className="p-1.5 rounded-lg bg-white/90 text-slate-900 backdrop-blur-sm shadow-sm">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-white text-xs">
                  <div className="font-bold truncate">{photo.sessionTag}</div>
                  <div className="text-[11px] text-slate-200 font-mono">
                    By {photo.photographerName}
                  </div>
                </div>
              </div>

              {/* Faces count tag */}
              <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200 shadow-sm flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                <span>{photo.faces.length} Faces Tagged</span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-600 font-medium truncate max-w-[150px]" title={photo.filename}>
                {photo.filename.replace(/^IMG_|^DSC_|^NIK_|^GFX_/, '')}
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onOpenLightbox(photo)}
                  className="p-1 text-slate-400 hover:text-slate-900 rounded cursor-pointer"
                  title="View Details"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDownloadSingle(photo)}
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                  title="Download High-Res"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
