import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock } from 'lucide-react';
import AppShell from '../components/AppShell';
import { loadCollection, deleteDocument } from '../lib/firestore';
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
  const navigate = useNavigate();

  const deleteBill = async (id: string) => {
    setBills((current) => current.filter((bill) => bill.id !== id));
    try {
      await deleteDocument('bills', id);
    } catch (error) {
      console.error('Failed to delete bill:', error);
    }
  };

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
              <div key={metric.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-[#05093f]">{metric.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-[#05093f]">{metric.value}</p>
                  </div>
                  <Icon className="h-7 w-7 text-[#7c4b2e]" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#05093f]">Completed bills</h3>
              <p className="text-sm text-[#05093f]">Review all paid and served invoices.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-[#05093f]">Loading bills…</p>
          ) : completedBills.length ? (
            <div className="space-y-4">
              {completedBills.map((bill) => (
                <div key={bill.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-300/10">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#05093f]">{bill.billNumber ?? bill.title}</p>
                      <p className="text-sm text-[#05093f]">{bill.table} • {bill.orderType} • {new Date(bill.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#7c4b2e]/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#05093f]">{bill.status}</span>
                      <span className="rounded-full bg-[#7c4b2e]/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#05093f]">{bill.paymentStatus}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {bill.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-3xl bg-white px-4 py-2 text-sm text-[#05093f]">
                        <span>{item.quantity} x {item.name}</span>
                        <span>{formatMVR(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[#05093f]">
                    <div>Total {formatMVR(bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/bills/${bill.id}`)}
                        className="rounded-3xl border-2 border-green-700 bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteBill(bill.id)}
                        className="rounded-3xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#05093f]">No completed bills available yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
