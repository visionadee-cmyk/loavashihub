import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';
import AppShell from '../components/AppShell';
import { demoMonthlySales, demoPaymentTypeBreakdown, demoProducts, demoExpenses } from '../data/demo';
import { loadCollection } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { Bill, Expense } from '../types';

const colors = ['#8b5cf6', '#38bdf8', '#f97316'];

function monthKey(dateString: string) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

export default function ReportsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    loadCollection<Bill>('bills', [])
      .then((items) => setBills(items))
      .catch(() => undefined);
    loadCollection<Expense>('expenses', [])
      .then((items) => setExpenses(items))
      .catch(() => undefined);
  }, []);

  const totalSales = useMemo(
    () => bills.reduce((sum, bill) => sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0), 0),
    [bills],
  );

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses],
  );

  const profit = totalSales - totalExpenses;

  const exportXlsx = () => {
    const sheet = utils.json_to_sheet([
      { Label: 'Total sales', Value: totalSales },
      { Label: 'Total expenses', Value: totalExpenses },
      { Label: 'Profit', Value: profit },
    ]);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, sheet, 'Summary');
    const data = write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([data], { type: 'application/octet-stream' }), 'loavashi-reports.xlsx');
  };

  const revenueByMonth = useMemo(() => {
    if (!bills.length) {
      return demoMonthlySales.map((item) => ({ name: item.day, revenue: item.amount }));
    }

    const grouped = bills.reduce<Record<string, number>>((acc, bill) => {
      const key = monthKey(bill.createdAt);
      const amount = bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
      acc[key] = (acc[key] ?? 0) + amount;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, revenue]) => ({ name: formatMonthLabel(key), revenue }));
  }, [bills]);

  const paymentBreakdown = useMemo(() => {
    if (!bills.length) return demoPaymentTypeBreakdown;

    const counts = bills.reduce<Record<string, number>>((acc, bill) => {
      acc[bill.paymentMethod] = (acc[bill.paymentMethod] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([method, value]) => ({ method, value }));
  }, [bills]);

  const topProducts = useMemo(() => {
    if (!bills.length) return demoProducts.slice(0, 4);

    const sales = bills.reduce<Record<string, { quantity: number; category?: string; price: number }>>((acc, bill) => {
      bill.items.forEach((item) => {
        const existing = acc[item.name];
        if (!existing) {
          acc[item.name] = { quantity: item.quantity, price: item.price };
        } else {
          existing.quantity += item.quantity;
        }
      });
      return acc;
    }, {});

    return Object.entries(sales)
      .sort(([, a], [, b]) => b.quantity - a.quantity)
      .slice(0, 4)
      .map(([name, data]) => ({ id: name, name, category: 'POS item', price: data.price, quantity: data.quantity }));
  }, [bills]);

  const weeklyExpenses = useMemo(() => {
    if (expenses.length) return expenses;
    return demoExpenses;
  }, [expenses]);

  return (
    <AppShell title="Reports & analytics">
      <div className="space-y-8">
        <div className="grid gap-5 xl:grid-cols-3">
          {[
            { label: 'Total sales', value: formatMVR(totalSales || demoMonthlySales.reduce((total, item) => total + item.amount, 0)) },
            { label: 'Total expense', value: formatMVR(totalExpenses || demoExpenses.reduce((total, item) => total + item.amount, 0)) },
            { label: 'Profit', value: formatMVR((totalSales || demoMonthlySales.reduce((total, item) => total + item.amount, 0)) - (totalExpenses || demoExpenses.reduce((sum, item) => sum + item.amount, 0))) },
          ].map((card) => (
            <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{card.label}</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Monthly revenue</h3>
                <p className="text-sm text-slate-600">Comparison of sales across months.</p>
              </div>
              <button
                type="button"
                onClick={exportXlsx}
                className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Export Excel
              </button>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByMonth} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: '#475569' }} />
                  <YAxis tick={{ fill: '#475569' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: 16, border: '1px solid #cbd5e1', color: '#0f172a' }} />
                  <Bar dataKey="revenue" fill="#8b5cf6" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Payment types</h3>
            <p className="text-sm text-slate-600">Revenue distribution by method.</p>
            <div className="mt-8 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentBreakdown} dataKey="value" nameKey="method" innerRadius={48} outerRadius={88} paddingAngle={4}>
                    {paymentBreakdown.map((entry, index) => (
                      <Cell key={entry.method} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Top selling products</h3>
            <div className="mt-6 grid gap-4">
              {topProducts.map((product) => (
                <div key={product.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">{product.name}</p>
                      <p className="text-sm text-slate-500">{product.category || 'POS item'}</p>
                    </div>
                    <p className="text-sm font-semibold text-violet-600">{formatMVR(product.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Expense summary</h3>
            <p className="text-sm text-slate-600">Daily and monthly costs broken down.</p>
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Daily expense</span>
                  <span className="font-semibold text-slate-900">{formatMVR(weeklyExpenses.reduce((sum, item) => sum + item.amount, 0))}</span>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Monthly expense</span>
                  <span className="font-semibold text-slate-900">{formatMVR(weeklyExpenses.reduce((sum, item) => sum + item.amount, 0))}</span>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Profit</span>
                  <span className="font-semibold text-violet-600">{formatMVR(profit)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
