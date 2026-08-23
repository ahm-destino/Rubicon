import React, { useEffect, useState } from 'react';
import { Images, RefreshCw, Eye } from 'lucide-react';
import { api } from '../../api';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

// Read-only view of the photos an attendee's face has been linked to.
// Clicking a photo hands it to the shared lightbox (highlighting this attendee).
export function AttendeePhotosModal({ open, onClose, participant, onOpenLightbox }) {
  const toast = useToast();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !participant?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    setResults([]);
    api.participantPhotos(participant.id)
      .then((rows) => { if (!cancelled) setResults(rows || []); })
      .catch((err) => { if (!cancelled) toast.error(err.message || 'Could not load photos.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, participant?.id, toast]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={participant ? `${participant.name}'s photos` : 'Attendee photos'}
      subtitle={loading ? 'Loading matches…' : `${results.length} matched photo${results.length === 1 ? '' : 's'}`}
      icon={Images}
      maxWidth="max-w-3xl"
    >
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-xs font-semibold">Finding matches…</span>
        </div>
      ) : results.length === 0 ? (
        <div className="py-14 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
          No photos have been matched to {participant?.name || 'this attendee'} yet.
          <div className="text-[11px] text-slate-400 mt-1">
            Matches appear here after this attendee runs a selfie search, or is identified in one.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {results.map(({ photo, similarity }) => (
            <button
              key={photo.id}
              onClick={() => { onOpenLightbox?.(photo, participant?.id); onClose?.(); }}
              className="group relative aspect-4/3 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 cursor-pointer text-left"
            >
              <img
                src={photo.thumbnailUrl || photo.url}
                alt={photo.filename}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Eye className="w-4 h-4 text-white" />
              </div>
              {typeof similarity === 'number' && (
                <div className="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[9px] font-mono">
                  {Math.round(similarity * 100)}% match
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default AttendeePhotosModal;
