import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { Supplier, DirectPurchase } from '../types';

const defaultSupplierForm = {
  name: '',
  phone: '',
  email: '',
  notes: '',
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<DirectPurchase[]>([]);
  const [form, setForm] = useState(defaultSupplierForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setSuppliers([]);
      return;
    }

    loadCollection<Supplier>('suppliers', [])
      .then((items) => { if (items.length) setSuppliers(items); })
      .catch((error) => console.error('Failed to load suppliers:', error));
    
    loadCollection<DirectPurchase>('directPurchases', [])
      .then((items) => { if (items.length) setPurchases(items); })
      .catch((error) => console.error('Failed to load purchases:', error));
  }, []);

  const addSupplier = async () => {
    const name = form.name.trim();
    if (!name) return;

    const supplier: Supplier = {
      id: editingId ?? `supplier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      phone: form.phone.trim() || '',
      email: form.email.trim() || '',
      notes: form.notes.trim() || '',
      createdAt: new Date().toISOString(),
    };

    setSuppliers((current) => {
      if (editingId) {
        return current.map((item) => (item.id === editingId ? supplier : item));
      }
      return [supplier, ...current];
    });
    setForm(defaultSupplierForm);
    setEditingId(null);

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

  const startEditSupplier = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      phone: supplier.phone || '',
      email: supplier.email || '',
      notes: supplier.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(defaultSupplierForm);
  };

  // Calculate supplier statistics
  const supplierStats = useMemo(() => {
    const stats: {
      [key: string]: {
        totalValue: number;
        purchaseCount: number;
        items: Array<{ name: string; quantity: number; unitCost: number; totalCost: number }>;
        lastPurchaseDate: string;
      };
    } = {};

    purchases.forEach((purchase) => {
      if (!stats[purchase.shopName]) {
        stats[purchase.shopName] = {
          totalValue: 0,
          purchaseCount: 0,
          items: [],
          lastPurchaseDate: purchase.date,
        };
      }

      stats[purchase.shopName].totalValue += purchase.total;
      stats[purchase.shopName].purchaseCount += 1;

      purchase.items.forEach((item) => {
        stats[purchase.shopName].items.push({
          name: item.productName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
        });
      });

      // Update last purchase date
      if (new Date(purchase.date) > new Date(stats[purchase.shopName].lastPurchaseDate)) {
        stats[purchase.shopName].lastPurchaseDate = purchase.date;
      }
    });

    return stats;
  }, [purchases]);

  const toggleSupplierExpand = (supplierId: string) => {
    const newExpanded = new Set(expandedSuppliers);
    if (newExpanded.has(supplierId)) {
      newExpanded.delete(supplierId);
    } else {
      newExpanded.add(supplierId);
    }
    setExpandedSuppliers(newExpanded);
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
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-3xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'Add new supplier'}
            </button>
          </div>

          {!hasFirebaseConfig ? (
            <div className="rounded-3xl border border-amber-400 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
              Firebase is not configured. Suppliers will be stored only locally until Firebase settings are added.
            </div>
          ) : null}

          {showForm && (
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

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={addSupplier}
                disabled={!form.name.trim()}
                className="inline-flex items-center gap-2 rounded-3xl bg-[#43e311] px-4 py-3 text-sm font-semibold text-white hover:bg-[#37c211] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> {editingId ? 'Save supplier' : 'Add supplier'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-2 rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </div>
          )}
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
              suppliers.map((supplier) => {
                const stats = supplierStats[supplier.name];
                const isExpanded = expandedSuppliers.has(supplier.id);
                return (
                  <div key={supplier.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 overflow-hidden">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <p className="text-base font-semibold text-slate-900">{supplier.name}</p>
                        <p className="text-sm text-slate-600">{supplier.phone || 'No phone'} · {supplier.email || 'No email'}</p>
                        {supplier.notes ? <p className="mt-2 text-sm text-slate-500">{supplier.notes}</p> : null}
                        
                        {/* Purchase Stats */}
                        {stats && (
                          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                            <div className="rounded-lg bg-white border border-slate-200 p-2">
                              <p className="text-xs text-slate-500">Total Value</p>
                              <p className="text-sm font-bold text-emerald-600 mt-1">{formatMVR(stats.totalValue)}</p>
                            </div>
                            <div className="rounded-lg bg-white border border-slate-200 p-2">
                              <p className="text-xs text-slate-500">Purchases</p>
                              <p className="text-sm font-bold text-slate-900 mt-1">{stats.purchaseCount}</p>
                            </div>
                            <div className="rounded-lg bg-white border border-slate-200 p-2">
                              <p className="text-xs text-slate-500">Items</p>
                              <p className="text-sm font-bold text-slate-900 mt-1">{stats.items.length}</p>
                            </div>
                            <div className="rounded-lg bg-white border border-slate-200 p-2 hidden sm:block">
                              <p className="text-xs text-slate-500">Last Purchase</p>
                              <p className="text-xs font-semibold text-slate-900 mt-1">
                                {new Date(stats.lastPurchaseDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {stats && stats.items.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleSupplierExpand(supplier.id)}
                            className={`inline-flex items-center gap-1 rounded-3xl px-3 py-2 text-sm font-semibold transition ${
                              isExpanded
                                ? 'bg-blue-600 text-white hover:bg-blue-500'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            Items
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEditSupplier(supplier)}
                          className="inline-flex items-center gap-2 rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSupplier(supplier.id)}
                          className="inline-flex items-center gap-2 rounded-3xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500"
                        >
                          <Trash2 className="h-4 w-4" /> Remove
                        </button>
                      </div>
                    </div>

                    {/* Expanded Items List */}
                    {isExpanded && stats && stats.items.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <h5 className="text-sm font-semibold text-slate-900 mb-3">Purchase History</h5>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {stats.items.map((item, idx) => (
                            <div key={idx} className="rounded-lg bg-white border border-slate-200 p-3 text-xs">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-semibold text-slate-900 capitalize">{item.name}</p>
                                  <p className="text-slate-600 mt-1">
                                    Qty: {item.quantity} | Unit Cost: {formatMVR(item.unitCost)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-slate-900">{formatMVR(item.totalCost)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
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
