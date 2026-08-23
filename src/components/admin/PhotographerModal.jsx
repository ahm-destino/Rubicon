import React, { useEffect, useState } from 'react';
import { Camera, RefreshCw, Save } from 'lucide-react';
import { api } from '../../api';
import { Modal, fieldClass, labelClass } from '../ui/Modal';
import { useToast } from '../ui/Toast';

const EMPTY = { name: '', email: '', badge: 'Photographer', gear: '', avatar: '' };

// Add or edit a photographer. Pass `photographer` to edit, omit to create.
export function PhotographerModal({ open, onClose, eventId, photographer, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(photographer);

  useEffect(() => {
    if (open) {
      setForm(photographer
        ? {
            name: photographer.name || '', email: photographer.email || '',
            badge: photographer.badge || 'Photographer', gear: photographer.gear || '',
            avatar: photographer.avatar || '',
          }
        : EMPTY);
    }
  }, [open, photographer]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(), email: form.email.trim(),
        badge: form.badge.trim() || 'Photographer', gear: form.gear.trim(),
        avatar: form.avatar.trim(),
      };
      if (isEdit) {
        await api.updatePhotographer(photographer.id, body);
        toast.success(`Updated ${body.name}.`);
      } else {
        await api.createPhotographer(eventId, body);
        toast.success(`Added ${body.name} to the crew.`);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Could not save photographer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isEdit ? 'Edit photographer' : 'Add photographer'}
      subtitle={isEdit ? photographer?.name : 'Link a new shooter to this event.'}
      icon={Camera}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label className={labelClass}>Name</label>
          <input className={fieldClass} value={form.name} onChange={set('name')} placeholder="Jane Doe" autoFocus required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>Email</label>
            <input type="email" className={fieldClass} value={form.email} onChange={set('email')} placeholder="jane@studio.com" />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Badge / role</label>
            <input className={fieldClass} value={form.badge} onChange={set('badge')} placeholder="Lead Photographer" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Gear</label>
          <input className={fieldClass} value={form.gear} onChange={set('gear')} placeholder="Canon R5 (RF 24-70mm)" />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Avatar URL <span className="text-slate-400 font-normal">(optional)</span></label>
          <input className={fieldClass} value={form.avatar} onChange={set('avatar')} placeholder="https://…" />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} disabled={busy}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={busy}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60">
            {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isEdit ? 'Save changes' : 'Add photographer'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default PhotographerModal;
