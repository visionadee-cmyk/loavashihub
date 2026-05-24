import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import type { TableItem, Bill } from '../types';

const defaultTable: Partial<TableItem> = {
  name: '',
  seats: 4,
  section: 'Indoor',
};

export default function TableManagement() {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  
  useEffect(() => {
    if (!hasFirebaseConfig) {
      setTables([]);
      setBills([]);
      return;
    }

    Promise.all([
      loadCollection<TableItem>('tables', []),
      loadCollection<Bill>('bills', []),
    ])
      .then(([loadedTables, loadedBills]) => {
        if (loadedTables.length) setTables(loadedTables);
        setBills(loadedBills);
      })
      .catch((error) => console.error('Failed to load tables/bills from Firestore:', error));
  }, []);
  const [form, setForm] = useState<Partial<TableItem>>(defaultTable);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const occupiedTableNames = useMemo(
    () => new Set(bills.filter((bill) => bill.status !== 'Served').map((bill) => bill.table)),
    [bills]
  );

  const submitTable = () => {
    const payload: TableItem = {
      id: editingId ?? `table-${Date.now()}`,
      name: form.name || `Table ${tables.length + 1}`,
      seats: form.seats ?? 1,
      section: form.section ?? 'Indoor',
    };

    if (editingId) {
      setTables((current) => current.map((table) => (table.id === editingId ? payload : table)));
      setEditingId(null);
    } else {
      setTables((current) => [...current, payload]);
    }

    if (hasFirebaseConfig) {
      saveDocument('tables', payload.id, payload).catch((error) => console.error('Failed to save table:', error));
    }
    setForm(defaultTable);
    setEditingId(null);
    setShowForm(false);
  };

  const beginEdit = (table: TableItem) => {
    setEditingId(table.id);
    setForm({ name: table.name, seats: table.seats, section: table.section });
    setShowForm(true);
  };

  const deleteTable = (id: string) => {
    setTables((current) => current.filter((table) => table.id !== id));
    if (hasFirebaseConfig) {
      deleteDocument('tables', id).catch((error) => console.error('Failed to delete table:', error));
    }
  };

  return (
    <AppShell title="Table management">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_0.95fr]">
        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Floor plan setup</h3>
              <p className="text-sm text-slate-600">Create new indoor, outdoor and VIP tables.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-3xl border-2 border-green-700 bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"
            >
              <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'Add new table'}
            </button>
          </div>

          {showForm && (
          <div className="grid gap-4">
            <label className="block text-sm text-slate-600">
              Table name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                placeholder="Table 7"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-600">
                Seats
                <input
                  type="number"
                  min={1}
                  value={form.seats}
                  onChange={(event) => setForm((current) => ({ ...current, seats: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-600">
                Section
                <select
                  value={form.section}
                  onChange={(event) => setForm((current) => ({ ...current, section: event.target.value as TableItem['section'] }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                >
                  <option value="Indoor">Indoor</option>
                  <option value="Outdoor">Outdoor</option>
                  <option value="VIP">VIP</option>
                </select>
              </label>
            </div>
            <button
              onClick={submitTable}
              className="inline-flex items-center gap-2 rounded-3xl border-2 border-green-700 bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"
            >
              <Plus className="h-4 w-4" /> {editingId ? 'Update table' : 'Add table'}
            </button>
          </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Live table map</h3>
                <p className="text-sm text-slate-600">Visual sections for dine-in and VIP seating. <span className="font-semibold text-green-600">{occupiedTableNames.size} occupied</span></p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{tables.length} tables</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {tables.map((table) => {
                const isOccupied = occupiedTableNames.has(table.name);
                return (
                  <div 
                    key={table.id} 
                    className={`rounded-3xl border-2 px-4 py-4 transition ${
                      isOccupied 
                        ? 'border-red-400 bg-red-50' 
                        : 'border-slate-200 bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{table.name}</p>
                        <p className="text-sm text-slate-600">{table.section} · {table.seats} seats</p>
                        {isOccupied && (
                          <p className="mt-2 text-sm font-semibold text-red-600">🔴 OCCUPIED</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => beginEdit(table)} className="rounded-2xl border-2 border-green-700 bg-green-600 px-3 py-2 text-white hover:bg-green-700">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteTable(table.id)} className="rounded-2xl bg-rose-600 px-3 py-2 text-white hover:bg-rose-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
