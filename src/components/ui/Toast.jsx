import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// Lightweight toast system: <ToastProvider> holds the stack, useToast() pushes
// notifications, and <Toaster> (rendered by the provider) paints them.
const ToastContext = createContext(null);

let seq = 0;

const TONES = {
  success: { icon: CheckCircle2, ring: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', iconColor: 'text-emerald-600' },
  error: { icon: AlertTriangle, ring: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-800', iconColor: 'text-rose-600' },
  info: { icon: Info, ring: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-800', iconColor: 'text-indigo-600' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message, tone = 'info', ttl = 4000) => {
    const id = ++seq;
    setToasts((prev) => [...prev, { id, message, tone }]);
    if (ttl) setTimeout(() => dismiss(id), ttl);
    return id;
  }, [dismiss]);

  const value = {
    toast: push,
    success: (m, ttl) => push(m, 'success', ttl),
    error: (m, ttl) => push(m, 'error', ttl ?? 6000),
    info: (m, ttl) => push(m, 'info', ttl),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail soft: if a component renders outside the provider, don't crash the app.
    return { toast: () => {}, success: () => {}, error: () => {}, info: () => {}, dismiss: () => {} };
  }
  return ctx;
}

function Toaster({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,360px)]">
      {toasts.map((t) => {
        const tone = TONES[t.tone] || TONES.info;
        const Icon = tone.icon;
        return (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${tone.ring} ${tone.bg} shadow-lg animate-[slideIn_0.15s_ease-out]`}
          >
            <Icon className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${tone.iconColor}`} />
            <span className={`text-xs font-semibold leading-relaxed flex-1 ${tone.text}`}>{t.message}</span>
            <button
              onClick={() => onDismiss(t.id)}
              className={`shrink-0 ${tone.iconColor} hover:opacity-70 transition-opacity cursor-pointer`}
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastProvider;
