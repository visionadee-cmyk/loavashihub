import { useEffect, useState } from 'react';
import { Plus, Trash2, Pen } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import type { StaffMember } from '../types';

const defaultStaff: Partial<StaffMember> = {
  name: '',
  passport: '',
  designation: 'Cashier',
  doj: '',
  salary: 0,
  workPermit: '',
  visaExpiry: '',
  medicalExpiry: '',
};

export default function StaffManagement() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  useEffect(() => {
    if (!hasFirebaseConfig) {
      setStaffList([]);
      return;
    }

    loadCollection<StaffMember>('staff', [])
      .then((items) => {
        if (items.length) setStaffList(items);
      })
      .catch((error) => console.error('Failed to load staff from Firestore:', error));
  }, []);
  const [form, setForm] = useState<Partial<StaffMember>>(defaultStaff);
  const [editingId, setEditingId] = useState<string | null>(null);

  const saveStaff = () => {
    const payload: StaffMember = {
      id: editingId ?? `staff-${Date.now()}`,
      name: form.name || 'New staff',
      passport: form.passport || 'N/A',
      designation: form.designation || 'Staff',
      doj: form.doj || new Date().toISOString().slice(0, 10),
      salary: form.salary ?? 0,
      workPermit: form.workPermit || 'N/A',
      visaExpiry: form.visaExpiry || new Date().toISOString().slice(0, 10),
      medicalExpiry: form.medicalExpiry || new Date().toISOString().slice(0, 10),
    };
    if (editingId) {
      setStaffList((current) => current.map((staff) => (staff.id === editingId ? payload : staff)));
      setEditingId(null);
    } else {
      setStaffList((current) => [payload, ...current]);
    }

    if (hasFirebaseConfig) {
      saveDocument('staff', payload.id, payload).catch((error) => console.error('Failed to save staff:', error));
    }
    setForm(defaultStaff);
  };

  const editStaff = (staff: StaffMember) => {
    setEditingId(staff.id);
    setForm({ ...staff });
  };

  const deleteStaff = (id: string) => {
    setStaffList((current) => current.filter((staff) => staff.id !== id));
    if (hasFirebaseConfig) {
      deleteDocument('staff', id).catch((error) => console.error('Failed to delete staff:', error));
    }
  };

  return (
    <AppShell title="Staff management">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_0.95fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Manage staff profiles</h3>
              <p className="text-sm text-slate-400">Track passports, visas, salaries and renewals.</p>
            </div>
            <button
              onClick={saveStaff}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> Save staff
            </button>
          </div>

          <div className="grid gap-4">
            <label className="block text-sm text-slate-300">
              Full name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Designation
                <input
                  value={form.designation}
                  onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Passport number
                <input
                  value={form.passport}
                  onChange={(event) => setForm((current) => ({ ...current, passport: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Salary (MVR)
                <input
                  type="number"
                  value={form.salary}
                  onChange={(event) => setForm((current) => ({ ...current, salary: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Date of joining
                <input
                  type="date"
                  value={form.doj}
                  onChange={(event) => setForm((current) => ({ ...current, doj: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Work permit
                <input
                  value={form.workPermit}
                  onChange={(event) => setForm((current) => ({ ...current, workPermit: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Visa expiry
                <input
                  type="date"
                  value={form.visaExpiry}
                  onChange={(event) => setForm((current) => ({ ...current, visaExpiry: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
            </div>
            <label className="block text-sm text-slate-300">
              Medical expiry
              <input
                type="date"
                value={form.medicalExpiry}
                onChange={(event) => setForm((current) => ({ ...current, medicalExpiry: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              />
            </label>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Staff roster</h3>
                <p className="text-sm text-slate-400">Monitor visa expiry and renewals.</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{staffList.length} members</span>
            </div>
            <div className="space-y-4">
              {staffList.map((staff) => (
                <div key={staff.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{staff.name}</p>
                      <p className="text-sm text-slate-400">{staff.designation} • {staff.passport}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => editStaff(staff)} className="rounded-2xl bg-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-700">
                        <Pen className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteStaff(staff.id)} className="rounded-2xl bg-rose-600 px-3 py-2 text-white hover:bg-rose-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-slate-400">
                    <span>DOJ: {staff.doj}</span>
                    <span>Salary: MVR {staff.salary.toLocaleString()}</span>
                    <span>Visa expiry: {staff.visaExpiry}</span>
                    <span>Medical expiry: {staff.medicalExpiry}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
