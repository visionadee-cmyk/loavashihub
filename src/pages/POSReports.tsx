import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import { loadCollection } from '../lib/firestore';
import type { Bill, MenuItem } from '../types';
import { formatMVR } from '../lib/mvr';

export default function POSReports() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  const openBills = useMemo(() => bills.filter((b) => b.status !== 'Served'), [bills]);
  const pendingBills = useMemo(() => bills.filter((b) => b.status === 'Pending'), [bills]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysServedBills = useMemo(() => bills.filter((b) => b.status === 'Served' && b.createdAt.slice(0, 10) === todayKey), [bills, todayKey]);

  const dailyItemSales = useMemo(() => {
    const map: Record<string, { name: string; qty: number; price: number }> = {};
    todaysServedBills.forEach((bill) => {
      bill.items.forEach((item) => {
        const key = item.productId || item.name;
        if (!map[key]) map[key] = { name: item.name, qty: 0, price: item.price };
        map[key].qty += item.quantity;
      });
    });
    return Object.entries(map)
      .map(([key, v]) => ({ id: key, name: v.name, qty: v.qty, revenue: v.qty * v.price }))
      .sort((a, b) => b.qty - a.qty);
  }, [todaysServedBills]);

  const top10Daily = dailyItemSales.slice(0, 10);

  const signatureItems = useMemo(() => menuItems.filter((m) => m.isSignature), [menuItems]);

  const signatureSales = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    bills.forEach((bill) => {
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
  }, [bills, menuItems]);

  if (loading) {
    return (
      <AppShell title="POS Reports">
        <p>Loading reports…</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="POS Reports">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Open bills</h4>
          <p className="text-3xl font-bold mt-3">{openBills.length}</p>
          <p className="text-sm text-slate-500 mt-2">Currently open (not served)</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Pending bills</h4>
          <p className="text-3xl font-bold mt-3">{pendingBills.length}</p>
          <p className="text-sm text-slate-500 mt-2">Awaiting preparation</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Today's served bills</h4>
          <p className="text-3xl font-bold mt-3">{todaysServedBills.length}</p>
          <p className="text-sm text-slate-500 mt-2">Served today</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Top 10 items sold today</h4>
          {top10Daily.length ? (
            <ol className="mt-3 space-y-2">
              {top10Daily.map((it) => (
                <li key={it.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{it.name}</p>
                    <p className="text-xs text-slate-500">Qty: {it.qty}</p>
                  </div>
                  <div className="text-sm font-semibold">{formatMVR(it.revenue)}</div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No sales recorded for today yet.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Signature dishes (all time)</h4>
          {signatureItems.length ? (
            <ol className="mt-3 space-y-2">
              {signatureItems.map((s) => {
                const sale = signatureSales.find((x) => x.id === s.id);
                return (
                  <li key={s.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500">Category: {s.category}</p>
                    </div>
                    <div className="text-sm font-semibold">{sale ? `${sale.qty} sold` : '0 sold'}</div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No signature dishes marked in menu.</p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-800">Additional notes</h4>
        <p className="text-sm text-slate-500 mt-3">This page summarizes POS-level metrics. For more advanced reports (date ranges, store-level aggregation, exports), we can extend filters and charts.</p>
      </div>
    </AppShell>
  );
}
