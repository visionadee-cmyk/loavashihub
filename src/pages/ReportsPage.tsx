import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, Filter, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import { loadCollection } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { Bill, DailyDirectRevenue, DirectPurchase, Expense } from '../types';

const colors = ['#7c4b2e', '#05093f', '#4c3929'];

function monthKey(dateString: string) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

interface CustomReportFilter {
  startDate: string;
  endDate: string;
  reportType: 'summary' | 'detailed' | 'comparison';
  includeMetrics: {
    sales: boolean;
    expenses: boolean;
    products: boolean;
    payments: boolean;
  };
}

export default function ReportsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [directPurchases, setDirectPurchases] = useState<DirectPurchase[]>([]);
  const [directRevenueEntries, setDirectRevenueEntries] = useState<DailyDirectRevenue[]>([]);
  const [showCustomReport, setShowCustomReport] = useState(false);
  const [customFilter, setCustomFilter] = useState<CustomReportFilter>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reportType: 'summary',
    includeMetrics: {
      sales: true,
      expenses: true,
      products: true,
      payments: true,
    },
  });

  useEffect(() => {
    loadCollection<Bill>('bills', [])
      .then((items) => setBills(items))
      .catch(() => undefined);
    loadCollection<Expense>('expenses', [])
      .then((items) => setExpenses(items))
      .catch(() => undefined);
    loadCollection<DirectPurchase>('directPurchases', [])
      .then((items) => setDirectPurchases(items))
      .catch(() => undefined);
    loadCollection<DailyDirectRevenue>('dailyDirectRevenue', [])
      .then((items) => setDirectRevenueEntries(items))
      .catch(() => undefined);
  }, []);

  const totalSales = useMemo(
    () => bills.reduce((sum, bill) => sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0), 0),
    [bills],
  );

  const directRevenueTotal = useMemo(
    () => directRevenueEntries.reduce((sum, entry) => sum + entry.totalDirectRevenue, 0),
    [directRevenueEntries],
  );

  const directPurchaseExpenses = useMemo(
    () => directPurchases.reduce((sum, purchase) => sum + purchase.total, 0),
    [directPurchases],
  );

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0) + directPurchaseExpenses,
    [expenses, directPurchaseExpenses],
  );

  const profit = totalSales - totalExpenses;

  // Additional statistics
  const totalTransactions = useMemo(() => bills.length, [bills]);

  const averageTransactionValue = useMemo(
    () => totalTransactions > 0 ? totalSales / totalTransactions : 0,
    [totalSales, totalTransactions],
  );

  const profitMargin = useMemo(
    () => totalSales > 0 ? (profit / totalSales) * 100 : 0,
    [profit, totalSales],
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  const dailySales = useMemo(
    () => bills
      .filter((bill) => bill.createdAt.slice(0, 10) === todayKey)
      .reduce((sum, bill) => sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0), 0),
    [bills, todayKey],
  );

  const dailyExpenses = useMemo(() => {
    const expenseTotal = expenses
      .filter((expense) => expense.date === todayKey)
      .reduce((sum, expense) => sum + expense.amount, 0);

    const directPurchaseTotal = directPurchases
      .filter((purchase) => purchase.date === todayKey)
      .reduce((sum, purchase) => sum + purchase.total, 0);

    return expenseTotal + directPurchaseTotal;
  }, [expenses, directPurchases, todayKey]);

  // Filtered data based on custom report filter
  const filteredBills = useMemo(
    () => bills.filter((bill) => bill.createdAt.slice(0, 10) >= customFilter.startDate && bill.createdAt.slice(0, 10) <= customFilter.endDate),
    [bills, customFilter.startDate, customFilter.endDate],
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((expense) => expense.date >= customFilter.startDate && expense.date <= customFilter.endDate),
    [expenses, customFilter.startDate, customFilter.endDate],
  );

  // Daily revenue data (including direct revenue)
  const dailyRevenueData = useMemo(() => {
    const grouped = filteredBills.reduce<Record<string, number>>((acc, bill) => {
      const date = bill.createdAt.slice(0, 10);
      const amount = bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
      acc[date] = (acc[date] ?? 0) + amount;
      return acc;
    }, {});

    // Add direct revenue entries
    const filteredDirectRevenue = directRevenueEntries.filter(
      (entry) => entry.date >= customFilter.startDate && entry.date <= customFilter.endDate,
    );
    filteredDirectRevenue.forEach((entry) => {
      grouped[entry.date] = (grouped[entry.date] ?? 0) + entry.totalDirectRevenue;
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }));
  }, [filteredBills, directRevenueEntries, customFilter.startDate, customFilter.endDate]);

  const exportXlsx = () => {
    const workbook = utils.book_new();

    // Summary sheet
    const summarySheet = utils.json_to_sheet([
      { Metric: 'Total Sales', Value: totalSales },
      { Metric: 'Direct Revenue', Value: directRevenueTotal },
      { Metric: 'Total Expenses', Value: totalExpenses },
      { Metric: 'Profit', Value: profit },
      { Metric: 'Profit Margin (%)', Value: profitMargin.toFixed(2) },
      { Metric: 'Total Transactions', Value: totalTransactions },
      { Metric: 'Average Transaction Value', Value: averageTransactionValue.toFixed(2) },
    ]);
    utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Daily revenue sheet
    const dailyRevenueSheet = utils.json_to_sheet(
      dailyRevenueData.map((item) => ({ Date: item.date, Revenue: item.revenue })),
    );
    utils.book_append_sheet(workbook, dailyRevenueSheet, 'Daily Revenue');

    // Bills sheet
    const billsSheet = utils.json_to_sheet(
      filteredBills.map((bill) => {
        const billTotal = bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0) + bill.tax - bill.discount;
        return {
          Date: bill.createdAt,
          'Payment Method': bill.paymentMethod,
          Total: billTotal,
          Items: bill.items.length,
        };
      }),
    );
    utils.book_append_sheet(workbook, billsSheet, 'Bills');

    // Expenses sheet
    const expensesSheet = utils.json_to_sheet(
      filteredExpenses.map((expense) => ({
        Date: expense.date,
        Category: expense.category,
        Amount: expense.amount,
        Title: expense.title,
      })),
    );
    utils.book_append_sheet(workbook, expensesSheet, 'Expenses');

    const data = write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([data], { type: 'application/octet-stream' }),
      `loavashi-reports-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const exportPDF = async () => {
    const element = document.getElementById('pdf-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      const imgWidth = 210; // A4 width
      const pageHeight = 297; // A4 height
      let heightLeft = canvas.height * (imgWidth / canvas.width);
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, heightLeft);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - canvas.height * (imgWidth / canvas.width);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, heightLeft);
        heightLeft -= pageHeight;
      }

      pdf.save(`loavashi-reports-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      alert('Failed to export PDF');
    }
  };

  const revenueByMonth = useMemo(() => {
    if (!bills.length) {
      return [];
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
    if (!filteredBills.length) return [];

    const counts = filteredBills.reduce<Record<string, number>>((acc, bill) => {
      acc[bill.paymentMethod] = (acc[bill.paymentMethod] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([method, value]) => ({ method, value }));
  }, [filteredBills]);

  const topProducts = useMemo(() => {
    if (!filteredBills.length) return [];

    const sales = filteredBills.reduce<Record<string, { quantity: number; category?: string; price: number }>>((acc, bill) => {
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
      .slice(0, 5)
      .map(([name, data]) => ({ id: name, name, category: 'POS item', price: data.price, quantity: data.quantity }));
  }, [filteredBills]);

  const categoryRevenue = useMemo(() => {
    if (!filteredBills.length) return [];

    const grouped = filteredBills.reduce<Record<string, number>>((acc, bill) => {
      bill.items.forEach((item) => {
        acc['POS Items'] = (acc['POS Items'] ?? 0) + item.price * item.quantity;
      });
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([category, revenue]) => ({ name: category, value: revenue }))
      .sort((a, b) => b.value - a.value);
  }, [filteredBills]);

  return (
    <AppShell title="Reports & analytics">
      <div id="pdf-content" className="space-y-8">
        {/* Header with export buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-[#05093f]">Reports Dashboard</h2>
            <p className="text-sm text-[#7c4b2e]">Comprehensive business analytics and statistics</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowCustomReport(!showCustomReport)}
              className="inline-flex items-center gap-2 rounded-3xl border border-[#05093f] bg-white px-4 py-3 text-sm font-semibold text-[#05093f] hover:bg-slate-50"
            >
              <Filter size={16} />
              Custom Report
            </button>
            <button
              type="button"
              onClick={exportXlsx}
              className="inline-flex items-center gap-2 rounded-3xl bg-[#05093f] px-4 py-3 text-sm font-semibold text-white hover:bg-blue-900"
            >
              <Download size={16} />
              Excel
            </button>
            <button
              type="button"
              onClick={exportPDF}
              className="inline-flex items-center gap-2 rounded-3xl bg-[#7c4b2e] px-4 py-3 text-sm font-semibold text-white hover:bg-[#6a4028]"
            >
              <Download size={16} />
              PDF
            </button>
          </div>
        </div>

        {/* Custom Report Filter */}
        {showCustomReport && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Custom Report Builder</h3>
              <button
                type="button"
                onClick={() => setShowCustomReport(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Start Date</label>
                <input
                  type="date"
                  value={customFilter.startDate}
                  onChange={(e) =>
                    setCustomFilter({
                      ...customFilter,
                      startDate: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">End Date</label>
                <input
                  type="date"
                  value={customFilter.endDate}
                  onChange={(e) =>
                    setCustomFilter({
                      ...customFilter,
                      endDate: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Report Type</label>
                <select
                  value={customFilter.reportType}
                  onChange={(e) =>
                    setCustomFilter({
                      ...customFilter,
                      reportType: e.target.value as CustomReportFilter['reportType'],
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                >
                  <option value="summary">Summary</option>
                  <option value="detailed">Detailed</option>
                  <option value="comparison">Comparison</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Metrics</label>
                <div className="mt-1 space-y-2">
                  {Object.entries(customFilter.includeMetrics).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) =>
                          setCustomFilter({
                            ...customFilter,
                            includeMetrics: {
                              ...customFilter.includeMetrics,
                              [key]: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm capitalize text-slate-700">{key}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid gap-5 xl:grid-cols-4">
          {[
            { label: 'Daily Revenue', value: formatMVR(dailySales) },
            { label: 'Daily Expense', value: formatMVR(dailyExpenses) },
            { label: 'Transactions', value: totalTransactions.toString() },
            { label: 'Avg Transaction', value: formatMVR(averageTransactionValue) },
            { label: 'POS Revenue', value: formatMVR(totalSales) },
            { label: 'Direct Revenue', value: formatMVR(directRevenueTotal) },
            { label: 'Total Expense', value: formatMVR(totalExpenses) },
            { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%` },
            { label: 'Total Profit', value: formatMVR(profit) },
          ].map((card) => (
            <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
              <p className="text-sm uppercase tracking-[0.24em] text-[#05093f]">{card.label}</p>
              <p className="mt-4 text-3xl font-semibold text-[#05093f]">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Monthly Revenue Trend</h3>
            <p className="text-sm text-[#05093f]">Revenue comparison across months</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByMonth} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(5, 9, 63, 0.15)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(5, 9, 63, 0.7)' }} />
                  <YAxis tick={{ fill: 'rgba(5, 9, 63, 0.7)' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: 16, border: '1px solid rgba(5, 9, 63, 0.2)', color: '#05093f' }}
                  />
                  <Bar dataKey="revenue" fill="#7c4b2e" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Daily Revenue</h3>
            <p className="text-sm text-[#05093f]">Revenue trend for selected period</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenueData} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(5, 9, 63, 0.15)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(5, 9, 63, 0.7)' }} />
                  <YAxis tick={{ fill: 'rgba(5, 9, 63, 0.7)' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: 16, border: '1px solid rgba(5, 9, 63, 0.2)', color: '#05093f' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#05093f" strokeWidth={2} dot={{ fill: '#7c4b2e', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Payment Methods</h3>
            <p className="text-sm text-[#05093f]">Revenue distribution</p>
            <div className="mt-4 h-72">
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

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Category Revenue</h3>
            <p className="text-sm text-[#05093f]">Revenue by category</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryRevenue} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88} paddingAngle={4}>
                    {categoryRevenue.map((entry, index) => (
                      <Cell key={entry.name} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Products & Category Breakdown */}
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Top Selling Products</h3>
            <p className="text-sm text-[#05093f]">Best performing items</p>
            <div className="mt-6 space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7c4b2e] text-xs font-bold text-white">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-[#05093f]">Qty: {product.quantity}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-[#05093f]">{formatMVR(product.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Category Breakdown</h3>
            <p className="text-sm text-[#05093f]">Revenue by category</p>
            <div className="mt-6 space-y-3">
              {categoryRevenue.map((category, index) => (
                <div key={category.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                      <p className="font-medium text-slate-900">{category.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#05093f]">{formatMVR(category.value)}</p>
                      <p className="text-xs text-[#7c4b2e]">{((category.value / totalSales) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-[#05093f] to-blue-900 p-6 text-white shadow-sm">
            <h3 className="text-sm font-semibold opacity-80">FINANCIAL SUMMARY</h3>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Revenue</span>
                <span className="text-2xl font-bold">{formatMVR(totalSales + directRevenueTotal)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/20 pt-4">
                <span className="text-sm">Total Expenses</span>
                <span className="text-2xl font-bold">{formatMVR(totalExpenses)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/20 pt-4">
                <span className="text-sm">Net Profit</span>
                <span className="text-2xl font-bold text-green-300">{formatMVR(profit + directRevenueTotal)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-[#7c4b2e] to-amber-900 p-6 text-white shadow-sm">
            <h3 className="text-sm font-semibold opacity-80">TRANSACTION METRICS</h3>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Orders</span>
                <span className="text-2xl font-bold">{totalTransactions}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/20 pt-4">
                <span className="text-sm">Avg Order Value</span>
                <span className="text-2xl font-bold">{formatMVR(averageTransactionValue)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/20 pt-4">
                <span className="text-sm">Profit Margin</span>
                <span className="text-2xl font-bold text-green-300">{profitMargin.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-700 to-slate-900 p-6 text-white shadow-sm">
            <h3 className="text-sm font-semibold opacity-80">PERIOD COMPARISON</h3>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Period Start</span>
                <span className="font-mono text-sm">{customFilter.startDate}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/20 pt-4">
                <span className="text-sm">Period End</span>
                <span className="font-mono text-sm">{customFilter.endDate}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/20 pt-4">
                <span className="text-sm">Report Type</span>
                <span className="capitalize">{customFilter.reportType}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
