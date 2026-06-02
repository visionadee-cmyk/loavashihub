import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import { loadCollection } from '../lib/firestore';
import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Bill, MenuItem } from '../types';
import { formatMVR } from '../lib/mvr';

const PRESET_RANGES = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: 'last7' },
  { label: 'This month', value: 'thisMonth' },
  { label: 'Last month', value: 'lastMonth' },
  { label: 'Custom', value: 'custom' },
] as const;

const REPORT_VIEWS = [
  { label: 'Summary', value: 'summary' },
  { label: 'Item wise', value: 'item' },
  { label: 'Category wise', value: 'category' },
  { label: 'Date wise', value: 'date' },
  { label: 'Custom', value: 'custom' },
] as const;

type ReportView = (typeof REPORT_VIEWS)[number]['value'];

type PresetRange = (typeof PRESET_RANGES)[number]['value'];

function getPresetDateRange(range: PresetRange) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (range) {
    case 'today':
      break;
    case 'yesterday':
      start.setDate(now.getDate() - 1);
      end.setDate(now.getDate() - 1);
      break;
    case 'last7':
      start.setDate(now.getDate() - 6);
      break;
    case 'thisMonth':
      start.setDate(1);
      break;
    case 'lastMonth': {
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthEnd = new Date(firstDayThisMonth);
      lastMonthEnd.setDate(0);
      const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
      return {
        from: lastMonthStart.toISOString().slice(0, 10),
        to: lastMonthEnd.toISOString().slice(0, 10),
      };
    }
    case 'custom':
    default:
      return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }

  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export default function POSReports() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [presetRange, setPresetRange] = useState<PresetRange>('today');
  const [reportView, setReportView] = useState<ReportView>('summary');
  const [statusFilter, setStatusFilter] = useState<'all' | 'served' | 'pending'>('served');
  const [itemSearch, setItemSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [sortBy, setSortBy] = useState<'qty' | 'revenue'>('qty');

  useEffect(() => {
    let mounted = true;
    Promise.all([loadCollection<Bill>('bills', []), loadCollection<MenuItem>('menuItems', [])])
      .then(([loadedBills, loadedMenu]) => {
        if (!mounted) return;
        setBills(loadedBills);
        setMenuItems(loadedMenu);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (presetRange === 'custom') return;
    const range = getPresetDateRange(presetRange);
    setDateFrom(range.from);
    setDateTo(range.to);
  }, [presetRange]);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const billDate = b.createdAt.slice(0, 10);
      const inRange = billDate >= dateFrom && billDate <= dateTo;
      if (!inRange) return false;
      if (statusFilter === 'served') return b.status === 'Served';
      if (statusFilter === 'pending') return b.status === 'Pending';
      return true;
    });
  }, [bills, dateFrom, dateTo, statusFilter]);

  const servedBills = useMemo(
    () => filteredBills.filter((b) => b.status === 'Served'),
    [filteredBills]
  );

  const openBills = useMemo(() => bills.filter((b) => b.status !== 'Served'), [bills]);
  const pendingBills = useMemo(() => bills.filter((b) => b.status === 'Pending'), [bills]);

  const itemSales = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number; category: string }> = {};
    servedBills.forEach((bill) => {
      bill.items.forEach((item) => {
        const menu = menuItems.find((m) => m.id === item.productId || m.name === item.name);
        const category = menu?.category || 'Uncategorized';
        const itemName = item.name.trim();
        if (itemSearch && !itemName.toLowerCase().includes(itemSearch.toLowerCase())) return;
        if (categorySearch && !category.toLowerCase().includes(categorySearch.toLowerCase())) return;
        const key = item.productId || itemName;
        if (!map[key]) map[key] = { name: itemName, qty: 0, revenue: 0, category };
        map[key].qty += item.quantity;
        map[key].revenue += item.quantity * item.price;
      });
    });
    return Object.entries(map)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (sortBy === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty));
  }, [servedBills, menuItems, itemSearch, categorySearch, sortBy]);

  const top10Items = itemSales.slice(0, 10);

  const categorySales = useMemo(() => {
    const map: Record<string, { category: string; qty: number; revenue: number; itemCount: number }> = {};
    itemSales.forEach((item) => {
      const cat = item.category;
      if (!map[cat]) map[cat] = { category: cat, qty: 0, revenue: 0, itemCount: 0 };
      map[cat].qty += item.qty;
      map[cat].revenue += item.revenue;
      map[cat].itemCount += 1;
    });
    return Object.entries(map)
      .map(([_, v]) => v)
      .sort((a, b) => b.revenue - a.revenue);
  }, [itemSales]);

  const totalRevenue = useMemo(
    () => servedBills.reduce((sum, bill) => sum + bill.items.reduce((acc, item) => acc + item.price * item.quantity, 0), 0),
    [servedBills]
  );
  const totalItems = useMemo(
    () => servedBills.reduce((sum, bill) => sum + bill.items.reduce((acc, item) => acc + item.quantity, 0), 0),
    [servedBills]
  );

  const dateWiseSales = useMemo(() => {
    const map: Record<string, { date: string; bills: number; items: number; revenue: number }> = {};
    filteredBills.forEach((bill) => {
      const date = bill.createdAt.slice(0, 10);
      if (!map[date]) map[date] = { date, bills: 0, items: 0, revenue: 0 };
      map[date].bills += 1;
      bill.items.forEach((item) => {
        map[date].items += item.quantity;
        map[date].revenue += item.quantity * item.price;
      });
    });
    return Object.values(map).sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [filteredBills]);

  const signatureSales = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    servedBills.forEach((bill) => {
      bill.items.forEach((item) => {
        const menu = menuItems.find((m) => m.id === item.productId || m.name === item.name);
        if (menu && menu.isSignature) {
          const key = menu.id;
          if (!map[key]) map[key] = { name: menu.name, qty: 0, revenue: 0 };
          map[key].qty += item.quantity;
          map[key].revenue += item.quantity * item.price;
        }
      });
    });
    return Object.entries(map).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.qty - a.qty);
  }, [servedBills, menuItems]);

  const exportXlsx = () => {
    const workbook = utils.book_new();
    const summarySheet = utils.json_to_sheet([
      { Metric: 'Report view', Value: reportView },
      { Metric: 'Date from', Value: dateFrom },
      { Metric: 'Date to', Value: dateTo },
      { Metric: 'Status filter', Value: statusFilter },
      { Metric: 'Total served bills', Value: servedBills.length },
      { Metric: 'Total open bills', Value: openBills.length },
      { Metric: 'Total items sold', Value: totalItems },
      { Metric: 'Total revenue', Value: totalRevenue },
    ]);
    utils.book_append_sheet(workbook, summarySheet, 'Summary');

    const itemSheet = utils.json_to_sheet(
      itemSales.map((item) => ({
        Item: item.name,
        Category: item.category,
        Quantity: item.qty,
        Revenue: item.revenue,
      })),
    );
    utils.book_append_sheet(workbook, itemSheet, 'Item Sales');

    const categorySheet = utils.json_to_sheet(
      categorySales.map((category) => ({
        Category: category.category,
        Quantity: category.qty,
        Revenue: category.revenue,
        Items: category.itemCount,
      })),
    );
    utils.book_append_sheet(workbook, categorySheet, 'Category Sales');

    const dateSheet = utils.json_to_sheet(
      dateWiseSales.map((row) => ({
        Date: row.date,
        Bills: row.bills,
        Items: row.items,
        Revenue: row.revenue,
      })),
    );
    utils.book_append_sheet(workbook, dateSheet, 'Date Sales');

    const data = write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([data], { type: 'application/octet-stream' }),
      `pos-reports-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const exportPDF = async () => {
    const element = document.getElementById('pos-reports-pdf-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      let heightLeft = imgHeight - pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`pos-reports-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export POS report PDF');
    }
  };

  const printPage = () => {
    window.print();
  };

  if (loading) {
    return (
      <AppShell title="POS Reports">
        <p>Loading reports…</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="POS Reports">
      <div id="pos-reports-pdf-content" className="mb-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-900">POS Reports</h2>
            <p className="text-sm text-slate-600">Use presets, custom filters, and item/category/date views to explore sales data.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_RANGES.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setPresetRange(preset.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${preset.value === presetRange ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportXlsx}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Export Excel
            </button>
            <button
              type="button"
              onClick={exportPDF}
              className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Export PDF
            </button>
            <button
              type="button"
              onClick={printPage}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Print
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {REPORT_VIEWS.map((view) => (
            <button
              key={view.value}
              type="button"
              onClick={() => setReportView(view.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${reportView === view.value ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {view.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-slate-800">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPresetRange('custom');
              }}
              className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPresetRange('custom');
              }}
              className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
            />
          </div>
          <div className="flex items-end">
            <div className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-semibold">Period summary</p>
              <p className="text-xs text-slate-500 mt-1">
                {servedBills.length} bills • {totalItems} items • {formatMVR(totalRevenue)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-slate-800">Status filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'served' | 'pending')}
              className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
            >
              <option value="all">All bills</option>
              <option value="served">Served only</option>
              <option value="pending">Pending only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800">Item search</label>
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search by item name"
              className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800">Category search</label>
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search by category"
              className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Total revenue</h4>
          <p className="text-3xl font-bold mt-3">{formatMVR(totalRevenue)}</p>
          <p className="text-xs text-slate-500 mt-2">From {servedBills.length} served bills</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Total items sold</h4>
          <p className="text-3xl font-bold mt-3">{totalItems}</p>
          <p className="text-xs text-slate-500 mt-2">{itemSales.length} unique items</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Open bills</h4>
          <p className="text-3xl font-bold mt-3">{openBills.length}</p>
          <p className="text-xs text-slate-500 mt-2">{pendingBills.length} pending</p>
        </div>
      </div>

      {reportView === 'summary' && (
        <>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Top 10 items</h4>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'qty' | 'revenue')}
                  className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700"
                >
                  <option value="qty">Sort by quantity</option>
                  <option value="revenue">Sort by revenue</option>
                </select>
              </div>
              {top10Items.length ? (
                <ol className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                  {top10Items.map((item, index) => (
                    <li key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-500">{index + 1}.</span>
                          <div>
                            <p className="font-medium text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.category}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{item.qty}</p>
                        <p className="text-xs text-slate-500">{formatMVR(item.revenue)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No sales recorded for this period.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-800">Sales by category</h4>
              {categorySales.length ? (
                <ol className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                  {categorySales.map((cat) => (
                    <li key={cat.category} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{cat.category}</p>
                        <p className="text-xs text-slate-500">
                          {cat.itemCount} items • {cat.qty} qty
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatMVR(cat.revenue)}</p>
                        <p className="text-xs text-slate-500">{totalRevenue ? Math.round((cat.revenue / totalRevenue) * 100) : 0}%</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No categories recorded.</p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-800">Signature dishes</h4>
            {signatureSales.length ? (
              <ol className="mt-3 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {signatureSales.map((sig) => (
                  <li key={sig.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="font-medium text-slate-900">{sig.name}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{sig.qty} sold</span>
                      <span className="font-semibold text-slate-900">{formatMVR(sig.revenue)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No signature dishes marked in menu.</p>
            )}
          </div>
        </>
      )}

      {reportView === 'item' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-800">Item-wise sales</h4>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{itemSales.length} items</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Review item quantity and revenue for the selected period.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="block text-sm text-slate-600">
                Sort by
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'qty' | 'revenue')}
                  className="mt-2 rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                >
                  <option value="qty">Quantity</option>
                  <option value="revenue">Revenue</option>
                </select>
              </label>
            </div>
          </div>
          {itemSales.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {itemSales.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="px-3 py-3 text-slate-500">{item.category}</td>
                      <td className="px-3 py-3 text-right">{item.qty}</td>
                      <td className="px-3 py-3 text-right">{formatMVR(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No item sales match the selected filters.</p>
          )}
        </div>
      )}

      {reportView === 'category' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Category-wise sales</h4>
          {categorySales.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Items</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                    <th className="px-3 py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {categorySales.map((cat) => (
                    <tr key={cat.category} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{cat.category}</td>
                      <td className="px-3 py-3 text-right">{cat.itemCount}</td>
                      <td className="px-3 py-3 text-right">{cat.qty}</td>
                      <td className="px-3 py-3 text-right">{formatMVR(cat.revenue)}</td>
                      <td className="px-3 py-3 text-right">{totalRevenue ? `${Math.round((cat.revenue / totalRevenue) * 100)}%` : '0%'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No categories found for this period.</p>
          )}
        </div>
      )}

      {reportView === 'date' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Date-wise sales</h4>
          {dateWiseSales.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Bills</th>
                    <th className="px-3 py-2 text-right">Items</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {dateWiseSales.map((row) => (
                    <tr key={row.date} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{row.date}</td>
                      <td className="px-3 py-3 text-right">{row.bills}</td>
                      <td className="px-3 py-3 text-right">{row.items}</td>
                      <td className="px-3 py-3 text-right">{formatMVR(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No date data available for this range.</p>
          )}
        </div>
      )}

      {reportView === 'custom' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Custom report</h4>
          <p className="text-sm text-slate-500 mt-2">Use the filters above to build your own report. You can combine date range, status, item search, and category search.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Bills in range</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredBills.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Total revenue filtered</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMVR(totalRevenue)}</p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h5 className="text-sm font-semibold text-slate-800">Filtered items</h5>
                <p className="text-xs text-slate-500 mt-1">Showing all filtered item results for the current query.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{itemSales.length} items</span>
            </div>
            {itemSales.length ? (
              <ul className="mt-3 space-y-2">
                {itemSales.map((item) => (
                  <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.category}</p>
                    </div>
                    <span className="font-semibold text-slate-900">{item.qty}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No item sales match the current custom filters.</p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
