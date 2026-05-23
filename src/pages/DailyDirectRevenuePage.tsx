import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { CardPayment, DailyDirectRevenue } from '../types';

const initialCashCounts = {
  fiftyLari: 0,
  oneRf: 0,
  twoRf: 0,
  note5: 0,
  note10: 0,
  note20: 0,
  note50: 0,
  note100: 0,
  note500: 0,
  note1000: 0,
};

const initialCardPayment: CardPayment = {
  id: `card-${Date.now()}`,
  type: 'Card type 1',
  amount: 0,
};

function computeCashTotal(cash: typeof initialCashCounts) {
  return (
    cash.fiftyLari * 50 +
    cash.oneRf * 1 +
    cash.twoRf * 2 +
    cash.note5 * 5 +
    cash.note10 * 10 +
    cash.note20 * 20 +
    cash.note50 * 50 +
    cash.note100 * 100 +
    cash.note500 * 500 +
    cash.note1000 * 1000
  );
}

export default function DailyDirectRevenuePage() {
  const [entries, setEntries] = useState<DailyDirectRevenue[]>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    closedBy: '',
    cashCounts: { ...initialCashCounts },
    cardPayments: [initialCardPayment],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!hasFirebaseConfig) return;

    loadCollection<DailyDirectRevenue>('dailyDirectRevenue', [])
      .then((data) => {
        if (data.length) setEntries(data);
      })
      .catch((error) => console.error('Failed to load daily direct revenue:', error));
  }, []);

  const cashTotal = useMemo(() => computeCashTotal(form.cashCounts), [form.cashCounts]);
  const cardTotal = useMemo(
    () => form.cardPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0),
    [form.cardPayments],
  );
  const totalDirectRevenue = useMemo(() => cashTotal + cardTotal, [cashTotal, cardTotal]);

  const updateCashCount = (field: keyof typeof initialCashCounts, value: number) => {
    setForm((current) => ({
      ...current,
      cashCounts: { ...current.cashCounts, [field]: value },
    }));
  };

  const addCardPayment = () => {
    setForm((current) => ({
      ...current,
      cardPayments: [
        ...current.cardPayments,
        { id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: `Card type ${current.cardPayments.length + 1}`, amount: 0 },
      ],
    }));
  };

  const updateCardPayment = (id: string, field: keyof CardPayment, value: string | number) => {
    setForm((current) => ({
      ...current,
      cardPayments: current.cardPayments.map((payment) =>
        payment.id !== id ? payment : { ...payment, [field]: field === 'amount' ? Number(value) : value },
      ),
    }));
  };

  const removeCardPayment = (id: string) => {
    setForm((current) => ({
      ...current,
      cardPayments: current.cardPayments.filter((payment) => payment.id !== id),
    }));
  };

  const saveRevenue = async () => {
    if (!form.closedBy.trim() || totalDirectRevenue <= 0) return;

    const existingEntry = entries.find((entry) => entry.id === editingId);
    const payload: DailyDirectRevenue = {
      id: editingId ?? `directrev-${Date.now()}`,
      date: form.date,
      closedBy: form.closedBy.trim(),
      cashCounts: { ...form.cashCounts },
      cardPayments: form.cardPayments.filter((payment) => payment.amount > 0),
      cashTotal,
      cardTotal,
      totalDirectRevenue,
      createdAt: existingEntry?.createdAt ?? new Date().toISOString(),
    };

    setSaving(true);
    try {
      await saveDocument('dailyDirectRevenue', payload.id, payload);
      setEntries((current) => {
        if (editingId) {
          return current.map((entry) => (entry.id === editingId ? payload : entry));
        }
        return [payload, ...current];
      });
      setForm({
        date: new Date().toISOString().slice(0, 10),
        closedBy: '',
        cashCounts: { ...initialCashCounts },
        cardPayments: [initialCardPayment],
      });
      setEditingId(null);
    } catch (error) {
      console.error('Failed to save direct revenue entry:', error);
    } finally {
      setSaving(false);
    }
  };

  const beginEditEntry = (entry: DailyDirectRevenue) => {
    setEditingId(entry.id);
    setForm({
      date: entry.date,
      closedBy: entry.closedBy,
      cashCounts: { ...entry.cashCounts },
      cardPayments: entry.cardPayments.length ? entry.cardPayments : [initialCardPayment],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      closedBy: '',
      cashCounts: { ...initialCashCounts },
      cardPayments: [initialCardPayment],
    });
  };

  // Group entries by date and calculate daily totals
  const groupedEntries = useMemo(() => {
    const grouped: { [key: string]: DailyDirectRevenue[] } = {};
    const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    sortedEntries.forEach((entry) => {
      if (!grouped[entry.date]) {
        grouped[entry.date] = [];
      }
      grouped[entry.date].push(entry);
    });
    
    return grouped;
  }, [entries]);

  const deleteEntry = async (id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (!hasFirebaseConfig) return;

    try {
      await deleteDocument('dailyDirectRevenue', id);
    } catch (error) {
      console.error('Failed to delete direct revenue entry:', error);
    }
  };

  return (
    <AppShell title="Daily direct revenue">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Daily Direct Revenue</h3>
              <p className="text-sm text-slate-500">Record cash and card direct revenue separately for daily reporting.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="whitespace-nowrap inline-flex items-center gap-2 rounded-full bg-lime-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-lime-300 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="h-5 w-5" /> {showForm ? 'Cancel' : 'Add DDR'}
            </button>
          </div>

          {showForm && (
          <>
          <div className="mb-4 rounded-3xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">{editingId ? '✎ Editing Daily Revenue' : 'Adding New Daily Revenue Entry'}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-500">
              Date
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
              />
            </label>
            <label className="block text-sm text-slate-500">
              Cash counter closed by
              <input
                type="text"
                value={form.closedBy}
                onChange={(e) => setForm({ ...form, closedBy: e.target.value })}
                placeholder="Name"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
              />
            </label>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h4 className="text-lg font-semibold text-slate-900">Cash breakdown</h4>
            <p className="text-sm text-slate-500">Enter counts for coins and notes.</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Coins</p>
                {[
                  { label: '50 Lari coin', field: 'fiftyLari' as const },
                  { label: '1 RF coin', field: 'oneRf' as const },
                  { label: '2 RF coin', field: 'twoRf' as const },
                ].map((item) => (
                  <label key={item.field} className="block text-sm text-slate-500">
                    {item.label}
                    <input
                      type="number"
                      min={0}
                      value={form.cashCounts[item.field]}
                      onChange={(e) => updateCashCount(item.field, Number(e.target.value))}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Notes</p>
                {[
                  { label: '5', field: 'note5' as const },
                  { label: '10', field: 'note10' as const },
                  { label: '20', field: 'note20' as const },
                  { label: '50', field: 'note50' as const },
                  { label: '100', field: 'note100' as const },
                  { label: '500', field: 'note500' as const },
                  { label: '1000', field: 'note1000' as const },
                ].map((item) => (
                  <label key={item.field} className="block text-sm text-slate-500">
                    {item.label} MVR notes
                    <input
                      type="number"
                      min={0}
                      value={form.cashCounts[item.field]}
                      onChange={(e) => updateCashCount(item.field, Number(e.target.value))}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Card / other payments</h4>
                <p className="text-sm text-slate-500">Add one or more payment types.</p>
              </div>
              <button
                type="button"
                onClick={addCardPayment}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" /> Add payment type
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {form.cardPayments.map((payment) => (
                <div key={payment.id} className="grid gap-3 sm:grid-cols-[2fr_1fr_48px]">
                  <label className="block text-sm text-slate-500">
                    Payment type
                    <input
                      type="text"
                      value={payment.type}
                      onChange={(e) => updateCardPayment(payment.id, 'type', e.target.value)}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                  <label className="block text-sm text-slate-500">
                    Amount
                    <input
                      type="number"
                      min={0}
                      value={payment.amount}
                      onChange={(e) => updateCardPayment(payment.id, 'amount', Number(e.target.value))}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeCardPayment(payment.id)}
                    className="mt-8 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition"
                    aria-label="Remove payment type"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-sm text-slate-500">Cash total</p>
                <p className="mt-2 text-2xl font-semibold text-[#05093f]">{formatMVR(cashTotal)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-sm text-slate-500">Card total</p>
                <p className="mt-2 text-2xl font-semibold text-[#05093f]">{formatMVR(cardTotal)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-sm text-slate-500">Direct revenue</p>
                <p className="mt-2 text-2xl font-semibold text-[#7c4b2e]">{formatMVR(totalDirectRevenue)}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={saveRevenue}
                disabled={!form.closedBy.trim() || totalDirectRevenue <= 0 || saving}
                className="flex-1 rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingId ? 'Update Daily Revenue' : 'Save Daily Revenue'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </div>
          </>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Daily Revenue History</h3>
              <p className="text-sm text-slate-500">Review and manage all daily direct revenue entries.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#05093f]">
              {entries.length} entries
            </span>
          </div>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {entries.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No daily revenue entries have been saved yet.</p>
            ) : null}
            {Object.entries(groupedEntries).map(([date, dayEntries]) => {
              const dailyCashTotal = dayEntries.reduce((sum, e) => sum + e.cashTotal, 0);
              const dailyCardTotal = dayEntries.reduce((sum, e) => sum + e.cardTotal, 0);
              const dailyRevenue = dayEntries.reduce((sum, e) => sum + e.totalDirectRevenue, 0);
              const formattedDate = new Date(date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
              
              return (
                <div key={date} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
                    <div>
                      <p className="font-semibold text-slate-900">{formattedDate}</p>
                      <p className="text-xs text-slate-500">{dayEntries.length} entry(ies)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Daily Total</p>
                      <p className="text-lg font-bold text-emerald-600">{formatMVR(dailyRevenue)}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {dayEntries.map((entry) => (
                      <div key={entry.id} className="rounded-3xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">Closed by: {entry.closedBy}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                beginEditEntry(entry);
                                setShowForm(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-yellow-300"
                            >
                              <Edit3 className="h-3 w-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEntry(entry.id)}
                              className="inline-flex items-center gap-1 rounded-3xl bg-red-50 px-3 py-2 text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3 text-xs">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                            <p className="text-slate-500">Cash:</p>
                            <p className="font-semibold text-slate-900">{formatMVR(entry.cashTotal)}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                            <p className="text-slate-500">Card:</p>
                            <p className="font-semibold text-slate-900">{formatMVR(entry.cardTotal)}</p>
                          </div>
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-slate-500">Total:</p>
                            <p className="font-semibold text-emerald-700">{formatMVR(entry.totalDirectRevenue)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
