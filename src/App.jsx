import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { api } from './api';
import { Navbar } from './components/Navbar';
import { ParticipantFinder } from './components/ParticipantFinder';
import { AdminPanel } from './components/AdminPanel';
import { EventGallery } from './components/EventGallery';
import { PhotoLightbox } from './components/PhotoLightbox';
import { ArchitectureModal } from './components/ArchitectureModal';

export default function App() {
  const [currentRole, setCurrentRole] = useState('participant');
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [photographers, setPhotographers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [storageConfig, setStorageConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [highlightedParticipantId, setHighlightedParticipantId] = useState(undefined);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);
  const [participantSubTab, setParticipantSubTab] = useState('find_my_photos');

  // ── Admin access gate ────────────────────────────────────────────────────────
  // The Admin Panel is hidden from regular visitors. It only unlocks when the URL
  // contains ?admin=<VITE_ADMIN_SECRET>. Once unlocked it is remembered for the
  // browser tab (sessionStorage) so the admin doesn't need the token on every
  // navigation within the same tab.
  const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || '';
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    if (!ADMIN_SECRET) return false; // secret not configured → always locked
    if (sessionStorage.getItem('adminUnlocked') === '1') return true;
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === ADMIN_SECRET;
  });

  // Persist unlock to sessionStorage and strip the token from the URL so it
  // isn't visible in the address bar after the initial load.
  useEffect(() => {
    if (!adminUnlocked) return;
    sessionStorage.setItem('adminUnlocked', '1');
    const params = new URLSearchParams(window.location.search);
    if (params.has('admin')) {
      params.delete('admin');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
      window.history.replaceState(null, '', newUrl);
    }
  }, [adminUnlocked]);
  // ─────────────────────────────────────────────────────────────────────────────


  // Load the event list once on mount.
  const loadEvents = useCallback(
    (selectId) =>
      api.listEvents().then((list) => {
        setEvents(list);
        setCurrentEvent((cur) => {
          if (selectId) return list.find((e) => e.id === selectId) || list[0] || null;
          return list.find((e) => e.id === cur?.id) || cur || list[0] || null;
        });
        if (!list.length) setLoading(false);
        return list;
      }),
    [],
  );

  useEffect(() => {
    loadEvents().catch((e) => { setError(e.message); setLoading(false); });
  }, [loadEvents]);

  // Load everything scoped to the selected event.
  const reloadEventData = useCallback((eventId) => {
    if (!eventId) return Promise.resolve();
    return Promise.all([
      api.listPhotographers(eventId),
      api.listParticipants(eventId),
      api.listPhotos(eventId, { pageSize: 200 }),
      api.storageStats(eventId).then((s) => s.provider).catch(() => null),
      api.getEvent(eventId),
    ]).then(([ph, pa, photoResp, storage, freshEvent]) => {
      setPhotographers(ph);
      setParticipants(pa);
      setPhotos(photoResp.items || []);
      setStorageConfig(storage);
      setCurrentEvent(freshEvent);
    });
  }, []);

  useEffect(() => {
    if (!currentEvent) return;
    setLoading(true);
    reloadEventData(currentEvent.id).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.id, reloadEventData]);

  // After an upload, re-pull the real persisted photos + counters.
  const handleUploadPhotos = () => {
    if (currentEvent) reloadEventData(currentEvent.id);
  };

  const handleOpenLightbox = (photo, participantId) => {
    setLightboxPhoto(photo);
    setHighlightedParticipantId(participantId);
    if (photo?.id) api.bumpView(photo.id).catch(() => { });
  };

  // Real download: hits the backend (increments count) then streams the file.
  const handleDownloadSingle = (photo) => {
    if (photo?.id) window.open(api.photoDownloadUrl(photo.id), '_blank');
  };

  if (loading && !currentEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-slate-500">
        <div className="animate-pulse text-sm font-medium">Loading Rubicon…</div>
      </div>
    );
  }

  if (error || !currentEvent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] text-center px-6">
        <h1 className="text-xl font-extrabold text-slate-900 font-display">Rubicon backend not reachable</h1>
        <p className="mt-2 text-sm text-slate-500 max-w-md">
          {error || 'No events found.'} Start the Flask backend (see backend/README.md):
          <code className="block mt-3 bg-slate-900 text-slate-100 rounded-lg px-3 py-2 text-left">
            flask --app app init-db && flask --app app seed && flask --app app run -p 5000
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col selection:bg-indigo-600 selection:text-white">
      <Navbar
        currentRole={currentRole}
        setCurrentRole={adminUnlocked ? setCurrentRole : undefined}
        currentEvent={currentEvent}
        events={events}
        onSelectEvent={setCurrentEvent}
        storageConfig={storageConfig}
        onOpenArchitecture={() => setIsArchitectureModalOpen(true)}
        participantSubTab={participantSubTab}
        setParticipantSubTab={setParticipantSubTab}
        adminUnlocked={adminUnlocked}
      />

      <main className="flex-1">
        {currentRole === 'participant' && (
          <div>
            {participantSubTab === 'find_my_photos' ? (
              <ParticipantFinder
                event={currentEvent}
                participants={participants}
                photos={photos}
                onOpenLightbox={handleOpenLightbox}
              />
            ) : (
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <EventGallery
                  event={currentEvent}
                  photos={photos}
                  photographers={photographers}
                  onOpenLightbox={handleOpenLightbox}
                  onDownloadSingle={handleDownloadSingle}
                />
              </div>
            )}
          </div>
        )}

        {adminUnlocked && currentRole !== 'participant' && (
          <AdminPanel
            event={currentEvent}
            events={events}
            photographers={photographers}
            participants={participants}
            photos={photos}
            storageConfig={storageConfig}
            onUploadPhotos={handleUploadPhotos}
            onDataChanged={() => currentEvent && reloadEventData(currentEvent.id)}
            onEventsChanged={loadEvents}
            onSelectEvent={setCurrentEvent}
            onOpenLightbox={handleOpenLightbox}
            onOpenArchitecture={() => setIsArchitectureModalOpen(true)}
            onSwitchToParticipantView={() => {
              setCurrentRole('participant');
              setParticipantSubTab('find_my_photos');
            }}
          />
        )}
      </main>

      <PhotoLightbox
        photo={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        onDownloadSingle={handleDownloadSingle}
        highlightedParticipantId={highlightedParticipantId}
      />

      <ArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
      />

      <footer className="border-t border-slate-200/80 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand — mirrors the Navbar mark for a cohesive identity */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <div className="w-3 h-3 bg-white rotate-45" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 font-display">
                RUBICON
              </span>
              <span className="text-[11px] text-slate-400">
                Let <span className="text-indigo-500 font-semibold">Ruby</span> find you in every moment
              </span>
            </div>
          </div>

          {/* Executive Authority Signature */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 shadow-xs transition-colors">
              <span className="text-slate-500 font-medium">Engineered with precision by</span>
              <a
                href="https://kingsleydestiny.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 font-extrabold text-slate-900 hover:text-indigo-600 transition-colors"
              >
                <span>Destiny Kingsley</span>
                <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </a>
              <span className="text-slate-300 font-bold">·</span>
              <span className="text-indigo-600 font-bold tracking-tight">The Ruby Group</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">© 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
