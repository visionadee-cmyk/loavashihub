import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, ListChecks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { Bill } from '../types';

export default function BillManagement() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const deleteBill = async (id: string) => {
    setBills((current) => current.filter((bill) => bill.id !== id));
    try {
      await deleteDocument('bills', id);
    } catch (error) {
      console.error('Failed to delete bill:', error);
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
              <div key={metric.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-[#05093f]">{metric.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-[#05093f]">{metric.value}</p>
                  </div>
                  <Icon className="h-7 w-7 text-violet-600" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#05093f]">Recent bills</h3>
              <p className="text-sm text-[#05093f]">Review and manage POS invoices.</p>
            </div>
          </div>
          {loading ? (
            <p className="text-[#05093f]">Loading bills…</p>
          ) : billTotals.length ? (
            <div className="space-y-6">
              {openBills.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-lg font-semibold text-[#05093f]">Open bills</h4>
                    <span className="text-sm text-[#05093f]">Bills awaiting completion</span>
                  </div>
                  {openBills.map((bill) => (
                    <div key={bill.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                      <p className="font-semibold text-[#05093f]">{bill.billNumber ?? bill.title}</p>
                      <p className="text-sm text-[#05093f]">{bill.table} • {bill.orderType} • {bill.createdAt.slice(0, 10)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#05093f]">{bill.status}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#05093f]">{bill.paymentStatus}</span>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <div className="space-y-2">
                          {bill.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between rounded-3xl bg-slate-100 px-4 py-3 text-sm text-[#05093f]">
                              <span>{item.quantity} x {item.name}</span>
                              <span>{formatMVR(item.price * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3 text-right">
                          <p className="text-sm text-[#05093f]">Total</p>
                          <p className="text-xl font-semibold text-[#05093f]">
                            {formatMVR(bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateBill({ ...bill, status: 'Served', paymentStatus: 'Paid' })}
                              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
                            >
                              Mark served
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/bills/${bill.id}`)}
                              className="inline-flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-[#05093f] hover:bg-slate-200"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteBill(bill.id)}
                              className="inline-flex items-center gap-2 rounded-3xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {completedBillList.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-lg font-semibold text-[#05093f]">Completed bills</h4>
                    <span className="text-sm text-[#05093f]">Paid and served invoices</span>
                  </div>
                  {completedBillList.map((bill) => (
                    <div key={bill.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#05093f]">{bill.billNumber ?? bill.title}</p>
                          <p className="text-sm text-[#05093f]">{bill.table} • {bill.orderType} • {bill.createdAt.slice(0, 10)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-700">{bill.status}</span>
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-700">{bill.paymentStatus}</span>
                        </div>
                      </div>
                      <div className="space-y-3 text-right">
                        <p className="text-sm text-[#05093f]">Total</p>
                        <p className="text-xl font-semibold text-[#05093f]">
                          {formatMVR(bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}
                        </p>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/bills/${bill.id}`)}
                            className="inline-flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-[#05093f] hover:bg-slate-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteBill(bill.id)}
                            className="inline-flex items-center gap-2 rounded-3xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[#05093f]">No bills available. Create a new bill from POS to populate sales data.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
