import React, { useEffect, useState } from 'react';
import { CalendarDays, RefreshCw, Save, X, Plus } from 'lucide-react';
import { api } from '../../api';
import { Modal, fieldClass, labelClass } from '../ui/Modal';
import { useToast } from '../ui/Toast';

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const EMPTY = { name: '', slug: '', date: '', location: '', cohort: '' };

// Create or edit an event, including its session tags. "All Sessions" is the
// implicit catch-all and is always kept first; the rest are editable chips.
export function EventModal({ open, onClose, event, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [sessions, setSessions] = useState([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [newSession, setNewSession] = useState('');
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(event);

  useEffect(() => {
    if (!open) return;
    if (event) {
      setForm({
        name: event.name || '', slug: event.slug || '', date: event.date || '',
        location: event.location || '', cohort: event.cohort || '',
      });
      setSessions((event.sessions || []).filter((s) => s !== 'All Sessions'));
      setSlugTouched(true);
    } else {
      setForm(EMPTY);
      setSessions([]);
      setSlugTouched(false);
    }
    setNewSession('');
  }, [open, event]);

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: v };
      // Auto-fill slug from name until the user edits it directly (create only).
      if (k === 'name' && !slugTouched && !isEdit) next.slug = slugify(v);
      return next;
    });
  };

  const addSession = () => {
    const s = newSession.trim();
    if (!s) return;
    if (s.toLowerCase() === 'all sessions' || sessions.some((x) => x.toLowerCase() === s.toLowerCase())) {
      setNewSession('');
      return;
    }
    setSessions((prev) => [...prev, s]);
    setNewSession('');
  };

  const removeSession = (s) => setSessions((prev) => prev.filter((x) => x !== s));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Event name is required.'); return; }
    const slug = (form.slug.trim() || slugify(form.name));
    if (!slug) { toast.error('Could not derive a slug — add a name or slug.'); return; }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(), slug, date: form.date.trim(),
        location: form.location.trim(), cohort: form.cohort.trim(),
        sessions: ['All Sessions', ...sessions],
      };
      if (isEdit) {
        await api.updateEvent(event.id, body);
        toast.success('Event updated.');
      } else {
        await api.createEvent(body);
        toast.success(`Created “${body.name}”.`);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Could not save event.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isEdit ? 'Event settings' : 'New event'}
      subtitle={isEdit ? event?.name : 'Set up a new event.'}
      icon={CalendarDays}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>Event name</label>
            <input className={fieldClass} value={form.name} onChange={set('name')} placeholder="Autumn Summit 2026" autoFocus required />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Slug <span className="text-slate-400 font-normal">(URL)</span></label>
            <input
              className={fieldClass}
              value={form.slug}
              onChange={(e) => { setSlugTouched(true); set('slug')(e); }}
              placeholder="autumn-summit-2026"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>Date range</label>
            <input className={fieldClass} value={form.date} onChange={set('date')} placeholder="Oct 12–14, 2026" />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Location</label>
            <input className={fieldClass} value={form.location} onChange={set('location')} placeholder="Lagos, NG" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Cohort <span className="text-slate-400 font-normal">(optional)</span></label>
          <input className={fieldClass} value={form.cohort} onChange={set('cohort')} placeholder="Cohort 7" />
        </div>

        {/* Session chips */}
        <div className="space-y-2">
          <label className={labelClass}>Sessions</label>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
              All Sessions
            </span>
            {sessions.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {s}
                <button type="button" onClick={() => removeSession(s)} className="hover:text-rose-600 cursor-pointer" aria-label={`Remove ${s}`}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={fieldClass}
              value={newSession}
              onChange={(e) => setNewSession(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSession(); } }}
              placeholder="Add a session (e.g. Keynote)"
            />
            <button type="button" onClick={addSession}
              className="shrink-0 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} disabled={busy}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={busy}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60">
            {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isEdit ? 'Save changes' : 'Create event'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default EventModal;
