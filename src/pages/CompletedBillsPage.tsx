import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import AppShell from '../components/AppShell';
import { loadCollection } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { Bill } from '../types';

export default function CompletedBillsPage() {
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

  const completedBills = useMemo(() => bills.filter((bill) => bill.status === 'Served'), [bills]);
  const openCount = useMemo(() => bills.filter((bill) => bill.status !== 'Served').length, [bills]);

  return (
    <AppShell title="Completed bills">
      <div className="space-y-6">
        <div className="grid gap-5 xl:grid-cols-3">
          {[
            { label: 'Completed bills', value: completedBills.length, icon: CheckCircle2 },
            { label: 'Open bills', value: openCount, icon: Clock },
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
              <h3 className="text-lg font-semibold text-white">Completed bills</h3>
              <p className="text-sm text-slate-400">Review all paid and served invoices.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-slate-400">Loading bills…</p>
          ) : completedBills.length ? (
            <div className="space-y-4">
              {completedBills.map((bill) => (
                <div key={bill.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{bill.billNumber ?? bill.title}</p>
                      <p className="text-sm text-slate-400">{bill.table} • {bill.orderType} • {new Date(bill.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">{bill.status}</span>
                      <span className="rounded-full bg-emerald-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">{bill.paymentStatus}</span>
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
                  <div className="mt-4 text-right text-slate-400">
                    <div>Total {formatMVR(bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">No completed bills available yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
