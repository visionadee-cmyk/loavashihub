import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';
import AppShell from '../components/AppShell';
import { demoMonthlySales, demoPaymentTypeBreakdown, demoProducts, demoExpenses } from '../data/demo';
import { formatMVR } from '../lib/mvr';

const colors = ['#8b5cf6', '#38bdf8', '#f97316'];

export default function ReportsPage() {
  const totalSales = demoMonthlySales.reduce((total, item) => total + item.amount, 0);
  const totalExpenses = demoExpenses.reduce((total, item) => total + item.amount, 0);
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

  const revenueByMonth = demoMonthlySales.map((item) => ({ name: item.day, revenue: item.amount }));

  return (
    <AppShell title="Reports & analytics">
      <div className="space-y-8">
        <div className="grid gap-5 xl:grid-cols-3">
          {[
            { label: 'Total sales', value: formatMVR(totalSales) },
            { label: 'Total expense', value: formatMVR(totalExpenses) },
            { label: 'Profit', value: formatMVR(profit) },
          ].map((card) => (
            <div key={card.label} className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-slate-950/20">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{card.label}</p>
              <p className="mt-4 text-3xl font-semibold text-white">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Monthly revenue</h3>
                <p className="text-sm text-slate-400">Comparison of sales across months.</p>
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
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: 16, border: '1px solid #334155' }} />
                  <Bar dataKey="revenue" fill="#a78bfa" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-slate-950/20">
            <h3 className="text-lg font-semibold text-white">Payment types</h3>
            <p className="text-sm text-slate-400">Revenue distribution by method.</p>
            <div className="mt-8 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={demoPaymentTypeBreakdown} dataKey="value" nameKey="method" innerRadius={48} outerRadius={88} paddingAngle={4}>
                    {demoPaymentTypeBreakdown.map((entry, index) => (
                      <Cell key={entry.method} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-slate-950/20">
            <h3 className="text-lg font-semibold text-white">Top selling products</h3>
            <div className="mt-6 grid gap-4">
              {demoProducts.slice(0, 4).map((product) => (
                <div key={product.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">{product.name}</p>
                      <p className="text-sm text-slate-400">{product.category}</p>
                    </div>
                    <p className="text-sm font-semibold text-violet-300">{formatMVR(product.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-slate-950/20">
            <h3 className="text-lg font-semibold text-white">Expense summary</h3>
            <p className="text-sm text-slate-400">Daily and monthly costs broken down.</p>
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Daily expense</span>
                  <span className="font-semibold text-white">{formatMVR(demoExpenses.reduce((sum, item) => sum + item.amount, 0))}</span>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Monthly expense</span>
                  <span className="font-semibold text-white">{formatMVR(35000 + 92000 + 13200 + 8000)}</span>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Profit</span>
                  <span className="font-semibold text-violet-300">{formatMVR(profit)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
