import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import type { Supplier } from '../types';

const defaultSupplierForm = {
  name: '',
  phone: '',
  email: '',
  notes: '',
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState(defaultSupplierForm);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setSuppliers([]);
      return;
    }

    loadCollection<Supplier>('suppliers', [])
      .then((items) => { if (items.length) setSuppliers(items); })
      .catch((error) => console.error('Failed to load suppliers:', error));
  }, []);

  const addSupplier = async () => {
    const name = form.name.trim();
    if (!name) return;

    const supplier: Supplier = {
      id: `supplier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      phone: form.phone.trim() || '',
      email: form.email.trim() || '',
      notes: form.notes.trim() || '',
      createdAt: new Date().toISOString(),
    };

    setSuppliers((current) => [supplier, ...current]);
    setForm(defaultSupplierForm);

    if (hasFirebaseConfig) {
      try {
        await saveDocument('suppliers', supplier.id, supplier);
      } catch (error) {
        console.error('Failed to save supplier:', error);
      }
    }
  };

  const removeSupplier = async (id: string) => {
    setSuppliers((current) => current.filter((supplier) => supplier.id !== id));
    if (hasFirebaseConfig) {
      try {
        await deleteDocument('suppliers', id);
      } catch (error) {
        console.error('Failed to delete supplier:', error);
      }
    }
  };

  return (
    <AppShell title="Suppliers">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_0.85fr]">
        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Supplier directory</h3>
              <p className="text-sm text-slate-600">Manage supplier names and contact details for direct purchase workflows.</p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{suppliers.length} suppliers</span>
          </div>

          {!hasFirebaseConfig ? (
            <div className="rounded-3xl border border-amber-400 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
              Firebase is not configured. Suppliers will be stored only locally until Firebase settings are added.
            </div>
          ) : null}

          <div className="grid gap-4">
            <label className="block text-sm text-slate-600">
              Supplier name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                placeholder="Supplier or shop name"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-600">
                Phone
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                  placeholder="Optional phone"
                />
              </label>
              <label className="block text-sm text-slate-600">
                Email
                <input
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                  placeholder="Optional email"
                />
              </label>
            </div>

            <label className="block text-sm text-slate-600">
              Notes
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                placeholder="Add any supplier notes"
                rows={4}
              />
            </label>

            <button
              type="button"
              onClick={addSupplier}
              disabled={!form.name.trim()}
              className="inline-flex items-center gap-2 rounded-3xl bg-[#43e311] px-4 py-3 text-sm font-semibold text-white hover:bg-[#37c211] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add supplier
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Supplier list</h3>
              <p className="text-sm text-slate-600">Review and manage saved suppliers.</p>
            </div>
          </div>

          <div className="grid gap-4">
            {suppliers.length ? (
              suppliers.map((supplier) => (
                <div key={supplier.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{supplier.name}</p>
                      <p className="text-sm text-slate-600">{supplier.phone || 'No phone'} · {supplier.email || 'No email'}</p>
                      {supplier.notes ? <p className="mt-2 text-sm text-slate-500">{supplier.notes}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSupplier(supplier.id)}
                      className="inline-flex items-center gap-2 rounded-3xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500"
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                No suppliers saved yet. Add a supplier to track shops for direct purchases.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
