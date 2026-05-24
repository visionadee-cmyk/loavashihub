import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, Filter, X, Share2 } from 'lucide-react';
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
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(new Date().toISOString().slice(0, 10));
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

  // Daily Report Data
  const dailyReport = useMemo(() => {
    const dayStart = selectedDailyDate;

    // Get today's revenue from POS
    const dayBills = bills.filter((bill) => bill.createdAt.slice(0, 10) === dayStart);
    const posRevenue = dayBills.reduce((sum, bill) => sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0), 0);

    // Get today's direct revenue
    const dayDirectRevenue = directRevenueEntries.find((entry) => entry.date === dayStart);

    // Get today's expenses
    const dayExpenses = expenses
      .filter((expense) => expense.date === dayStart)
      .reduce((sum, expense) => sum + expense.amount, 0);

    // Get today's direct purchases
    const dayPurchases = directPurchases
      .filter((purchase) => purchase.date === dayStart)
      .reduce((sum, purchase) => sum + purchase.total, 0);

    const totalDayRevenue = posRevenue + (dayDirectRevenue?.totalDirectRevenue || 0);
    const totalDayExpenses = dayExpenses + dayPurchases;
    const dailyProfit = totalDayRevenue - totalDayExpenses;

    // Build cash breakdown
    const cashBreakdown = [];
    if (dayDirectRevenue) {
      const { cashCounts } = dayDirectRevenue;
      if (cashCounts.fiftyLari > 0) cashBreakdown.push({ denomination: '50 Laari', count: cashCounts.fiftyLari, amount: 0.5 * cashCounts.fiftyLari });
      if (cashCounts.oneRf > 0) cashBreakdown.push({ denomination: '1 Rf', count: cashCounts.oneRf, amount: 1 * cashCounts.oneRf });
      if (cashCounts.twoRf > 0) cashBreakdown.push({ denomination: '2 Rf', count: cashCounts.twoRf, amount: 2 * cashCounts.twoRf });
      if (cashCounts.note5 > 0) cashBreakdown.push({ denomination: '5 Note', count: cashCounts.note5, amount: 5 * cashCounts.note5 });
      if (cashCounts.note10 > 0) cashBreakdown.push({ denomination: '10 Note', count: cashCounts.note10, amount: 10 * cashCounts.note10 });
      if (cashCounts.note20 > 0) cashBreakdown.push({ denomination: '20 Note', count: cashCounts.note20, amount: 20 * cashCounts.note20 });
      if (cashCounts.note50 > 0) cashBreakdown.push({ denomination: '50 Note', count: cashCounts.note50, amount: 50 * cashCounts.note50 });
      if (cashCounts.note100 > 0) cashBreakdown.push({ denomination: '100 Note', count: cashCounts.note100, amount: 100 * cashCounts.note100 });
      if (cashCounts.note500 > 0) cashBreakdown.push({ denomination: '500 Note', count: cashCounts.note500, amount: 500 * cashCounts.note500 });
      if (cashCounts.note1000 > 0) cashBreakdown.push({ denomination: '1000 Note', count: cashCounts.note1000, amount: 1000 * cashCounts.note1000 });
    }

    return {
      date: dayStart,
      posRevenue,
      directRevenue: dayDirectRevenue?.totalDirectRevenue || 0,
      totalRevenue: totalDayRevenue,
      cashBreakdown,
      cardPayments: dayDirectRevenue?.cardPayments || [],
      totalCashDrawer: dayDirectRevenue?.cashTotal || 0,
      totalCardPayments: dayDirectRevenue?.cardTotal || 0,
      openingPettyCash: (dayDirectRevenue as any)?.openingPettyCash || 0,
      closingPettyCash: (dayDirectRevenue as any)?.closingPettyCash || 0,
      expenses: dayExpenses,
      purchases: dayPurchases,
      totalExpenses: totalDayExpenses,
      profit: dailyProfit,
    };
  }, [selectedDailyDate, bills, directRevenueEntries, expenses, directPurchases]);

  // Generate shareable report text
  const generateReportText = (): string => {
    const report = dailyReport;
    const dateObj = new Date(report.date);
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

    let text = `📊 *Loavashi Cafe - Daily Report*\n`;
    text += `📅 ${dateStr}\n\n`;

    text += `💰 *REVENUE*\n`;
    text += `POS Sales: ${formatMVR(report.posRevenue)}\n`;
    text += `Direct Revenue: ${formatMVR(report.directRevenue)}\n`;
    text += `━━━━━━━━━━━━━━━━\n`;
    text += `Total Revenue: ${formatMVR(report.totalRevenue)}\n\n`;

    if (report.cashBreakdown.length > 0) {
      text += `💵 *CASH DRAWER*\n`;
      report.cashBreakdown.forEach((item: any) => {
        text += `${item.denomination}: ${item.count} = ${formatMVR(item.amount)}\n`;
      });
      text += `Cash Total: ${formatMVR(report.totalCashDrawer)}\n\n`;
    }

    if (report.cardPayments.length > 0) {
      text += `💳 *PAYMENT CARD TYPES*\n`;
      report.cardPayments.forEach((payment: any) => {
        if (payment.amount > 0) {
          text += `${payment.type}: ${formatMVR(payment.amount)}\n`;
        }
      });
      text += `Card Total: ${formatMVR(report.totalCardPayments)}\n\n`;
    }

    text += `💰 *PETTY CASH (FLOAT)*\n`;
    text += `Opening: ${formatMVR(report.openingPettyCash)}\n`;
    text += `Closing: ${formatMVR(report.closingPettyCash)}\n`;
    text += `Difference: ${formatMVR(report.closingPettyCash - report.openingPettyCash)}\n\n`;

    text += `📋 *EXPENSES*\n`;
    text += `Daily Expenses: ${formatMVR(report.expenses)}\n`;
    text += `Direct Purchases: ${formatMVR(report.purchases)}\n`;
    text += `Total Expenses: ${formatMVR(report.totalExpenses)}\n\n`;

    text += `✅ *PROFIT/LOSS*\n`;
    text += `Net: ${formatMVR(report.profit)}\n`;
    text += `Margin: ${report.totalRevenue > 0 ? ((report.profit / report.totalRevenue) * 100).toFixed(1) : 0}%\n`;

    return text;
  };

  const shareToWhatsApp = () => {
    const reportText = generateReportText();
    const encodedText = encodeURIComponent(reportText);
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareToViber = () => {
    const reportText = generateReportText();
    const encodedText = encodeURIComponent(reportText);
    const viberUrl = `viber://send?text=${encodedText}`;
    window.location.href = viberUrl;
  };

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
    if (!bills.length && !directRevenueEntries.length) {
      return [];
    }

    const grouped = bills.reduce<Record<string, number>>((acc, bill) => {
      const key = monthKey(bill.createdAt);
      const amount = bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
      acc[key] = (acc[key] ?? 0) + amount;
      return acc;
    }, {});

    // Add direct revenue to monthly totals
    directRevenueEntries.forEach((entry) => {
      const key = monthKey(entry.date);
      grouped[key] = (grouped[key] ?? 0) + entry.totalDirectRevenue;
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, revenue]) => ({ name: formatMonthLabel(key), revenue }));
  }, [bills, directRevenueEntries]);

  const paymentBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};

    // Add POS payment methods
    filteredBills.forEach((bill) => {
      counts[bill.paymentMethod] = (counts[bill.paymentMethod] ?? 0) + 1;
    });

    // Add direct revenue card payment types
    const filteredDirectRevenue = directRevenueEntries.filter(
      (entry) => entry.date >= customFilter.startDate && entry.date <= customFilter.endDate,
    );
    filteredDirectRevenue.forEach((entry) => {
      entry.cardPayments.forEach((payment) => {
        if (payment.amount > 0) {
          counts[payment.type] = (counts[payment.type] ?? 0) + 1;
        }
      });
    });

    return Object.entries(counts).map(([method, value]) => ({ method, value }));
  }, [filteredBills, directRevenueEntries, customFilter.startDate, customFilter.endDate]);

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
    const grouped: Record<string, number> = {};

    // Add POS items revenue
    filteredBills.forEach((bill) => {
      bill.items.forEach((item) => {
        grouped['POS Items'] = (grouped['POS Items'] ?? 0) + item.price * item.quantity;
      });
    });

    // Add direct revenue as a separate category
    const filteredDirectRevenue = directRevenueEntries.filter(
      (entry) => entry.date >= customFilter.startDate && entry.date <= customFilter.endDate,
    );
    const directRevenueTotal = filteredDirectRevenue.reduce((sum, entry) => sum + entry.totalDirectRevenue, 0);
    if (directRevenueTotal > 0) {
      grouped['Direct Revenue'] = directRevenueTotal;
    }

    return Object.entries(grouped)
      .map(([category, revenue]) => ({ name: category, value: revenue }))
      .sort((a, b) => b.value - a.value);
  }, [filteredBills, directRevenueEntries, customFilter.startDate, customFilter.endDate]);

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
        {/* Daily Report Generator */}
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Daily Direct Revenue Report</h3>
              <p className="text-sm text-slate-600">Generate and share today's revenue summary</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={selectedDailyDate}
                onChange={(e) => setSelectedDailyDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
              <button
                type="button"
                onClick={shareToWhatsApp}
                className="inline-flex items-center gap-2 rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                <Share2 size={16} />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={shareToViber}
                className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
              >
                <Share2 size={16} />
                Viber
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/50 bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">POS Revenue</p>
              <p className="mt-3 text-2xl font-bold text-slate-900">{formatMVR(dailyReport.posRevenue)}</p>
            </div>
            <div className="rounded-2xl border border-white/50 bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Direct Revenue</p>
              <p className="mt-3 text-2xl font-bold text-slate-900">{formatMVR(dailyReport.directRevenue)}</p>
            </div>
            <div className="rounded-2xl border border-white/50 bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Total Expenses</p>
              <p className="mt-3 text-2xl font-bold text-red-600">{formatMVR(dailyReport.totalExpenses)}</p>
            </div>
            <div className="rounded-2xl border border-white/50 bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Daily Profit</p>
              <p className={`mt-3 text-2xl font-bold ${dailyReport.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMVR(dailyReport.profit)}
              </p>
            </div>
          </div>

          {/* Cash Drawer Details */}
          {dailyReport.cashBreakdown.length > 0 && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/50 bg-white p-4">
                <h4 className="mb-3 font-semibold text-slate-900">Cash Drawer Breakdown</h4>
                <div className="space-y-2">
                  {dailyReport.cashBreakdown.map((item: any) => (
                    <div key={`${item.denomination}-${item.count}`} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        {item.denomination}: {item.count}×
                      </span>
                      <span className="font-semibold text-slate-900">{formatMVR(item.amount)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 pt-2">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-700">Cash Total</span>
                      <span className="text-slate-900">{formatMVR(dailyReport.totalCashDrawer)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/50 bg-white p-4">
                <h4 className="mb-3 font-semibold text-slate-900">Payment Card Types</h4>
                <div className="space-y-2">
                  {dailyReport.cardPayments.length > 0 ? (
                    dailyReport.cardPayments.map((payment: any) => (
                      payment.amount > 0 && (
                        <div key={payment.type} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{payment.type}</span>
                          <span className="font-semibold text-slate-900">{formatMVR(payment.amount)}</span>
                        </div>
                      )
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No card payments recorded</p>
                  )}
                  <div className="border-t border-slate-200 pt-2">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-700">Card Total</span>
                      <span className="text-slate-900">{formatMVR(dailyReport.totalCardPayments)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Petty Cash (Float) */}
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h4 className="mb-3 font-semibold text-amber-900">💰 Petty Cash (Float)</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-amber-700">Opening</p>
                <p className="text-lg font-bold text-amber-900">{formatMVR(dailyReport.openingPettyCash)}</p>
              </div>
              <div>
                <p className="text-xs text-amber-700">Closing</p>
                <p className="text-lg font-bold text-amber-900">{formatMVR(dailyReport.closingPettyCash)}</p>
              </div>
              <div>
                <p className="text-xs text-amber-700">Difference</p>
                <p className={`text-lg font-bold ${dailyReport.closingPettyCash >= dailyReport.openingPettyCash ? 'text-green-600' : 'text-red-600'}`}>
                  {formatMVR(dailyReport.closingPettyCash - dailyReport.openingPettyCash)}
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Charts Grid */}
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Monthly Revenue Trend</h3>
            <p className="text-sm text-[#05093f]">Revenue comparison across months</p>
            <div className="mt-4 h-72">
              {revenueByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByMonth} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(5, 9, 63, 0.15)" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: 'rgba(5, 9, 63, 0.7)' }} />
                    <YAxis tick={{ fill: 'rgba(5, 9, 63, 0.7)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: 16, border: '1px solid rgba(5, 9, 63, 0.2)', color: '#05093f' }}
                      formatter={(value: any) => formatMVR(value)}
                    />
                    <Bar dataKey="revenue" fill="#7c4b2e" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <p>No revenue data available</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Daily Revenue</h3>
            <p className="text-sm text-[#05093f]">Revenue trend for selected period</p>
            <div className="mt-4 h-72">
              {dailyRevenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyRevenueData} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(5, 9, 63, 0.15)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(5, 9, 63, 0.7)' }} />
                    <YAxis tick={{ fill: 'rgba(5, 9, 63, 0.7)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: 16, border: '1px solid rgba(5, 9, 63, 0.2)', color: '#05093f' }}
                      formatter={(value: any) => formatMVR(value)}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#05093f" strokeWidth={2} dot={{ fill: '#7c4b2e', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <p>No daily revenue data available</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Payment Methods</h3>
            <p className="text-sm text-[#05093f]">Revenue distribution</p>
            <div className="mt-4 h-72">
              {paymentBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentBreakdown} dataKey="value" nameKey="method" innerRadius={48} outerRadius={88} paddingAngle={4}>
                      {paymentBreakdown.map((entry, index) => (
                        <Cell key={entry.method} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: 16, border: '1px solid rgba(5, 9, 63, 0.2)', color: '#05093f' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <p>No payment method data available</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900">Category Revenue</h3>
            <p className="text-sm text-[#05093f]">Revenue by category</p>
            <div className="mt-4 h-72">
              {categoryRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryRevenue} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88} paddingAngle={4}>
                      {categoryRevenue.map((entry, index) => (
                        <Cell key={entry.name} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: 16, border: '1px solid rgba(5, 9, 63, 0.2)', color: '#05093f' }}
                      formatter={(value: any) => formatMVR(value)}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <p>No category revenue data available</p>
                </div>
              )}
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
