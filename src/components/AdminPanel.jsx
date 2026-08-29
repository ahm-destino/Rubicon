import React, { useState, useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';
import {
  Upload,
  Users,
  Camera,
  HardDrive,
  QrCode,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Download,
  Search,
  UserCheck,
  Check,
  Copy,
  RefreshCw,
  FileImage,
  ArrowUpRight,
  Settings,
  Lock,
  ShieldCheck,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Images,
  KeyRound,
  UserCog,
  CalendarDays,
  Server,
} from 'lucide-react';
import { useToast } from './ui/Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { fieldClass, labelClass } from './ui/Modal';
import { PhotographerModal } from './admin/PhotographerModal';
import { ParticipantModal } from './admin/ParticipantModal';
import { RosterImportModal } from './admin/RosterImportModal';
import { UserModal } from './admin/UserModal';
import { AttendeePhotosModal } from './admin/AttendeePhotosModal';
import { EventModal } from './admin/EventModal';
import { StorageConnectModal } from './admin/StorageConnectModal';

export const AdminPanel = ({
  event,
  events = [],
  photographers,
  participants,
  photos,
  storageConfig,
  onUploadPhotos,
  onDataChanged,
  onEventsChanged,
  onSelectEvent,
  onOpenLightbox,
  onOpenArchitecture,
  onSwitchToParticipantView,
}) => {
  const toast = useToast();

  // Three focused tabs: the working ingest path leads. Google account linking
  // was removed from the console because connecting Google cannot import photos
  // (Google closed third-party library access on 2025-03-31).
  const [activeTab, setActiveTab] = useState('photos');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Upload state
  const [selectedPhotographerId, setSelectedPhotographerId] = useState(photographers[0]?.id || '');
  const [selectedSession, setSelectedSession] = useState(
    event.sessions[1] || event.sessions[0] || 'General'
  );
  const [isUploading, setIsUploading] = useState(false);
  const [ingestionJobs, setIngestionJobs] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [uploadError, setUploadError] = useState(null);
  const uploadInputRef = useRef(null);

  // Real storage + vector-index stats ({ provider, vectorIndex }).
  const [storage, setStorage] = useState(
    storageConfig ? { provider: storageConfig, vectorIndex: null } : null
  );

  // Attendees tab filter state
  const [attendeeFilter, setAttendeeFilter] = useState('all');
  const [attendeeSearch, setAttendeeSearch] = useState('');

  // Admin authentication — the whole console is gated behind the httpOnly
  // cookie set by the backend; admin-only endpoints 401/403 without it.
  const [admin, setAdmin] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Account management
  const [users, setUsers] = useState([]);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);

  // Modal + confirm state
  const [photographerModal, setPhotographerModal] = useState(null); // {} to add, {photographer} to edit
  const [participantModal, setParticipantModal] = useState(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [userModal, setUserModal] = useState(null);
  const [eventModal, setEventModal] = useState(null); // {} new, {event} edit
  const [attendeePhotos, setAttendeePhotos] = useState(null); // participant
  const [confirm, setConfirm] = useState(null); // {title,message,confirmLabel,tone,onConfirm}
  const [storageModal, setStorageModal] = useState(false); // Google Drive connect/switch

  const loadStorage = useCallback(() => {
    if (!event?.id) return;
    api.storageStats(event.id).then(setStorage).catch(() => {});
  }, [event?.id]);

  useEffect(() => {
    loadStorage();
  }, [loadStorage]);

  // Resolve the session against the httpOnly cookie: /api/auth/me succeeds if
  // we're signed in, otherwise fall through to the sign-in card.
  useEffect(() => {
    let cancelled = false;
    api.me()
      .then((user) => { if (!cancelled) setAdmin(user); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAuthChecked(true); });
    return () => { cancelled = true; };
  }, []);

  // Keep the upload photographer selection valid as the crew list changes.
  useEffect(() => {
    if (!photographers.some((p) => p.id === selectedPhotographerId)) {
      setSelectedPhotographerId(photographers[0]?.id || '');
    }
  }, [photographers, selectedPhotographerId]);

  const loadUsers = useCallback(() => {
    api.listUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (admin && activeTab === 'settings') loadUsers();
  }, [admin, activeTab, loadUsers]);

  // Generate the guest QR client-side (no external service) in high-res for crisp large-screen display.
  useEffect(() => {
    if (!showQrModal) return;
    QRCode.toDataURL(shareUrl, { width: 512, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQrModal]);


  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const resp = await api.login(authEmail.trim(), authPassword);
      setAdmin(resp.user || null);
      setAuthPassword('');
      toast.success('Signed in.');
    } catch (err) {
      setAuthError(
        err.status === 401 ? 'Wrong email or password.'
          : err.status === 429 ? 'Too many attempts — wait a moment and try again.'
          : (err.message || 'Sign-in failed.')
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Cookie-clearing failed on the server (e.g. network issue) — still clear
      // local state so the UI reflects that the user is signed out.
      toast.error('Sign-out request failed — you have been signed out locally.');
    }
    setAdmin(null);
    toast.info('Signed out.');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.next.length < 8) { toast.error('New password must be at least 8 characters.'); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error('New passwords do not match.'); return; }
    setPwBusy(true);
    try {
      await api.changePassword({ currentPassword: pwForm.current, newPassword: pwForm.next });
      toast.success('Password changed.');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.status === 403 ? 'Current password is incorrect.' : (err.message || 'Could not change password.'));
    } finally {
      setPwBusy(false);
    }
  };

  // Calculations
  const coveredParticipants = participants.filter((p) => p.hasFoundPhotos && p.matchedCount > 0);
  const missingParticipants = participants.filter((p) => !p.hasFoundPhotos || p.matchedCount === 0);
  const coverageRate = Math.round((coveredParticipants.length / (participants.length || 1)) * 100);

  const totalDownloads = photographers.reduce((sum, p) => sum + p.totalDownloads, 0);

  const activePhotographer =
    photographers.find((p) => p.id === selectedPhotographerId) || photographers[0];

  const shareUrl = `${window.location.origin}/?event=${encodeURIComponent(event.slug)}`;

  const provider = storage?.provider || storageConfig || null;
  const driveConnected = provider?.provider === 'gdrive' && !!provider?.connected;
  const vectorIndex = storage?.vectorIndex || null;

  const copyShareLink = () => {
    navigator.clipboard?.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Real ingestion: POST the actual file bytes as multipart/form-data. The
  // backend stores each image, runs InsightFace detection + embedding, and
  // persists Photo + FaceDetection rows synchronously, returning the finished
  // IngestionJob rows. The first upload triggers a ~300 MB model download.
  const handleBatchUpload = async (fileList) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;
    if (!activePhotographer) {
      setUploadError('Add a photographer to this event before uploading.');
      return;
    }
    const sessionTag = (selectedSession || '').trim() || 'General';

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress({ done: 0, total: files.length });

    // Upload/index one photo at a time so the bar shows real progress (indexed
    // count), not a guess. The first photo also triggers the ~300 MB model load,
    // so the bar resting briefly at 0% on photo 1 is expected — the rest are fast.
    // Per-file also means one bad photo fails alone instead of the whole batch.
    const collectedJobs = [];
    let ok = 0;
    let failed = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('files', files[i]);
        formData.append('photographerId', activePhotographer.id);
        formData.append('sessionTag', sessionTag);
        formData.append('cameraInfo', activePhotographer.gear || '');

        try {
          const resp = await api.uploadPhotos(event.id, formData);
          const jobs = resp?.jobs || [];
          collectedJobs.push(...jobs);
          ok += jobs.filter((j) => j.stage !== 'error').length;
          failed += jobs.filter((j) => j.stage === 'error').length;
        } catch (err) {
          if (err.status === 401) throw err; // bubble auth failure out of the loop
          failed += 1;
        } finally {
          setUploadProgress({ done: i + 1, total: files.length });
        }
      }

      setIngestionJobs((prev) => [...collectedJobs, ...prev]);

      // Remember a brand-new session tag on the event so it joins the datalist.
      if (sessionTag && !(event.sessions || []).includes(sessionTag)) {
        try {
          await api.updateEvent(event.id, { sessions: [...(event.sessions || []), sessionTag] });
        } catch { /* non-fatal: the photos still uploaded with the tag */ }
      }

      if (ok) toast.success(`Indexed ${ok} photo${ok === 1 ? '' : 's'}${failed ? ` · ${failed} failed` : ''}.`);
      else if (failed) toast.error(`All ${failed} upload${failed === 1 ? '' : 's'} failed to index.`);

      onUploadPhotos();
      loadStorage();
    } catch (err) {
      // Surface whatever finished before the failure, then report it.
      if (collectedJobs.length) setIngestionJobs((prev) => [...collectedJobs, ...prev]);
      if (err.status === 401) {
        setUploadError('Your admin session expired — please sign in again.');
        setAdmin(null);
      } else {
        setUploadError(err.message || 'Upload failed. Check the backend is running.');
        toast.error(err.message || 'Upload failed.');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress({ done: 0, total: 0 });
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  const handleGooglePhotosPicker = async () => {
    if (!activePhotographer) {
      setUploadError('Add a photographer to this event before uploading.');
      return;
    }
    const sessionTag = (selectedSession || '').trim() || 'General';

    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      '245918216788-hncv0hgdkki2pn3i3q6pivpi9bpt20du.apps.googleusercontent.com';

    if (!window.google?.accounts?.oauth2) {
      toast.error('Google Identity Services library not ready. Please refresh the page.');
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          toast.error(`Google auth error: ${tokenResponse.error_description || tokenResponse.error}`);
          return;
        }

        const accessToken = tokenResponse.access_token;
        setIsUploading(true);
        setUploadError(null);

        try {
          // 1. Create session with backend
          const session = await api.createPickerSession(accessToken);
          if (!session.sessionId || !session.pickerUri) {
            throw new Error('Failed to create Google Photos picker session.');
          }

          // 2. Open popup for user to pick photos
          const popup = window.open(
            session.pickerUri,
            'rubicon_google_photos_picker',
            'width=850,height=650,menubar=no,toolbar=no'
          );

          toast.info('Select photos in the Google Photos window and click Done.');

          // 3. Poll until mediaItemsSet is true or popup is closed
          let isDone = false;
          const startTime = Date.now();
          while (!isDone) {
            if (Date.now() - startTime > 10 * 60 * 1000) {
              throw new Error('Picker session timed out.');
            }

            await new Promise((r) => setTimeout(r, 2000));
            try {
              const status = await api.pollPickerSession(session.sessionId);
              if (status.done) {
                isDone = true;
                if (popup && !popup.closed) popup.close();
              } else if (popup && popup.closed) {
                const lastCheck = await api.pollPickerSession(session.sessionId);
                if (lastCheck.done) {
                  isDone = true;
                } else {
                  toast.info('Picker window was closed.');
                  setIsUploading(false);
                  return;
                }
              }
            } catch (pollErr) {
              if (popup && popup.closed) {
                setIsUploading(false);
                return;
              }
            }
          }

          // 4. Ingest the chosen photos
          toast.info('Downloading and indexing photos from Google Photos...');
          const resp = await api.ingestFromPicker(event.id, {
            sessionId: session.sessionId,
            photographerId: activePhotographer.id,
            sessionTag,
            cameraInfo: activePhotographer.gear || 'Google Photos',
          });

          const jobs = resp?.jobs || [];
          setIngestionJobs((prev) => [...jobs, ...prev]);

          // Remember new session tag
          if (sessionTag && !(event.sessions || []).includes(sessionTag)) {
            try {
              await api.updateEvent(event.id, { sessions: [...(event.sessions || []), sessionTag] });
            } catch { /* non-fatal */ }
          }

          const ok = jobs.filter((j) => j.stage !== 'error').length;
          const failed = jobs.filter((j) => j.stage === 'error').length;

          if (ok) toast.success(`Indexed ${ok} photo${ok === 1 ? '' : 's'} from Google Photos${failed ? ` · ${failed} failed` : ''}.`);
          else if (failed) toast.error(`Failed to ingest ${failed} photo${failed === 1 ? '' : 's'}.`);
          else toast.info('No photos selected.');

          onUploadPhotos();
          loadStorage();
        } catch (err) {
          setUploadError(err.message || 'Google Photos ingestion failed.');
          toast.error(err.message || 'Google Photos ingestion failed.');
        } finally {
          setIsUploading(false);
        }
      },
    });

    tokenClient.requestAccessToken({ prompt: '' });
  };


  // ---- CRUD action helpers (each confirms first, then toasts) ----
  const askDeletePhoto = (photo) => setConfirm({
    title: 'Delete this photo?',
    message: `“${photo.filename}” and its face index entries will be permanently removed.`,
    confirmLabel: 'Delete photo',
    onConfirm: async () => {
      try {
        await api.deletePhoto(photo.id);
        toast.success('Photo deleted.');
        onDataChanged?.();
        loadStorage();
      } catch (err) { toast.error(err.message || 'Could not delete photo.'); throw err; }
    },
  });

  const askDeletePhotographer = (p) => setConfirm({
    title: `Remove ${p.name}?`,
    message: 'They will be unlinked from this event. Photos they uploaded must be removed first.',
    confirmLabel: 'Remove photographer',
    onConfirm: async () => {
      try {
        await api.deletePhotographer(p.id);
        toast.success(`Removed ${p.name}.`);
        onDataChanged?.();
      } catch (err) {
        toast.error(err.status === 409 ? (err.message || 'Reassign or delete their photos first.') : (err.message || 'Could not remove photographer.'));
        throw err;
      }
    },
  });

  const askDeleteParticipant = (p) => setConfirm({
    title: `Delete ${p.name}?`,
    message: 'The attendee is removed from the roster. Their matched photos stay, just unlinked.',
    confirmLabel: 'Delete attendee',
    onConfirm: async () => {
      try {
        await api.deleteParticipant(p.id);
        toast.success(`Deleted ${p.name}.`);
        onDataChanged?.();
      } catch (err) { toast.error(err.message || 'Could not delete attendee.'); throw err; }
    },
  });

  const askDeleteUser = (u) => setConfirm({
    title: `Delete ${u.name}?`,
    message: `${u.email} will lose console access immediately.`,
    confirmLabel: 'Delete user',
    onConfirm: async () => {
      try {
        await api.deleteUser(u.id);
        toast.success(`Deleted ${u.name}.`);
        loadUsers();
      } catch (err) {
        toast.error(err.status === 409 ? (err.message || 'That user cannot be deleted.') : (err.message || 'Could not delete user.'));
        throw err;
      }
    },
  });

  // Filtered Attendees list
  const filteredParticipants = participants
    .filter((p) => {
      if (attendeeFilter === 'covered') return p.hasFoundPhotos && p.matchedCount > 0;
      if (attendeeFilter === 'missing') return !p.hasFoundPhotos || p.matchedCount === 0;
      return true;
    })
    .filter((p) => {
      if (!attendeeSearch.trim()) return true;
      const q = attendeeSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.regId || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
      );
    });

  // Auth gate: while the cookie is verified we show a brief checking state.
  if (!admin) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
          <div className="flex items-center space-x-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 font-display">Admin sign-in</h1>
              <p className="text-xs text-slate-500">Sign in to manage {event.name}.</p>
            </div>
          </div>

          {!authChecked ? (
            <div className="py-6 text-center text-sm text-slate-400 animate-pulse">Checking session…</div>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  autoFocus
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="admin@rubicon.io"
                  className={fieldClass}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className={fieldClass}
                  required
                />
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                {authLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{authLoading ? 'Signing in…' : 'Sign in'}</span>
              </button>



              <button
                type="button"
                onClick={onSwitchToParticipantView}
                className="w-full text-xs font-semibold text-slate-500 hover:text-slate-700 pt-1 cursor-pointer"
              >
                &larr; Back to guest view
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'photos', label: 'Photos & Upload', icon: Upload, count: photos.length || undefined },
    { id: 'attendees', label: 'Attendees', icon: Users, badge: `${coverageRate}%` },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const strip = [
    { icon: FileImage, label: 'Photos', value: photos.length.toLocaleString(), tone: 'text-indigo-600' },
    { icon: UserCheck, label: 'Coverage', value: `${coverageRate}%`, tone: 'text-emerald-600' },
    { icon: Camera, label: 'Crew', value: photographers.length, tone: 'text-slate-700' },
    { icon: Download, label: 'Downloads', value: totalDownloads.toLocaleString(), tone: 'text-indigo-600' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Event Administration</span>
              <span>&bull;</span>
              <span>{event.date}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display">
              {event.name}
            </h1>
            <p className="text-xs text-slate-500 mt-1">{event.location || '—'}</p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center space-x-2.5">
            {admin && (
              <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="truncate max-w-[160px]">{admin.email}</span>
              </div>
            )}
            <button
              onClick={handleAdminLogout}
              title="Sign out"
              className="px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Guest QR</span>
            </button>

            <button
              onClick={onSwitchToParticipantView}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
            >
              <span>View as Guest</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center space-x-1 border-b border-slate-200 mt-6 -mb-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
                    {tab.count}
                  </span>
                )}
                {tab.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700 font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slim stat strip */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm flex flex-wrap items-center gap-x-7 gap-y-2">
        {strip.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-2">
              {i > 0 && <span className="hidden sm:block w-px h-6 bg-slate-200 -ml-3.5 mr-3.5" />}
              <Icon className={`w-4 h-4 ${s.tone}`} />
              <span className={`text-base font-extrabold ${s.tone}`}>{s.value}</span>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* TAB: PHOTOS & UPLOAD */}
      {activeTab === 'photos' && (
        <div className="space-y-5">
          {/* Upload studio */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Add event photos</h2>
              <p className="text-xs text-slate-500 mt-1">
                Drop in session photos. Each image is stored in the media vault and automatically
                indexed with multi-face recognition (InsightFace + cosine vector search) so guests
                can find themselves.
              </p>
            </div>

            {/* Photographer & Session */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Uploading photographer</label>
                <select
                  value={selectedPhotographerId}
                  onChange={(e) => setSelectedPhotographerId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium"
                >
                  {photographers.length === 0 && <option value="">No photographers yet</option>}
                  {photographers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({(p.gear || '').split('(')[0]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Session tag</label>
                <input
                  list="session-tags"
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  placeholder="Type or pick a session…"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium"
                />
                <datalist id="session-tags">
                  {(event.sessions || []).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <p className="text-[10px] text-slate-400">
                  Type a new tag to create it — it's remembered for next time.
                </p>
              </div>
            </div>

            {/* Storage destination — where these uploads will land. Switch here so
                a full/other account can be swapped before dropping files, without a
                trip to Settings. Opens the same modal as the Settings card. */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${driveConnected ? 'bg-indigo-600' : 'bg-white border border-slate-200'}`}>
                  {driveConnected ? <HardDrive className="w-4 h-4 text-white" /> : <Server className="w-4 h-4 text-slate-500" />}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Uploading to</div>
                  <div className="text-xs font-bold text-slate-900 truncate" title={driveConnected ? provider?.accountEmail : undefined}>
                    {driveConnected ? (provider?.accountEmail || 'Google Drive') : 'Local Vault'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStorageModal(true)}
                className="shrink-0 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {driveConnected ? <RefreshCw className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
                <span>{driveConnected ? 'Switch account' : 'Connect Drive'}</span>
              </button>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => !isUploading && uploadInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all flex flex-col items-center justify-center space-y-3 ${
                isUploading
                  ? 'border-indigo-300 bg-indigo-50/40 cursor-wait'
                  : 'border-slate-200 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/30 cursor-pointer'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-indigo-600">
                {isUploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              </div>
              {isUploading ? (
                <div className="w-full max-w-xs space-y-2.5">
                  <div className="text-sm font-bold text-slate-900">
                    Indexing photo {Math.min(uploadProgress.done + 1, uploadProgress.total)} of {uploadProgress.total}
                  </div>
                  <div className="h-2 w-full rounded-full bg-white border border-indigo-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress.total ? (uploadProgress.done / uploadProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span className="text-slate-500">Face detection + 512-d embedding · keep this tab open</span>
                    <span className="tabular-nums font-bold text-indigo-700">
                      {uploadProgress.total ? Math.round((uploadProgress.done / uploadProgress.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-900">
                    Drop JPEG/PNG files here, or click to browse
                  </div>
                  <div className="text-xs text-slate-400">
                    Storage + face detection + 512-d embedding, all server-side
                  </div>
                </div>
              )}
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                accept="image/*"
                disabled={isUploading}
                onChange={(e) => handleBatchUpload(e.target.files)}
                className="hidden"
              />
            </div>

            {/* Cloud Import Option: Google Photos Picker */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50 border border-indigo-100/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/10 flex items-center justify-center text-indigo-600 shrink-0">
                  <Images className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Google Photos Cloud Library</div>
                  <div className="text-[11px] text-slate-500">Pick albums or select individual shots directly from Google Photos</div>
                </div>
              </div>
              <button
                type="button"
                disabled={isUploading}
                onClick={handleGooglePhotosPicker}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60 shrink-0"
              >
                <Images className="w-3.5 h-3.5" />
                <span>Pick from Google Photos</span>
              </button>
            </div>

            {uploadError && (
              <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          {/* Ingestion results */}
          {ingestionJobs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Ingestion results ({ingestionJobs.length})
                </h3>
                <span className="text-xs text-slate-400 font-mono">Most recent first</span>
              </div>

              <div className="space-y-3">
                {ingestionJobs.map((job) => {
                  const failed = job.stage === 'error';
                  return (
                    <div
                      key={job.id}
                      className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {job.previewUrl ? (
                          <img
                            src={job.previewUrl}
                            alt={job.filename}
                            className="w-12 h-9 rounded-lg object-cover ring-1 ring-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-9 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <FileImage className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {job.filename}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            {job.googleMediaId ? `Key: ${job.googleMediaId.slice(0, 28)}` : 'no media key'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-xs font-bold">
                            {failed ? (
                              <span className="text-rose-600">Failed: {job.error || 'ingest error'}</span>
                            ) : job.stage === 'published' ? (
                              <span className="text-emerald-700 flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Indexed &amp; Published ({job.detectedFacesCount} faces)</span>
                              </span>
                            ) : (
                              <span className="text-indigo-600">Processing… ({job.stage})</span>
                            )}
                          </div>
                        </div>

                        <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              failed ? 'bg-rose-500' : job.stage === 'published' ? 'bg-emerald-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full catalog */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Photo catalog</h3>
                <p className="text-xs text-slate-500">Every capture indexed for this event. Hover a photo to delete it.</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {photos.length} total
              </span>
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative aspect-4/3 rounded-xl overflow-hidden bg-slate-900 border border-slate-200"
                  >
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt={photo.filename}
                      onClick={() => onOpenLightbox(photo)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); askDeletePhoto(photo); }}
                      title="Delete photo"
                      className="absolute top-1 right-1 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[9px] font-mono pointer-events-none">
                      {photo.faces.length} faces
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                No photos yet. Drop some into the upload zone above to see them here.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: ATTENDEES & COVERAGE */}
      {activeTab === 'attendees' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Attendee coverage</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {missingParticipants.length > 0
                  ? `${missingParticipants.length} attendee${missingParticipants.length === 1 ? '' : 's'} not yet detected in any photo.`
                  : 'Every attendee has at least one photo indexed.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setRosterOpen(true)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Import roster
              </button>
              <button
                onClick={() => setParticipantModal({})}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add attendee
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl w-fit">
              <button
                onClick={() => setAttendeeFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  attendeeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({participants.length})
              </button>
              <button
                onClick={() => setAttendeeFilter('covered')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  attendeeFilter === 'covered' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Covered ({coveredParticipants.length})
              </button>
              <button
                onClick={() => setAttendeeFilter('missing')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  attendeeFilter === 'missing' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Missing ({missingParticipants.length})
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={attendeeSearch}
                onChange={(e) => setAttendeeSearch(e.target.value)}
                placeholder="Search name, email, or reg ID…"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>
          </div>

          {filteredParticipants.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              No attendees match. Add one or import a roster to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredParticipants.map((p) => {
                const isCovered = p.hasFoundPhotos && p.matchedCount > 0;
                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={p.avatar}
                          alt={p.name}
                          className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">{p.regId || '—'}</div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                          isCovered
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isCovered ? `${p.matchedCount} Photos` : 'Needs Photos'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <div className="truncate">{p.email || '—'}</div>
                      <div className="text-[10px] text-slate-400">Phone: {p.phone || '—'}</div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => setAttendeePhotos(p)}
                        disabled={!isCovered}
                        title={isCovered ? 'View matched photos' : 'No matched photos yet'}
                        className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600"
                      >
                        <Images className="w-3.5 h-3.5" /> Photos
                      </button>
                      <button
                        onClick={() => setParticipantModal({ participant: p })}
                        title="Edit attendee"
                        className="px-2 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => askDeleteParticipant(p)}
                        title="Delete attendee"
                        className="px-2 py-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-5">
          {/* Event settings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">Event settings</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEventModal({})}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> New event
                </button>
                <button
                  onClick={() => setEventModal({ event })}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit event
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Name</div>
                <div className="font-bold text-slate-900 mt-0.5 truncate">{event.name}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Date</div>
                <div className="font-bold text-slate-900 mt-0.5 truncate">{event.date || '—'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Location</div>
                <div className="font-bold text-slate-900 mt-0.5 truncate">{event.location || '—'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Cohort</div>
                <div className="font-bold text-slate-900 mt-0.5 truncate">{event.cohort || '—'}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-400">Sessions</div>
              <div className="flex flex-wrap gap-1.5">
                {(event.sessions || []).map((s) => (
                  <span key={s} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {events.length > 1 && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-bold text-slate-500">Switch event:</span>
                <select
                  value={event.id}
                  onChange={(e) => {
                    const next = events.find((ev) => ev.id === e.target.value);
                    if (next) onSelectEvent?.(next);
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Photographer crew */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">Photographer crew</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg">
                  {photographers.length} linked
                </span>
                <button
                  onClick={() => setPhotographerModal({})}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {photographers.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                No photographers yet. Add one so uploads can be attributed.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {photographers.map((p) => (
                  <div
                    key={p.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={p.avatar}
                          alt={p.name}
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-indigo-500/20 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{p.name}</div>
                          <div className="text-xs text-slate-400 truncate">{p.email || '—'}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setPhotographerModal({ photographer: p })}
                          title="Edit"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => askDeletePhotographer(p)}
                          title="Remove"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-semibold text-slate-700">Gear:</span> {p.gear || '—'}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-100">
                      <div>
                        <div className="text-slate-400 text-[10px] uppercase font-bold">Uploaded</div>
                        <div className="font-extrabold text-slate-900 mt-0.5">{p.uploadedCount}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-[10px] uppercase font-bold">Views</div>
                        <div className="font-extrabold text-indigo-600 mt-0.5">{p.totalViews}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-[10px] uppercase font-bold">Downloads</div>
                        <div className="font-extrabold text-emerald-600 mt-0.5">{p.totalDownloads}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account & access */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Account &amp; access</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Change password */}
              <form onSubmit={handleChangePassword} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-900">Change your password</h3>
                </div>
                <input
                  type="password" value={pwForm.current} autoComplete="current-password"
                  onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                  placeholder="Current password" className={fieldClass} required
                />
                <input
                  type="password" value={pwForm.next} autoComplete="new-password"
                  onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                  placeholder="New password (min. 8 chars)" className={fieldClass} required
                />
                <input
                  type="password" value={pwForm.confirm} autoComplete="new-password"
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  placeholder="Confirm new password" className={fieldClass} required
                />
                <button
                  type="submit" disabled={pwBusy}
                  className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {pwBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  <span>{pwBusy ? 'Updating…' : 'Update password'}</span>
                </button>
              </form>

              {/* Users */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-900">Console users ({users.length})</h3>
                  </div>
                  <button
                    onClick={() => setUserModal({})}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add user
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {users.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-slate-400">No users loaded.</div>
                  ) : users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {u.name}
                          {admin?.id === u.id && <span className="text-[10px] font-semibold text-slate-400"> (you)</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{u.email}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          u.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {u.role}
                        </span>
                        <button
                          onClick={() => setUserModal({ user: u })}
                          title="Edit user"
                          className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => askDeleteUser(u)}
                          disabled={admin?.id === u.id}
                          title={admin?.id === u.id ? 'You cannot delete yourself' : 'Delete user'}
                          className="p-1 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Storage & vector index */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">Storage &amp; face index</h2>
              </div>

              <button
                onClick={onOpenArchitecture}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Full blueprint</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Storage provider — account-focused: which account holds this
                  event's photos, plus a one-tap switch. */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Storage provider</span>
                  <span
                    className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg border text-[11px] ${
                      driveConnected
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : 'text-slate-600 bg-slate-100 border-slate-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${driveConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {driveConnected ? 'Connected' : 'Local'}
                  </span>
                </div>

                {/* Account identity — the hero of this card */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                      driveConnected ? 'bg-indigo-600' : 'bg-white border border-slate-200'
                    }`}
                  >
                    {driveConnected ? (
                      <HardDrive className="w-5 h-5 text-white" />
                    ) : (
                      <Server className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {provider?.providerName || 'Local Vault'}
                    </div>
                    <div
                      className="text-xs text-slate-500 truncate"
                      title={driveConnected ? provider?.accountEmail : undefined}
                    >
                      {driveConnected
                        ? provider?.accountEmail || 'Connected account'
                        : 'Photos stored on this server'}
                    </div>
                  </div>
                </div>

                {/* Actions — one-tap switch / connect */}
                <div className="flex items-center gap-2 mt-auto pt-1">
                  <button
                    type="button"
                    onClick={() => setStorageModal(true)}
                    className="flex-1 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {driveConnected ? (
                      <RefreshCw className="w-3.5 h-3.5" />
                    ) : (
                      <HardDrive className="w-3.5 h-3.5" />
                    )}
                    <span>{driveConnected ? 'Switch account' : 'Connect Google Drive'}</span>
                  </button>
                  {driveConnected && (
                    <button
                      type="button"
                      onClick={() => setConfirm({
                        title: 'Disconnect Google Drive?',
                        message: 'New uploads fall back to local storage. Photos already in this Drive account keep loading.',
                        confirmLabel: 'Disconnect',
                        tone: 'primary',
                        onConfirm: async () => {
                          try {
                            await api.disconnectStorage(event.id);
                            toast.success('Google Drive disconnected.');
                            loadStorage();
                          } catch (err) {
                            toast.error(err.message || 'Could not disconnect.');
                            throw err;
                          }
                        },
                      })}
                      className="px-3 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {/* Vector index */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Vector face index</span>
                  <span className="text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    {vectorIndex ? `${vectorIndex.dim}-d ${vectorIndex.metric}` : '512-d cosine'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  Model: {vectorIndex?.model || 'buffalo_l'} &bull; Threshold:{' '}
                  {vectorIndex?.similarityThreshold ?? 0.35}
                </div>
                <div className="text-[11px] text-slate-600">
                  <span className="font-bold text-slate-900">
                    {(vectorIndex?.indexedFaces ?? 0).toLocaleString()}
                  </span>{' '}
                  face embeddings indexed for this event. Queries hit the vector index rather than
                  re-scanning images.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guest Access QR Code Modal (client-side generated) */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowQrModal(false); }}
        >
          <div className="bg-white rounded-3xl max-w-lg lg:max-w-xl w-full p-6 sm:p-9 space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-600">
                    Live Event Portal Standee
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-display">
                  {event.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Display on venue screens, table placards, or badges for instant AI selfie search.
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <QrCode className="w-6 h-6" />
              </div>
            </div>

            {/* High-Impact QR Display Placard */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 p-6 sm:p-8 rounded-3xl text-center space-y-5 shadow-xl border border-slate-800">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-indigo-300">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                <span>Scan with any phone camera to find your photos</span>
              </div>

              {/* Responsive Sharp QR Container */}
              <div className="w-52 h-52 sm:w-64 sm:h-64 md:w-72 md:h-72 mx-auto bg-white p-3 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`${event.name} guest portal QR`}
                    className="w-full h-full object-contain select-none"
                  />
                ) : (
                  <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs text-slate-400 font-mono bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 truncate max-w-sm mx-auto select-all">
                  {shareUrl}
                </div>

                {/* Creator Signature in QR frame */}
                <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <span>Built by</span>
                  <span className="font-bold text-white">Destiny Kingsley</span>
                  <span>from</span>
                  <span className="font-bold text-slate-200">the Ruby Group</span>
                </div>

              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={copyShareLink}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Portal link copied!' : 'Copy guest portal link'}</span>
              </button>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`${event.slug || 'event'}-guest-qr.png`}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Save QR image</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRUD modals */}
      <PhotographerModal
        open={!!photographerModal}
        onClose={() => setPhotographerModal(null)}
        eventId={event.id}
        photographer={photographerModal?.photographer}
        onSaved={onDataChanged}
      />
      <ParticipantModal
        open={!!participantModal}
        onClose={() => setParticipantModal(null)}
        eventId={event.id}
        participant={participantModal?.participant}
        onSaved={onDataChanged}
      />
      <RosterImportModal
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        eventId={event.id}
        onSaved={onDataChanged}
      />
      <UserModal
        open={!!userModal}
        onClose={() => setUserModal(null)}
        user={userModal?.user}
        onSaved={loadUsers}
      />
      <EventModal
        open={!!eventModal}
        onClose={() => setEventModal(null)}
        event={eventModal?.event}
        onSaved={() => { onEventsChanged?.(); onDataChanged?.(); }}
      />
      <StorageConnectModal
        open={storageModal}
        onClose={() => setStorageModal(false)}
        event={event}
        connected={driveConnected}
        currentEmail={provider?.accountEmail || ''}
      />
      <AttendeePhotosModal
        open={!!attendeePhotos}
        onClose={() => setAttendeePhotos(null)}
        participant={attendeePhotos}
        onOpenLightbox={onOpenLightbox}
      />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone || 'danger'}
      />
    </div>
  );
};
