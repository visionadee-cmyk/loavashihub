import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, ChevronDown, ChevronRight, Search } from 'lucide-react';
import AppShell from '../components/AppShell';
import { loadCollection, deleteDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { Bill } from '../types';

export default function CompletedBillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

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
  const filteredBills = useMemo(() => {
    return completedBills.filter((bill) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const billName = (bill.billNumber ?? bill.title ?? '').toLowerCase();
      const tableName = bill.table.toLowerCase();
      const orderType = bill.orderType.toLowerCase();

      const matchesQuery =
        !normalizedQuery ||
        billName.includes(normalizedQuery) ||
        tableName.includes(normalizedQuery) ||
        orderType.includes(normalizedQuery);

      if (!matchesQuery) return false;

      const billDate = bill.createdAt.slice(0, 10);
      if (dateFrom && billDate < dateFrom) return false;
      if (dateTo && billDate > dateTo) return false;
      return true;
    });
  }, [completedBills, searchQuery, dateFrom, dateTo]);

  const groupedCompletedBills = useMemo(() => {
    const grouped: Record<string, Bill[]> = {};
    filteredBills.forEach((bill) => {
      const dateKey = bill.createdAt.slice(0, 10);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(bill);
    });
    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        bills: grouped[date].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }));
  }, [filteredBills]);

  const openCount = useMemo(() => bills.filter((bill) => bill.status !== 'Served').length, [bills]);
  const navigate = useNavigate();

  const toggleDateGroup = (date: string) => {
    setCollapsedDates((current) => ({ ...current, [date]: !current[date] }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

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
          <div className="mb-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#05093f]">Completed bills</h3>
              <p className="text-sm text-[#05093f]">Review all paid and served invoices with date filters, totals, and search.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-[1.6fr_1fr]">
              <label className="block text-sm text-slate-600">
                Search bills
                <div className="mt-2 flex items-center gap-2 rounded-3xl border border-slate-300 bg-white px-4 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Bill number, table, order type"
                    className="w-full bg-transparent text-slate-900 outline-none"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-12 items-center justify-center rounded-3xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Clear filters
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm text-slate-600">
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
              />
            </label>
            <label className="block text-sm text-slate-600">
              To
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
              />
            </label>
            <div className="flex items-end gap-3">
              <div className="rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Showing {filteredBills.length} completed bill{filteredBills.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-[#05093f]">Loading bills…</p>
          ) : groupedCompletedBills.length ? (
            <div className="space-y-6">
              {groupedCompletedBills.map(({ date, bills: billsForDate }, index) => {
                const groupTotal = billsForDate.reduce((sum, bill) => sum + bill.items.reduce((acc, item) => acc + item.price * item.quantity, 0), 0);
                const isCollapsed = collapsedDates[date] ?? index > 0;
                return (
                  <div key={date} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm shadow-slate-300/10">
                    <button
                      type="button"
                      onClick={() => toggleDateGroup(date)}
                      className="flex w-full items-center justify-between gap-3 rounded-3xl bg-white px-4 py-3 text-left text-slate-900 shadow-sm"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-slate-500">
                          {billsForDate.length} bill{billsForDate.length === 1 ? '' : 's'} • Total {formatMVR(groupTotal)}
                        </p>
                      </div>
                      {isCollapsed ? <ChevronRight className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
                    </button>
                    {!isCollapsed ? (
                      <div className="mt-4 space-y-4">
                        {billsForDate.map((bill) => (
                          <div key={bill.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-300/10">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-[#05093f]">{bill.billNumber ?? bill.title}</p>
                                <p className="text-sm text-[#05093f]">{bill.table} • {bill.orderType} • {new Date(bill.createdAt).toLocaleTimeString()}</p>
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
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[#05093f]">No completed bills match your filters.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
