import React, { useState, useRef } from 'react';
import { api } from '../api';
import { matchSelfieToPhotos, searchPhotosByParticipant } from '../utils/faceMatcher';
import { downloadPhotosAsZip } from '../utils/zipDownloader';
import confetti from 'canvas-confetti';
import {
  Camera,
  Upload,
  Search,
  Download,
  Check,
  FolderArchive,
  Eye,
  Maximize2,
  SlidersHorizontal,
  AlertCircle,
} from 'lucide-react';

export const ParticipantFinder = ({ event, participants, photos, onOpenLightbox }) => {
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [textQuery, setTextQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanError, setScanError] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [sessionFilter, setSessionFilter] = useState('All');
  const [showFaceBoxes, setShowFaceBoxes] = useState(true);

  // Zip downloading state
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  // Camera capture state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      alert('Camera access could not be initialized. Please upload a photo instead.');
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setSelfiePreview(dataUrl);
      setSelectedParticipant(null);
      stopCamera();
      runSelfieSearch(dataUrl, null);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result;
      setSelfiePreview(dataUrl);
      setSelectedParticipant(null);
      runSelfieSearch(dataUrl, null);
    };
    reader.readAsDataURL(file);
  };

  // The backend search is a single atomic call (no streaming), so we can't report
  // true byte-level progress. Instead we ease a bar toward ~92% through labelled
  // stages, then snap it to 100% the instant results land — enough to make the
  // wait feel alive and legible without faking specific backend steps.
  const beginProgress = (stages) => {
    setScanProgress(6);
    setScanStep(stages[0].label);
    let pct = 6;
    return setInterval(() => {
      pct = Math.min(92, pct + Math.random() * 8 + 3);
      setScanProgress(pct);
      const stage = [...stages].reverse().find((s) => pct >= s.at);
      if (stage) setScanStep(stage.label);
    }, 300);
  };

  const finishProgress = async (timer) => {
    clearInterval(timer);
    setScanProgress(100);
    setScanStep('Complete');
    await new Promise((resolve) => setTimeout(resolve, 320));
  };

  // Real selfie search: server embeds the face and runs a NumPy cosine top-k.
  const runSelfieSearch = async (imageSrc, participantId) => {
    setIsScanning(true);
    setSearchResults(null);
    setScanError(null);
    const timer = beginProgress([
      { at: 6, label: 'Uploading your selfie…' },
      { at: 30, label: 'Detecting your face…' },
      { at: 55, label: `Scanning ${event.totalPhotos.toLocaleString()} event photos…` },
      { at: 80, label: 'Ranking your best matches…' },
    ]);
    try {
      const results = await matchSelfieToPhotos(event.id, imageSrc, participantId);
      await finishProgress(timer);
      setSearchResults(results);
      if (results.length > 0) {
        confetti({
          particleCount: 60,
          spread: 55,
          origin: { y: 0.6 },
          colors: ['#4f46e5', '#3b82f6', '#10b981'],
        });
      }
    } catch (err) {
      clearInterval(timer);
      if (err.status === 422) {
        setScanError('No face was detected in that photo. Try a clearer, front-facing selfie.');
      } else {
        setScanError(err.message || 'Search failed. Please try again.');
      }
      setSearchResults([]);
    } finally {
      setIsScanning(false);
    }
  };

  // Real name / registration-ID search (server-side over linked faces).
  const runParticipantSearch = async (query) => {
    if (!query) return;
    setIsScanning(true);
    setSearchResults(null);
    setScanError(null);
    const timer = beginProgress([
      { at: 6, label: 'Looking up your registration…' },
      { at: 45, label: 'Gathering your linked photos…' },
      { at: 80, label: 'Ranking your best matches…' },
    ]);
    try {
      const { participant, results } = await searchPhotosByParticipant(event.id, query);
      await finishProgress(timer);
      if (participant) {
        setSelectedParticipant(participant);
        if (participant.avatar) setSelfiePreview(participant.avatar);
      }
      setSearchResults(results);
      if (results.length > 0) {
        confetti({
          particleCount: 60,
          spread: 55,
          origin: { y: 0.6 },
          colors: ['#4f46e5', '#3b82f6', '#10b981'],
        });
      }
    } catch (err) {
      clearInterval(timer);
      setScanError(err.message || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectSampleParticipant = (participant) => {
    setSelectedParticipant(participant);
    setSelfiePreview(participant.avatar);
    setTextQuery(participant.name);
    runParticipantSearch(participant.regId || participant.name);
  };

  const handleSearchByNameOrId = () => {
    if (!textQuery.trim()) return;
    setSelectedParticipant(null);
    setSelfiePreview(null);
    runParticipantSearch(textQuery.trim());
  };

  const handleResetSearch = () => {
    setSearchResults(null);
    setSelfiePreview(null);
    setSelectedParticipant(null);
    setTextQuery('');
    setScanError(null);
    setSessionFilter('All');
  };

  const filteredMatches = (searchResults || []).filter((item) => {
    if (sessionFilter === 'All') return true;
    return item.photo.sessionTag === sessionFilter;
  });

  const handleDownloadSingle = (photo) => {
    if (photo?.id) window.open(api.photoDownloadUrl(photo.id), '_blank');
  };

  const handleDownloadZip = async (photosToDownload) => {
    if (photosToDownload.length === 0) return;
    setIsZipping(true);
    setZipProgress(15);

    const nameSlug = selectedParticipant ? selectedParticipant.name.replace(/\s+/g, '_') : 'My';
    const zipFilename = `${event.slug}_${nameSlug}_Photos.zip`;

    try {
      await downloadPhotosAsZip(event.id, photosToDownload, zipFilename, (pct) => {
        setZipProgress(pct);
      });
    } catch (err) {
      console.error('Download error:', err);
      setScanError(err.message || 'Could not build the ZIP archive.');
    } finally {
      setIsZipping(false);
    }
  };

  // --- Drifting photo wall (hero) — built from real event photos so the
  // cohort sees familiar faces the moment they land. Hidden until there are
  // enough photos to fill the rows; pauses on hover, respects reduced-motion. ---
  const wallPhotos = (photos || []).filter((p) => p.thumbnailUrl || p.url);
  const showWall = wallPhotos.length >= 6;
  const fillRow = (arr, min) => {
    if (!arr.length) return [];
    const out = [];
    while (out.length < min) out.push(...arr);
    return out;
  };
  const rowTop = fillRow(wallPhotos.filter((_, i) => i % 2 === 0), 8);
  const rowBot = fillRow(wallPhotos.filter((_, i) => i % 2 === 1), 8);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* If no search results yet, show the focused, clean hero finder */}
      {searchResults === null && !isScanning && (
        <div className="space-y-8">
          {/* Drifting wall of real event photos — the cohort's own faces */}
          {showWall && (
            <div className="rb-wall relative -mx-4 sm:-mx-6 lg:-mx-8 overflow-hidden select-none">
              <div className="space-y-3">
                <div className="rb-drift rb-drift-left">
                  {[...rowTop, ...rowTop].map((p, i) => (
                    <img
                      key={`t-${i}`}
                      src={p.thumbnailUrl || p.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onClick={() => onOpenLightbox(p)}
                      className="h-24 w-32 sm:h-28 sm:w-40 mr-3 rounded-xl object-cover shrink-0 shadow-sm ring-1 ring-slate-200/70 cursor-pointer transition hover:ring-2 hover:ring-indigo-500 hover:brightness-105"
                    />
                  ))}
                </div>
                <div className="rb-drift rb-drift-right">
                  {[...rowBot, ...rowBot].map((p, i) => (
                    <img
                      key={`b-${i}`}
                      src={p.thumbnailUrl || p.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onClick={() => onOpenLightbox(p)}
                      className="h-24 w-32 sm:h-28 sm:w-40 mr-3 rounded-xl object-cover shrink-0 shadow-sm ring-1 ring-slate-200/70 cursor-pointer transition hover:ring-2 hover:ring-indigo-500 hover:brightness-105"
                    />
                  ))}
                </div>
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-28 bg-gradient-to-r from-[#F8FAFC] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-28 bg-gradient-to-l from-[#F8FAFC] to-transparent" />
            </div>
          )}

          {/* Minimalist Hero */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              <span>{event.name} &bull; {event.cohort}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Find Your Event Photos
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Upload a selfie or pick your name. Our AI instantly gathers every photo you appeared in across {event.totalPhotos.toLocaleString()} high-res captures.
            </p>
          </div>

          {/* Unified Clean Finder Card */}
          <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            {!isCameraActive ? (
              <div className="space-y-4">
                {/* Upload or Selfie Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative border-2 border-dashed border-slate-200 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3"
                >
                  <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-800">
                      Upload a selfie or headshot
                    </div>
                    <div className="text-xs text-slate-400">
                      Supports JPG, PNG, WEBP (Instant AI face matching)
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {/* Or Use Webcam button */}
                <button
                  id="btn-use-camera"
                  onClick={startCamera}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Live Selfie with Camera</span>
                </button>
              </div>
            ) : (
              /* Live Camera Capture Box */
              <div className="space-y-4 text-center">
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square max-w-[280px] mx-auto border border-slate-200">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-2 border-dashed border-indigo-400/80 rounded-2xl m-4 pointer-events-none" />
                </div>

                <div className="flex gap-2 justify-center">
                  <button
                    onClick={capturePhoto}
                    className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                  >
                    Capture & Find Photos
                  </button>
                  <button
                    onClick={stopCamera}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Or Search by Name
              </span>
            </div>

            {/* Name Search Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchByNameOrId()}
                  placeholder="e.g. Kingsley, David Adeleke, ALA-2026-042..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                />
              </div>
              <button
                onClick={handleSearchByNameOrId}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Search
              </button>
            </div>

            {/* 1-Click Quick Sample Participants */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold">Quick 1-Click Test:</span>
                <span className="text-[11px] text-slate-400">Click any participant to test</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {participants.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectSampleParticipant(p)}
                    className="flex items-center space-x-2 p-2 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-all cursor-pointer group"
                  >
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 truncate">
                        {p.name.split(' ')[0]}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{p.regId}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Vector Scanning In-Progress — live progress feedback */}
      {isScanning && (
        <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-4">
            {selfiePreview ? (
              <img
                src={selfiePreview}
                alt="Your selfie"
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-500/30 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <Search className="w-6 h-6 text-indigo-600" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">Finding your photos</h3>
              <p className="text-xs text-indigo-600 font-medium mt-0.5 truncate">{scanStep}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-300 ease-out"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium">
              <span className="text-slate-400">AI vector matching</span>
              <span className="tabular-nums font-bold text-slate-700">{Math.round(scanProgress)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* MATCH RESULTS GALLERY */}
      {searchResults !== null && !isScanning && (
        <div className="space-y-6">
          {/* Top Bar: Participant Profile & Download All */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center space-x-4">
              {selfiePreview && (
                <div className="relative">
                  <img
                    src={selfiePreview}
                    alt="Participant"
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-indigo-500 shadow-sm"
                  />
                  <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                    <Check className="w-3 h-3" />
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {searchResults.length > 0 ? (
                      <>
                        Found <span className="text-indigo-600">{searchResults.length} photos</span> of{' '}
                        {selectedParticipant?.name || 'You'}
                      </>
                    ) : (
                      'No matching photos found'
                    )}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {scanError
                    ? scanError
                    : `Official high-resolution photos matched from ${event.name}.`}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <button
                onClick={handleResetSearch}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Scan Another Photo
              </button>

              {searchResults.length > 0 && (
                <button
                  id="download-all-zip-btn"
                  disabled={isZipping}
                  onClick={() => handleDownloadZip(filteredMatches.map((m) => m.photo))}
                  className="flex-1 md:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  <FolderArchive className="w-4 h-4" />
                  <span>{isZipping ? `Zipping (${zipProgress}%)...` : 'Download All (.ZIP)'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Error banner when the search failed (no results + a reason) */}
          {searchResults.length === 0 && scanError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Filtering Bar */}
          {searchResults.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
                <span className="text-slate-400 font-bold text-[11px] uppercase tracking-wider shrink-0 mr-1">
                  Session:
                </span>
                {['All', ...event.sessions.filter((s) => s !== 'All')].map((sess) => (
                  <button
                    key={sess}
                    onClick={() => setSessionFilter(sess)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer text-xs font-semibold ${
                      sessionFilter === sess
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    {sess}
                  </button>
                ))}
              </div>

              {/* Face Box Toggle */}
              <div className="flex items-center space-x-3 shrink-0">
                <button
                  onClick={() => setShowFaceBoxes(!showFaceBoxes)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    showFaceBoxes
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3 text-indigo-600" />
                  <span>Face Markers: {showFaceBoxes ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Photos Grid */}
          {filteredMatches.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredMatches.map(({ photo, matchedFace, similarity }) => (
                <div
                  key={photo.id}
                  className="group relative bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-slate-300 shadow-sm transition-all"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative aspect-4/3 overflow-hidden cursor-pointer bg-slate-900"
                    onClick={() => onOpenLightbox(photo, selectedParticipant?.id)}
                  >
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt={photo.filename}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Face Bounding Box */}
                    {showFaceBoxes && matchedFace && (
                      <div
                        style={{
                          left: `${matchedFace.box.x}%`,
                          top: `${matchedFace.box.y}%`,
                          width: `${matchedFace.box.width}%`,
                          height: `${matchedFace.box.height}%`,
                        }}
                        className="absolute border-2 border-indigo-400 bg-indigo-500/20 rounded pointer-events-none shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                      />
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
                      <div className="flex justify-end">
                        <span className="p-1.5 rounded-lg bg-white/90 text-slate-900 backdrop-blur-sm shadow">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div className="text-white text-xs">
                        <div className="font-semibold truncate">{photo.sessionTag}</div>
                        <div className="text-[11px] text-slate-300 font-mono">By {photo.photographerName}</div>
                      </div>
                    </div>

                    {/* Match Confidence Tag */}
                    <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-sm border border-slate-200 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center space-x-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{Math.round(similarity * 100)}% Match</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-3 flex items-center justify-between bg-white border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-600 font-medium truncate max-w-[130px]" title={photo.filename}>
                      {photo.filename.replace(/^IMG_|^DSC_|^NIK_|^GFX_/, '')}
                    </span>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onOpenLightbox(photo, selectedParticipant?.id)}
                        className="p-1 text-slate-400 hover:text-slate-900 rounded cursor-pointer"
                        title="View High-Res"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownloadSingle(photo)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                        title="Download photo"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            searchResults.length > 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-sm">
                <div className="text-sm font-semibold text-slate-700">No photos in this session category</div>
                <button
                  onClick={() => setSessionFilter('All')}
                  className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  Show all sessions
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
