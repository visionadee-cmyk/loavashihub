import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import { loadCollection } from '../lib/firestore';
import type { Bill, MenuItem } from '../types';
import { formatMVR } from '../lib/mvr';

export default function POSReports() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

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

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const billDate = b.createdAt.slice(0, 10);
      return billDate >= dateFrom && billDate <= dateTo;
    });
  }, [bills, dateFrom, dateTo]);

  const servedBills = useMemo(() => filteredBills.filter((b) => b.status === 'Served'), [filteredBills]);

  const openBills = useMemo(() => bills.filter((b) => b.status !== 'Served'), [bills]);
  const pendingBills = useMemo(() => bills.filter((b) => b.status === 'Pending'), [bills]);

  const itemSales = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number; category: string }> = {};
    servedBills.forEach((bill) => {
      bill.items.forEach((item) => {
        const key = item.productId || item.name;
        const menu = menuItems.find((m) => m.id === item.productId || m.name === item.name);
        const category = menu?.category || 'Uncategorized';
        if (!map[key]) map[key] = { name: item.name, qty: 0, revenue: 0, category };
        map[key].qty += item.quantity;
        map[key].revenue += item.quantity * item.price;
      });
    });
    return Object.entries(map)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.qty - a.qty);
  }, [servedBills, menuItems]);

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

  if (loading) {
    return (
      <AppShell title="POS Reports">
        <p>Loading reports…</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="POS Reports">
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-semibold text-slate-800">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-800">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
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

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Top 10 items</h4>
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
    </AppShell>
  );
}
