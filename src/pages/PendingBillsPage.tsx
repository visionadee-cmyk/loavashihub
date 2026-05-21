import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import AppShell from '../components/AppShell';
import { loadCollection, saveDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { Bill } from '../types';

export default function PendingBillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCollection<Bill>('bills', [])
      .then((items) => setBills(items))
      .catch((error) => {
        console.error('Failed to load bills from Firestore:', error);
        setBills([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateBill = async (updatedBill: Bill) => {
    setBills((current) => current.map((bill) => (bill.id === updatedBill.id ? updatedBill : bill)));
    try {
      await saveDocument('bills', updatedBill.id, updatedBill);
    } catch (error) {
      console.error('Failed to update bill:', error);
    }
  };

  const openBills = useMemo(() => bills.filter((bill) => bill.status !== 'Served'), [bills]);
  const completedCount = useMemo(() => bills.filter((bill) => bill.status === 'Served').length, [bills]);

  return (
    <AppShell title="Pending bills">
      <div className="space-y-6">
        <div className="grid gap-5 xl:grid-cols-3">
          {[
            { label: 'Open bills', value: openBills.length, icon: Clock },
            { label: 'Completed bills', value: completedCount, icon: CheckCircle2 },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{metric.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
                  </div>
                  <Icon className="h-7 w-7 text-violet-300" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-slate-950/20">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Pending bills</h3>
              <p className="text-sm text-slate-400">View all open bills that still need completion.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-slate-400">Loading bills…</p>
          ) : openBills.length ? (
            <div className="space-y-4">
              {openBills.map((bill) => (
                <div key={bill.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{bill.billNumber ?? bill.title}</p>
                      <p className="text-sm text-slate-400">{bill.table} • {bill.orderType} • {new Date(bill.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{bill.status}</span>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{bill.paymentStatus}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {bill.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-3xl bg-slate-950 px-4 py-3 text-sm text-slate-200">
                        <span>{item.quantity} x {item.name}</span>
                        <span>{formatMVR(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-slate-400">
                      Total {formatMVR(bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}
                    </div>
                    <button
                      type="button"
                      onClick={() => updateBill({ ...bill, status: 'Served', paymentStatus: 'Paid' })}
                      className="rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
                    >
                      Mark served
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">No open bills available right now.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
