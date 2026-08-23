import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// Reusable modal shell: fixed backdrop + centered panel + optional header/close.
// Matches the QR modal styling already used in the console.
export function Modal({ open, onClose, title, subtitle, icon: Icon, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={`bg-white rounded-3xl w-full ${maxWidth} shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col`}>
        {(title || Icon) && (
          <div className="flex items-start justify-between gap-3 p-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                {title && <h3 className="text-base font-extrabold text-slate-900 font-display truncate">{title}</h3>}
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        )}
        <div className="p-6 pt-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// Shared input styles so all admin forms look consistent.
export const fieldClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition';
export const labelClass = 'text-xs font-bold text-slate-700';

export default Modal;
