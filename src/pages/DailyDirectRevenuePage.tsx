import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);

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

    const payload: DailyDirectRevenue = {
      id: `directrev-${Date.now()}`,
      date: form.date,
      closedBy: form.closedBy.trim(),
      cashCounts: { ...form.cashCounts },
      cardPayments: form.cardPayments.filter((payment) => payment.amount > 0),
      cashTotal,
      cardTotal,
      totalDirectRevenue,
      createdAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await saveDocument('dailyDirectRevenue', payload.id, payload);
      setEntries((current) => [payload, ...current]);
      setForm({
        date: new Date().toISOString().slice(0, 10),
        closedBy: '',
        cashCounts: { ...initialCashCounts },
        cardPayments: [initialCardPayment],
      });
    } catch (error) {
      console.error('Failed to save direct revenue entry:', error);
    } finally {
      setSaving(false);
    }
  };

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
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-900">Daily Direct Revenue</h3>
            <p className="text-sm text-slate-500">Record cash and card direct revenue separately for daily reporting.</p>
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
                className="inline-flex items-center gap-2 rounded-3xl bg-[#7c4b2e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#6a4028]"
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
                    className="mt-8 inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-rose-500 text-white hover:bg-rose-400"
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
            <button
              type="button"
              onClick={saveRevenue}
              disabled={!form.closedBy.trim() || totalDirectRevenue <= 0 || saving}
              className="mt-6 w-full rounded-3xl bg-[#7c4b2e] px-4 py-3 text-sm font-semibold text-white hover:bg-[#6a4028] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save daily direct revenue
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Saved direct revenue</h3>
              <p className="text-sm text-slate-500">Review daily direct revenue entries.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#05093f]">
              {entries.length} records
            </span>
          </div>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {entries.length > 0 ? (
              entries.map((entry) => (
                <div key={entry.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#05093f]">{entry.date}</p>
                      <p className="text-sm text-slate-500">Closed by {entry.closedBy}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry.id)}
                      className="inline-flex h-10 items-center justify-center rounded-3xl bg-rose-500 px-3 text-sm font-semibold text-white hover:bg-rose-400"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-slate-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Cash total</p>
                      <p className="mt-2 text-lg font-semibold text-[#05093f]">{formatMVR(entry.cashTotal)}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Card total</p>
                      <p className="mt-2 text-lg font-semibold text-[#05093f]">{formatMVR(entry.cardTotal)}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Direct revenue</p>
                      <p className="mt-2 text-lg font-semibold text-[#7c4b2e]">{formatMVR(entry.totalDirectRevenue)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No direct revenue entries have been saved yet.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
