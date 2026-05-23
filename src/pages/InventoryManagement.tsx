import { useState } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useInventory } from '../context/InventoryContext';
import type { InventoryItem } from '../types';
import { generateInventoryProductId, generateInventoryProductNumber } from '../lib/ids';

const defaultInventory: Partial<InventoryItem> = {
  productNumber: '',
  name: '',
  quantity: 0,
  unit: 'pcs',
  lowStock: 5,
};

export default function InventoryManagement() {
  const { inventory: items, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useInventory();
  const [form, setForm] = useState(defaultInventory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const saveItem = () => {
    const payload: InventoryItem = {
      id: editingId ?? `inventory-${Date.now()}`,
      productId: form.productId || generateInventoryProductId(),
      productNumber: form.productNumber || generateInventoryProductNumber(),
      name: form.name?.trim() || 'New stock',
      quantity: form.quantity ?? 0,
      unit: form.unit || 'pcs',
      lowStock: form.lowStock ?? 5,
    };
    if (editingId) {
      updateInventoryItem(payload);
      setEditingId(null);
    } else {
      addInventoryItem(payload);
    }
    setForm(defaultInventory);
    setShowForm(false);
  };

  const startEditing = (item: InventoryItem) => {
    setEditingId(item.id);
    setForm({ ...item });
    setShowForm(true);
  };

  const deleteItem = (id: string) => deleteInventoryItem(id);

  return (
    <AppShell title="Inventory management">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_0.95fr]">
        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Consumables tracking</h3>
              <p className="text-sm text-slate-600">Add consumables and low stock thresholds.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'Add stock'}
            </button>
          </div>

          {showForm && (
          <div className="grid gap-4">
            <label className="block text-sm text-slate-600">
              Item name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
              />
            </label>
            <label className="block text-sm text-slate-600">
              Product number
              <input
                value={form.productNumber}
                onChange={(event) => setForm((current) => ({ ...current, productNumber: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                placeholder="Optional product number"
              />
            </label>
            {form.productId ? (
              <div className="rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
                Inventory Product ID: <span className="font-semibold text-slate-900">{form.productId}</span>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-600">
                Quantity
                <input
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-600">
                Unit
                <input
                  value={form.unit}
                  onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
            </div>
            <label className="block text-sm text-slate-600">
              Low stock threshold
              <input
                type="number"
                min={0}
                value={form.lowStock}
                onChange={(event) => setForm((current) => ({ ...current, lowStock: Number(event.target.value) }))}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
              />
            </label>
            <button
              onClick={saveItem}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> {editingId ? 'Update stock' : 'Save stock'}
            </button>
          </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Consumables list</h3>
                <p className="text-sm text-slate-600">Track usage and identify low-stock consumables.</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{items.length} records</span>
            </div>
            <div className="grid gap-4">
              {items.map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-600">{item.quantity} {item.unit}</p>
                      <p className="text-sm text-slate-600">Product ID: {item.productId ?? item.id} • Product no: {item.productNumber ?? 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEditing(item)} className="rounded-2xl bg-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-700">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteItem(item.id)} className="rounded-2xl bg-rose-600 px-3 py-2 text-white hover:bg-rose-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Low stock threshold: {item.lowStock} {item.unit}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
