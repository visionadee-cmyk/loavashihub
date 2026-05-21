import { useEffect, useMemo, useState } from 'react';
import { Plus, Pen, Trash2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import type { Customer } from '../types';

const defaultCustomer: Partial<Customer> = {
  name: '',
  phone: '',
  email: '',
  notes: '',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<Partial<Customer>>(defaultCustomer);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setCustomers([]);
      return;
    }

    loadCollection<Customer>('customers', [])
      .then((items) => {
        if (items.length) setCustomers(items);
      })
      .catch((error) => console.error('Failed to load customers from Firestore:', error));
  }, []);

  const saveCustomer = () => {
    const payload: Customer = {
      id: editingId ?? `customer-${Date.now()}`,
      name: form.name?.trim() || 'New customer',
      phone: form.phone?.trim() || 'N/A',
      email: form.email?.trim() || 'N/A',
      notes: form.notes?.trim() || '',
    };

    if (editingId) {
      setCustomers((current) => current.map((customer) => (customer.id === editingId ? payload : customer)));
      setEditingId(null);
    } else {
      setCustomers((current) => [payload, ...current]);
    }

    if (hasFirebaseConfig) {
      saveDocument('customers', payload.id, payload).catch((error) => console.error('Failed to save customer:', error));
    }

    setForm(defaultCustomer);
  };

  const editCustomer = (customer: Customer) => {
    setEditingId(customer.id);
    setForm(customer);
  };

  const removeCustomer = (id: string) => {
    setCustomers((current) => current.filter((customer) => customer.id !== id));
    if (hasFirebaseConfig) {
      deleteDocument('customers', id).catch((error) => console.error('Failed to remove customer:', error));
    }
  };

  const recentCustomers = useMemo(() => customers.slice(0, 8), [customers]);

  return (
    <AppShell title="Customers">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_0.85fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Customer directory</h3>
              <p className="text-sm text-slate-400">Store customer contacts and assign them to POS bills.</p>
            </div>
            <button
              type="button"
              onClick={saveCustomer}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> {editingId ? 'Update customer' : 'Add customer'}
            </button>
          </div>

          <div className="grid gap-4">
            <label className="block text-sm text-slate-300">
              Name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                placeholder="Customer name"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Phone
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  placeholder="+960 7XXXXXXX"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Email
                <input
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  placeholder="customer@example.com"
                />
              </label>
            </div>
            <label className="block text-sm text-slate-300">
              Notes
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="mt-2 h-28 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                placeholder="Allergies, preferences or loyalty info"
              />
            </label>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Recent customers</h3>
                <p className="text-sm text-slate-400">Quick access to your latest customer contacts.</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{customers.length} customers</span>
            </div>
            <div className="space-y-4">
              {recentCustomers.length ? (
                recentCustomers.map((customer) => (
                  <div key={customer.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{customer.name}</p>
                        <p className="text-sm text-slate-400">{customer.email} · {customer.phone}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editCustomer(customer)}
                          className="rounded-2xl bg-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-700"
                        >
                          <Pen className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCustomer(customer.id)}
                          className="rounded-2xl bg-rose-600 px-3 py-2 text-white hover:bg-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {customer.notes ? <p className="mt-3 text-sm text-slate-400">{customer.notes}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No customer records available yet. Add one to start assigning customers to POS orders.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
