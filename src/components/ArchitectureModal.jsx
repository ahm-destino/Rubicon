import React from 'react';
import { X, Layers, Database, Sparkles, ArrowDown, CheckCircle2 } from 'lucide-react';

export const ArchitectureModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-6 sm:p-10 space-y-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Rubicon Core Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Decoupled Storage & Vector Intelligence Layer
          </h2>
          <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
            Why Rubicon solves the 5,000+ scattered photos problem: we separate high-volume binary image storage (Google Photos) from the biometric face intelligence and participant relationship database.
          </p>
        </div>

        {/* Visual Architecture Diagram */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* COLUMN 1: INGESTION (PHOTOGRAPHERS) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center space-x-2 text-xs font-bold text-indigo-600 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <span>1. Multi-Photographer Ingest</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-900">5 Photographers Uploading</div>
                <p className="text-[11px] text-slate-500">
                  Photographers A, B, C, D batch-upload high-resolution RAW / JPEG images into the event catalog.
                </p>
              </div>

              <div className="flex justify-center text-slate-400">
                <ArrowDown className="w-5 h-5 text-indigo-600 animate-bounce" />
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="font-bold text-emerald-700">Storage Provider Abstraction</div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  Images upload to Google Photos Enterprise Media Store & receive permanent Google Media IDs.
                </p>
              </div>
            </div>

            {/* COLUMN 2: INTELLIGENCE DATABASE (RUBICON DB) */}
            <div className="bg-white border-2 border-indigo-500/60 rounded-2xl p-5 space-y-4 relative shadow-sm">
              <div className="flex items-center space-x-2 text-xs font-bold text-indigo-700 uppercase tracking-wider">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>2. Rubicon Intelligence Layer</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div className="text-indigo-700 font-bold">PHOTO RECORD</div>
                <div className="text-slate-600">• Photo ID: photo_abia_001</div>
                <div className="text-slate-600">• Google Media ID: gphotos_84920...</div>
                <div className="text-slate-600">• Photographer: David Kingsley</div>
                <div className="text-slate-600">• Session: Keynote & Gala</div>
              </div>

              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-1.5 font-mono text-[11px]">
                <div className="text-indigo-700 font-bold">MULTI-FACE EMBEDDINGS</div>
                <div className="text-emerald-700">↳ Face A: Kingsley (0.96) [x, y, w, h]</div>
                <div className="text-indigo-700">↳ Face B: David (0.94) [x, y, w, h]</div>
                <div className="text-amber-700">↳ Face C: Sarah (0.95) [x, y, w, h]</div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                *Multiple faces per photograph indexed with individual bounding boxes & 512-d vector embeddings.
              </p>
            </div>

            {/* COLUMN 3: PARTICIPANT SEARCH & RETRIEVAL */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center space-x-2 text-xs font-bold text-indigo-600 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>3. Participant Experience</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-900">📸 Take / Upload Selfie</div>
                <p className="text-[11px] text-slate-500">
                  Participant uploads a selfie on their phone or enters registration ID.
                </p>
              </div>

              <div className="flex justify-center text-slate-400">
                <ArrowDown className="w-5 h-5 text-indigo-600 animate-bounce" />
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-emerald-700">Instant Vector Search</div>
                <p className="text-[11px] text-slate-600">
                  Matches face embeddings in Rubicon DB &rarr; Retrieves associated Google Media IDs &rarr; Returns personal high-res gallery!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Key Architectural Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
            <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Zero Re-Inspection Latency</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Once an image is indexed with its detected faces, searching takes milliseconds because we query vectors, not raw image pixels.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
            <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Storage Provider Agnostic</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Decoupling allows swapping the media store from Google Photos to Google Cloud Storage or AWS S3 without changing face intelligence.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
            <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Group Photo Precision</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Photos with 10+ people are individually tagged so all 10 participants find the exact photo in their personal albums.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
