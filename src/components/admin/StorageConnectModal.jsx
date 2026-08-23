import React from 'react';
import { HardDrive, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { api } from '../../api';
import { Modal } from '../ui/Modal';

// Confirm dialog for connecting / switching an event's Google Drive storage
// account. The primary action is a full-page redirect into the server OAuth
// flow (api.driveConnectUrl) — the callback bounces back to the SPA — so there
// is no async submit here.
export function StorageConnectModal({ open, onClose, event, connected = false, currentEmail = '' }) {
  const isSwitch = connected;

  const go = () => {
    if (!event?.id) return;
    window.location = api.driveConnectUrl(event.id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isSwitch ? 'Switch Google Drive account' : 'Connect Google Drive'}
      subtitle={event?.name}
      icon={HardDrive}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          You'll be sent to Google to sign in and grant Rubicon access to a folder it
          creates in that account's Drive. New photos uploaded to{' '}
          <span className="font-bold text-slate-900">{event?.name}</span> will be stored there.
        </p>

        {isSwitch && (
          <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <ArrowUpRight className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              New uploads will go to the new account. Photos already uploaded
              {currentEmail ? ` to ${currentEmail}` : ''} stay on the current account and keep
              loading — nothing is moved or deleted.
            </div>
          </div>
        )}

        <div className="flex gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <div>
            Least-privilege access: Rubicon can only see the files it creates, not the rest of
            your Drive.
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={go}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>{isSwitch ? 'Continue to Google' : 'Connect account'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default StorageConnectModal;
