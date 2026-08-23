import React, { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Modal } from './Modal';

// Confirmation dialog for destructive actions. onConfirm may be async; the
// button shows a spinner while it runs and stays open if it throws (so the
// caller's toast can explain the failure).
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  tone = 'danger', // 'danger' | 'primary'
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm?.();
      onClose?.();
    } catch {
      // Leave the dialog open; the caller surfaces the error via toast.
    } finally {
      setBusy(false);
    }
  };

  const confirmClass =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700'
      : 'bg-indigo-600 hover:bg-indigo-700';

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} maxWidth="max-w-sm">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${tone === 'danger' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 font-display">{title}</h3>
            {message && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{message}</p>}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className={`px-4 py-2 ${confirmClass} text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60`}
          >
            {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{busy ? 'Working…' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
