import React, { useState } from 'react';
import {
  X,
  Download,
  Share2,
  Camera,
  Layers,
  UserCheck,
  User,
  Check,
  SlidersHorizontal,
} from 'lucide-react';

export const PhotoLightbox = ({
  photo,
  onClose,
  onDownloadSingle,
  highlightedParticipantId,
}) => {
  const [showFaceBoxes, setShowFaceBoxes] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [hoveredFace, setHoveredFace] = useState(null);

  if (!photo) return null;

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      {/* Close button */}
      <button
        id="lightbox-close-btn"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white/90 text-slate-700 hover:bg-white border border-slate-200 transition-colors shadow-sm cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="relative w-full max-w-6xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl flex flex-col lg:flex-row max-h-[90vh]">
        {/* Main Image Frame with Face Bounding Boxes */}
        <div className="relative flex-1 bg-slate-950 flex items-center justify-center p-2 sm:p-4 overflow-hidden min-h-[360px] lg:min-h-[580px]">
          <div className="relative inline-block max-w-full max-h-[80vh]">
            <img
              src={photo.highResUrl || photo.url}
              alt={photo.filename}
              className="max-h-[75vh] w-auto object-contain rounded-lg shadow-xl"
            />

            {/* Render Face Bounding Boxes on the photo */}
            {showFaceBoxes &&
              photo.faces.map((face) => {
                const isTarget = highlightedParticipantId && face.participantId === highlightedParticipantId;
                const isHovered = hoveredFace?.id === face.id;

                return (
                  <div
                    key={face.id}
                    onMouseEnter={() => setHoveredFace(face)}
                    onMouseLeave={() => setHoveredFace(null)}
                    style={{
                      left: `${face.box.x}%`,
                      top: `${face.box.y}%`,
                      width: `${face.box.width}%`,
                      height: `${face.box.height}%`,
                    }}
                    className={`absolute rounded-md transition-all cursor-pointer pointer-events-auto ${
                      isTarget
                        ? 'border-2 border-indigo-500 bg-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.6)] animate-pulse'
                        : isHovered
                        ? 'border-2 border-amber-400 bg-amber-400/20 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                        : 'border border-dashed border-white/70 hover:border-amber-400 bg-white/5'
                    }`}
                  >
                    {/* Face Tag Badge */}
                    <div
                      className={`absolute -top-7 left-0 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap shadow-md flex items-center space-x-1 ${
                        isTarget
                          ? 'bg-indigo-600 text-white'
                          : isHovered
                          ? 'bg-amber-400 text-slate-900'
                          : 'bg-slate-900/90 text-white border border-slate-700'
                      }`}
                    >
                      <User className="w-3 h-3 shrink-0" />
                      <span>{face.participantName || 'Detected Attendee'}</span>
                      <span className="opacity-80 text-[10px]">
                        ({Math.round((face.confidence || 0.94) * 100)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Quick toggle for face boxes on image bottom */}
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-1.5 flex items-center space-x-2 text-xs text-slate-700 shadow-sm">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-medium">AI Face Overlay:</span>
            <button
              onClick={() => setShowFaceBoxes(!showFaceBoxes)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                showFaceBoxes
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {showFaceBoxes ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Side Metadata & Action Drawer */}
        <div className="w-full lg:w-80 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-5 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-5">
            {/* Header & Filename */}
            <div>
              <div className="flex items-center justify-between text-xs text-indigo-600 font-bold mb-1">
                <span className="uppercase tracking-wider">{photo.sessionTag}</span>
                <span className="text-slate-400 text-[11px] font-mono">{photo.dimensions.width} × {photo.dimensions.height}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 truncate" title={photo.filename}>
                {photo.filename}
              </h3>
            </div>

            {/* Identified Attendees in this photo */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                <div className="flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Detected Attendees ({photo.faces.length})</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">Vector Indexed</span>
              </div>
              <div className="space-y-1.5">
                {photo.faces.map((face) => (
                  <div
                    key={face.id}
                    onMouseEnter={() => setHoveredFace(face)}
                    onMouseLeave={() => setHoveredFace(null)}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs hover:bg-slate-100 cursor-pointer border border-slate-200/80 transition-colors"
                  >
                    <span className="text-slate-800 font-medium truncate">
                      {face.participantName || 'Anonymous Participant'}
                    </span>
                    <span className="text-emerald-700 font-mono text-[11px] font-bold">
                      {Math.round((face.confidence || 0.95) * 100)}% match
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Decoupled Storage Reference (Google Photos Media ID) */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 font-medium">
                <div className="flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-bold text-slate-700">Storage Provider</span>
                </div>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold">
                  Google Photos API
                </span>
              </div>
              <div className="font-mono text-[10px] text-slate-600 truncate bg-slate-50 p-1.5 rounded border border-slate-200" title={photo.googleMediaId}>
                Media ID: {photo.googleMediaId}
              </div>
            </div>

            {/* Photographer & Camera Gear */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                  {photo.photographerName.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{photo.photographerName}</div>
                  <div className="text-[11px] text-slate-500">Accredited Event Photographer</div>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 text-slate-600 text-[11px]">
                <Camera className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{photo.cameraInfo}</span>
              </div>
              {photo.exif && (
                <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-100 font-mono">
                  <div>ISO {photo.exif.iso}</div>
                  <div>{photo.exif.shutter}</div>
                  <div>{photo.exif.aperture}</div>
                  <div>{photo.exif.focalLength}</div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <button
              id="lightbox-download-highres-btn"
              onClick={() => onDownloadSingle(photo)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Original (High Res)</span>
            </button>

            <button
              id="lightbox-share-btn"
              onClick={handleShare}
              className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Share Direct Photo Link'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
