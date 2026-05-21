import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, ListChecks } from 'lucide-react';
import AppShell from '../components/AppShell';
import { loadCollection, saveDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { Bill } from '../types';

export default function BillManagement() {
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

  const updateBill = async (bill: Bill) => {
    setBills((current) => current.map((entry) => (entry.id === bill.id ? bill : entry)));
    try {
      await saveDocument('bills', bill.id, bill);
    } catch (error) {
      console.error('Failed to update bill:', error);
    }
  };

  const totalBills = bills.length;
  const completedBills = bills.filter((bill) => bill.status === 'Served').length;
  const unpaidBills = bills.filter((bill) => bill.paymentStatus !== 'Paid').length;

  const openBills = bills.filter((bill) => bill.status !== 'Served');
  const completedBillList = bills.filter((bill) => bill.status === 'Served');

  const billTotals = useMemo(
    () => bills.map((bill) => ({
      ...bill,
      total: bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    })),
    [bills],
  );

  return (
    <AppShell title="Bills management">
      <div className="space-y-6">
        <div className="grid gap-5 xl:grid-cols-3">
          {[
            { label: 'Total bills', value: totalBills, icon: ListChecks },
            { label: 'Completed bills', value: completedBills, icon: CheckCircle2 },
            { label: 'Unpaid bills', value: unpaidBills, icon: Clock },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-slate-950/20">
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

        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Recent bills</h3>
              <p className="text-sm text-slate-400">Review and manage POS invoices.</p>
            </div>
          </div>
          {loading ? (
            <p className="text-slate-400">Loading bills…</p>
          ) : billTotals.length ? (
            <div className="space-y-6">
              {openBills.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-lg font-semibold text-white">Open bills</h4>
                    <span className="text-sm text-slate-400">Bills awaiting completion</span>
                  </div>
                  {openBills.map((bill) => (
                    <div key={bill.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{bill.billNumber ?? bill.title}</p>
                          <p className="text-sm text-slate-400">{bill.table} • {bill.orderType} • {bill.createdAt.slice(0, 10)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{bill.status}</span>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{bill.paymentStatus}</span>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <div className="space-y-2">
                          {bill.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between rounded-3xl bg-slate-900 px-4 py-3 text-sm text-slate-200">
                              <span>{item.quantity} x {item.name}</span>
                              <span>{formatMVR(item.price * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3 text-right">
                          <p className="text-sm text-slate-400">Total</p>
                          <p className="text-xl font-semibold text-white">
                            {formatMVR(bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}
                          </p>
                          <button
                            type="button"
                            onClick={() => updateBill({ ...bill, status: 'Served', paymentStatus: 'Paid' })}
                            className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
                          >
                            Mark served
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {completedBillList.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-lg font-semibold text-white">Completed bills</h4>
                    <span className="text-sm text-slate-400">Paid and served invoices</span>
                  </div>
                  {completedBillList.map((bill) => (
                    <div key={bill.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{bill.billNumber ?? bill.title}</p>
                          <p className="text-sm text-slate-400">{bill.table} • {bill.orderType} • {bill.createdAt.slice(0, 10)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">{bill.status}</span>
                          <span className="rounded-full bg-emerald-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">{bill.paymentStatus}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">Total</p>
                        <p className="text-xl font-semibold text-white">
                          {formatMVR(bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400">No bills available. Create a new bill from POS to populate sales data.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
