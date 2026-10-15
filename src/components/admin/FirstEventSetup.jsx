import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { EventModal } from './EventModal';

export function FirstEventSetup({ onEventsChanged }) {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let active = true;

    api.me()
      .then((user) => {
        if (active) setAdmin(user);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => { active = false; };
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await api.login(email.trim(), password);
      if (!response?.user) {
        throw new Error('Authentication did not return a user.');
      }
      setAdmin(response.user);
      setPassword('');
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const eventCreated = async () => {
    setModalOpen(false);
    try {
      await onEventsChanged();
    } catch (err) {
      setError(err.message || 'Unable to refresh events.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">
          Rubicon Event Setup
        </h1>

        {checking ? (
          <p className="mt-4 text-slate-500">Checking administrator session...</p>
        ) : admin ? (
          <>
            <p className="mt-4 text-slate-500">
              The backend is connected. No events exist yet.
              Create the first event to initialize this workspace.
            </p>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-6 w-full rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
            >
              Create First Event
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-slate-500">
              Sign in as an administrator to create the first event.
            </p>

            <form onSubmit={login} className="mt-6 space-y-4 text-left">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Administrator email"
                autoComplete="username"
                required
                className="w-full rounded-lg border border-slate-300 p-3"
              />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-slate-300 p-3"
              />

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Signing in...' : 'Admin Sign In'}
              </button>
            </form>
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}

        <a
          href="/"
          className="mt-6 inline-block text-sm text-indigo-600 hover:underline"
        >
          Return to participant view
        </a>
      </div>

      <EventModal
        open={Boolean(admin) && modalOpen}
        event={null}
        onClose={() => setModalOpen(false)}
        onSaved={eventCreated}
      />
    </div>
  );
}
