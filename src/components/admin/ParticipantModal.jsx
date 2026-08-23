import React, { useEffect, useState } from 'react';
import { UserPlus, RefreshCw, Save } from 'lucide-react';
import { api } from '../../api';
import { Modal, fieldClass, labelClass } from '../ui/Modal';
import { useToast } from '../ui/Toast';

const EMPTY = { name: '', regId: '', email: '', phone: '', avatar: '' };

// Add or edit a single attendee. Pass `participant` to edit, omit to create.
export function ParticipantModal({ open, onClose, eventId, participant, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(participant);

  useEffect(() => {
    if (open) {
      setForm(participant
        ? {
            name: participant.name || '', regId: participant.regId || '',
            email: participant.email || '', phone: participant.phone || '',
            avatar: participant.avatar || '',
          }
        : EMPTY);
    }
  }, [open, participant]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(), regId: form.regId.trim(), email: form.email.trim(),
        phone: form.phone.trim(), avatar: form.avatar.trim(),
      };
      if (isEdit) {
        await api.updateParticipant(participant.id, body);
        toast.success(`Updated ${body.name}.`);
      } else {
        await api.createParticipants(eventId, body);
        toast.success(`Added ${body.name} to the roster.`);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Could not save attendee.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isEdit ? 'Edit attendee' : 'Add attendee'}
      subtitle={isEdit ? participant?.name : 'Register a new attendee for this event.'}
      icon={UserPlus}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>Name</label>
            <input className={fieldClass} value={form.name} onChange={set('name')} placeholder="Alex Rivera" autoFocus required />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Registration ID</label>
            <input className={fieldClass} value={form.regId} onChange={set('regId')} placeholder="REG-0042" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>Email</label>
            <input type="email" className={fieldClass} value={form.email} onChange={set('email')} placeholder="alex@example.com" />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Phone</label>
            <input className={fieldClass} value={form.phone} onChange={set('phone')} placeholder="+1 555 0100" />
          </div>
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
            <span>{isEdit ? 'Save changes' : 'Add attendee'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ParticipantModal;
