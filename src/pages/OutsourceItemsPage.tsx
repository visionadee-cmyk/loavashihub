import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { MenuItem, OutsourceItem } from '../types';

const initialForm = {
  date: new Date().toISOString().slice(0, 10),
  partyName: '',
  menuItemId: '',
  sellingPrice: 0,
  costPerPortion: 0,
  portions: 1,
  notes: '',
};

export default function OutsourceItemsPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [items, setItems] = useState<OutsourceItem[]>([]);
  const [partyNames, setPartyNames] = useState<string[]>([]);
  const [menuQuery, setMenuQuery] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!hasFirebaseConfig) return;

    Promise.all([
      loadCollection<MenuItem>('menuItems', []),
      loadCollection<OutsourceItem>('outsourceItems', []),
      loadCollection<{ id: string; name: string }>('partyNames', []),
    ])
      .then(([loadedMenuItems, loadedOutsourceItems, loadedPartyNames]) => {
        if (loadedMenuItems.length) setMenuItems(loadedMenuItems);
        if (loadedOutsourceItems.length) setItems(loadedOutsourceItems.sort((a, b) => b.date.localeCompare(a.date)));
        // populate party names from collection and also fallback to existing outsource items
        if (Array.isArray(loadedPartyNames) && loadedPartyNames.length) {
          setPartyNames(Array.from(new Set(loadedPartyNames.map((p) => p.name))));
        } else {
          setPartyNames(Array.from(new Set(loadedOutsourceItems.map((it: OutsourceItem) => it.partyName))));
        }
      })
      .catch((error) => console.error('Failed to load outsource items or menu items:', error));
  }, []);

  const selectedMenuItem = menuItems.find((item) => item.id === form.menuItemId);

  const totalOutsourceRevenue = useMemo(
    () => items.reduce((sum, item) => sum + item.totalRevenue, 0),
    [items],
  );

  const totalOutsourceCost = useMemo(
    () => items.reduce((sum, item) => sum + item.totalCost, 0),
    [items],
  );

  const totalOutsourceProfit = useMemo(
    () => items.reduce((sum, item) => sum + item.profit, 0),
    [items],
  );

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleSelectMenuItem = (menuItemId: string) => {
    const selected = menuItems.find((item) => item.id === menuItemId);
    setForm((current) => ({
      ...current,
      menuItemId,
      sellingPrice: selected?.price ?? current.sellingPrice,
      costPerPortion: selected?.costPrice ?? current.costPerPortion,
    }));
    setMenuQuery(selected?.name ?? '');
  };

  const saveOutsourceItem = async () => {
    if (!form.partyName.trim() || !form.menuItemId || form.portions <= 0 || form.costPerPortion < 0 || form.sellingPrice < 0) {
      return;
    }

    const selected = menuItems.find((item) => item.id === form.menuItemId);
    const payload: OutsourceItem = {
      id: editingId ?? `outsource-${Date.now()}`,
      date: form.date,
      partyName: form.partyName.trim(),
      menuItemId: form.menuItemId,
      menuItemName: selected?.name ?? 'Unknown item',
      sellingPrice: form.sellingPrice,
      costPerPortion: form.costPerPortion,
      portions: form.portions,
      totalCost: Number((form.costPerPortion * form.portions).toFixed(2)),
      totalRevenue: Number((form.sellingPrice * form.portions).toFixed(2)),
      profit: Number(((form.sellingPrice - form.costPerPortion) * form.portions).toFixed(2)),
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    setItems((current) => {
      if (editingId) {
        return current.map((item) => (item.id === editingId ? payload : item));
      }
      return [payload, ...current];
    });

    if (hasFirebaseConfig) {
      try {
        await saveDocument('outsourceItems', payload.id, payload);
        // ensure party name saved for future quick select
        const existing = partyNames.find((p) => p.toLowerCase() === payload.partyName.toLowerCase());
        if (!existing) {
          const partyId = `party-${Date.now()}`;
          try {
            await saveDocument('partyNames', partyId, { id: partyId, name: payload.partyName, createdAt: new Date().toISOString() });
            setPartyNames((curr) => Array.from(new Set([payload.partyName, ...curr])));
          } catch (err) {
            // non-fatal
            console.error('Failed to save party name:', err);
          }
        }
      } catch (error) {
        console.error('Failed to save outsource item:', error);
      }
    }

    resetForm();
    setShowForm(false);
  };

  const beginEdit = (item: OutsourceItem) => {
    setEditingId(item.id);
    setForm({
      date: item.date,
      partyName: item.partyName,
      menuItemId: item.menuItemId,
      sellingPrice: item.sellingPrice,
      costPerPortion: item.costPerPortion,
      portions: item.portions,
      notes: item.notes || '',
    });
    setShowForm(true);
  };

  const deleteOutsourceItem = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    if (hasFirebaseConfig) {
      try {
        await deleteDocument('outsourceItems', id);
      } catch (error) {
        console.error('Failed to delete outsource item:', error);
      }
    }
  };

  return (
    <AppShell title="Outsource Items">
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-3">
          {[
            { label: 'Outsource Revenue', value: formatMVR(totalOutsourceRevenue) },
            { label: 'Outsource Cost', value: formatMVR(totalOutsourceCost) },
            { label: 'Total Outsource Profit', value: formatMVR(totalOutsourceProfit) },
          ].map((card) => (
            <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{card.label}</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Outsource item entry</h3>
              <p className="text-sm text-slate-500">Create party-based outsource records with automatic selling price and profit tracking.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm((current) => !current);
                if (showForm) resetForm();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" /> {showForm ? 'Close form' : 'Add outsource item'}
            </button>
          </div>

          {showForm && (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Party name
                  <input
                    type="text"
                    list="party-names"
                    value={form.partyName}
                    onChange={(e) => setForm({ ...form, partyName: e.target.value })}
                    placeholder="Party or event name"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                  <datalist id="party-names">
                    {partyNames.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </label>
                <label className="block text-sm text-slate-700">
                  Date
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <label className="block text-sm text-slate-700 relative">
                  Menu item
                  <input
                    type="text"
                    value={menuQuery}
                    onChange={(e) => setMenuQuery(e.target.value)}
                    placeholder="Search menu items by name"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                  {menuQuery && (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white">
                      {menuItems.filter((m) => m.name.toLowerCase().includes(menuQuery.toLowerCase())).slice(0, 10).map((m) => (
                        <li
                          key={m.id}
                          onClick={() => handleSelectMenuItem(m.id)}
                          className="cursor-pointer px-4 py-2 text-sm hover:bg-slate-100"
                        >
                          {m.name}
                        </li>
                      ))}
                      {menuItems.filter((m) => m.name.toLowerCase().includes(menuQuery.toLowerCase())).length === 0 && (
                        <li className="px-4 py-2 text-sm text-slate-500">No matching items</li>
                      )}
                    </ul>
                  )}
                </label>
                <label className="block text-sm text-slate-700">
                  Selling price per portion
                  <input
                    type="number"
                    value={form.sellingPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Cost price per portion
                  <input
                    type="number"
                    value={form.costPerPortion}
                    onChange={(e) => setForm({ ...form, costPerPortion: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <label className="block text-sm text-slate-700">
                  Number of portions
                  <input
                    type="number"
                    value={form.portions}
                    onChange={(e) => setForm({ ...form, portions: Number(e.target.value) })}
                    min="1"
                    step="1"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Menu item name
                  <input
                    type="text"
                    value={selectedMenuItem?.name || ''}
                    disabled
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Notes (optional)
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Customer / party note"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Total revenue</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMVR(form.sellingPrice * form.portions)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Total cost</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMVR(form.costPerPortion * form.portions)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Projected profit</p>
                    <p className={`mt-2 text-2xl font-semibold ${form.sellingPrice - form.costPerPortion >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatMVR((form.sellingPrice - form.costPerPortion) * form.portions)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveOutsourceItem}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  <Plus className="h-4 w-4" /> {editingId ? 'Update Outsource' : 'Save Outsource'}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Outsource item history</h3>
              <p className="text-sm text-slate-500">Review or modify saved outsource records.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">{items.length} records</span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
              No outsource items yet. Add one to begin tracking party costs and profits.
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.partyName}</p>
                      <p className="text-sm text-slate-500">{item.date} · {item.menuItemName}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(item)}
                        className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-yellow-200"
                      >
                        <Edit3 className="h-4 w-4" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteOutsourceItem(item.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Portions</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{item.portions}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Revenue</p>
                      <p className="mt-2 text-lg font-semibold text-emerald-600">{formatMVR(item.totalRevenue)}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Profit</p>
                      <p className={`mt-2 text-lg font-semibold ${item.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMVR(item.profit)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
