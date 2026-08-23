import React, { useEffect, useState } from 'react';
import { UserCog, RefreshCw, Save } from 'lucide-react';
import { api } from '../../api';
import { Modal, fieldClass, labelClass } from '../ui/Modal';
import { useToast } from '../ui/Toast';

const EMPTY = { name: '', email: '', password: '', role: 'admin' };

// Add or edit a console user (admin / photographer login).
export function UserModal({ open, onClose, user, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(user);

  useEffect(() => {
    if (open) {
      setForm(user
        ? { name: user.name || '', email: user.email || '', password: '', role: user.role || 'admin' }
        : EMPTY);
    }
  }, [open, user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { toast.error('Name and email are required.'); return; }
    if (!isEdit && form.password.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    if (isEdit && form.password && form.password.length < 8) { toast.error('New password must be at least 8 characters.'); return; }
    setBusy(true);
    try {
      if (isEdit) {
        const body = { name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role };
        if (form.password) body.password = form.password;
        await api.updateUser(user.id, body);
        toast.success(`Updated ${body.name}.`);
      } else {
        await api.createUser({
          name: form.name.trim(), email: form.email.trim().toLowerCase(),
          password: form.password, role: form.role,
        });
        toast.success(`Created ${form.role} account for ${form.email.trim().toLowerCase()}.`);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Could not save user.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isEdit ? 'Edit user' : 'Add user'}
      subtitle={isEdit ? user?.email : 'Create a new console login.'}
      icon={UserCog}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label className={labelClass}>Name</label>
          <input className={fieldClass} value={form.name} onChange={set('name')} placeholder="Taylor Kim" autoFocus required />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Email</label>
          <input type="email" className={fieldClass} value={form.email} onChange={set('email')} placeholder="taylor@rubicon.io" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>Role</label>
            <select className={fieldClass} value={form.role} onChange={set('role')}>
              <option value="admin">Admin</option>
              <option value="photographer">Photographer</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>
              {isEdit ? 'New password' : 'Password'}
              {isEdit && <span className="text-slate-400 font-normal"> (optional)</span>}
            </label>
            <input type="password" className={fieldClass} value={form.password} onChange={set('password')}
              placeholder={isEdit ? 'Leave blank to keep' : 'Min. 8 characters'} autoComplete="new-password" />
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
            <span>{isEdit ? 'Save changes' : 'Add user'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default UserModal;
