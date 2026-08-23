import React, { useMemo, useState } from 'react';
import { Users, RefreshCw, Upload } from 'lucide-react';
import { api } from '../../api';
import { Modal, labelClass } from '../ui/Modal';
import { useToast } from '../ui/Toast';

// Parse pasted rows: one attendee per line, columns separated by comma or tab,
// in the order: Name, RegID, Email, Phone. Only Name is required.
function parseRoster(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split(/[\t,]/).map((c) => c.trim());
      return { name: cols[0] || '', regId: cols[1] || '', email: cols[2] || '', phone: cols[3] || '' };
    })
    .filter((row) => row.name);
}

export function RosterImportModal({ open, onClose, eventId, onSaved }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseRoster(text), [text]);

  const submit = async () => {
    if (!parsed.length) { toast.error('Paste at least one attendee (Name required).'); return; }
    setBusy(true);
    try {
      const created = await api.createParticipants(eventId, parsed);
      const n = Array.isArray(created) ? created.length : parsed.length;
      toast.success(`Imported ${n} attendee${n === 1 ? '' : 's'}.`);
      setText('');
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Roster import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Import roster"
      subtitle="Paste attendees — one per line."
      icon={Users}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className={labelClass}>Rows (Name, RegID, Email, Phone)</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            autoFocus
            placeholder={'Alex Rivera, REG-001, alex@example.com, +1 555 0100\nSam Lee, REG-002, sam@example.com\nJordan Diaz'}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition resize-y"
          />
          <p className="text-[11px] text-slate-400">
            Separate columns with a comma or tab. Only the name is required — the rest are optional.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5">
          <span className="text-xs font-semibold text-slate-600">Ready to import</span>
          <span className="text-sm font-extrabold text-indigo-600">
            {parsed.length} attendee{parsed.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={busy}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy || !parsed.length}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60">
            {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{busy ? 'Importing…' : `Import ${parsed.length || ''}`.trim()}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default RosterImportModal;
