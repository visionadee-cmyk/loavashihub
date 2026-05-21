import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import AppShell from '../components/AppShell';
import { useEffect, useMemo, useState } from 'react';
import { demoDailySales, demoMonthlySales, demoPaymentTypeBreakdown } from '../data/demo';
import { loadCollection } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { Bill, MenuItem, InventoryItem, PurchaseOrder } from '../types';

const paymentColors = ['#8b5cf6', '#38bdf8', '#f97316'];

export default function AdminDashboard() {
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    loadCollection<MenuItem>('menuItems', [])
      .then((items) => { if (items.length) setProducts(items); })
      .catch(() => undefined);
    loadCollection<InventoryItem>('inventory', [])
      .then((items) => { if (items.length) setInventory(items); })
      .catch(() => undefined);
    loadCollection<Bill>('bills', [])
      .then((items) => { if (items.length) setBills(items); })
      .catch(() => undefined);
    loadCollection<PurchaseOrder>('purchaseOrders', [])
      .then((items) => { if (items.length) setPurchaseOrders(items); })
      .catch(() => undefined);
  }, []);

  const todaySales = useMemo(() => {
    const todayKey = new Date().toDateString();
    return bills.reduce((sum, bill) => {
      if (new Date(bill.createdAt).toDateString() !== todayKey) return sum;
      return sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
    }, 0);
  }, [bills]);

  const openBills = bills.filter((bill) => bill.status !== 'Served').length;
  const receivedOrders = purchaseOrders.filter((order) => order.status === 'Received').length;

  const topItems = useMemo(() => {
    if (!bills.length) return products.slice(0, 5);
    const productCount = bills.reduce<Record<string, { quantity: number; price: number }>>((acc, bill) => {
      bill.items.forEach((item) => {
        if (acc[item.name]) {
          acc[item.name].quantity += item.quantity;
        } else {
          acc[item.name] = { quantity: item.quantity, price: item.price };
        }
      });
      return acc;
    }, {});

    return Object.entries(productCount)
      .sort(([, a], [, b]) => b.quantity - a.quantity)
      .slice(0, 5)
      .map(([name, details]) => ({ id: name, name, category: 'POS Product', price: details.price }));
  }, [bills, products]);

  const lowStockAlerts = inventory.filter((item) => item.quantity <= item.lowStock);

  return (
    <AppShell title="Dashboard">
      <div className="space-y-8">
        <div className="grid gap-5 xl:grid-cols-4">
          {[
            { label: "Today's sales", value: formatMVR(todaySales) },
            { label: 'Open bills', value: openBills },
            { label: 'Received purchase orders', value: receivedOrders },
            { label: 'Low stock items', value: lowStockAlerts.length },
          ].map((metric) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20"
            >
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Daily sales</h3>
                <p className="text-sm text-slate-400">Sales by day for the current week.</p>
              </div>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={demoDailySales} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8' }} />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: 16, border: '1px solid #334155' }} />
                  <Line type="monotone" dataKey="amount" stroke="#a78bfa" strokeWidth={4} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Payment breakdown</h3>
              <p className="text-sm text-slate-400">Cash, card and bank transfer mix.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={demoPaymentTypeBreakdown} dataKey="value" nameKey="method" innerRadius={52} outerRadius={88} paddingAngle={4}>
                    {demoPaymentTypeBreakdown.map((entry, index) => (
                      <Cell key={entry.method} fill={paymentColors[index % paymentColors.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" align="center" wrapperStyle={{ color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20"
          >
            <h3 className="text-lg font-semibold text-white">Top selling items</h3>
            <div className="mt-5 space-y-4">
              {topItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-950 px-4 py-4">
                  <div>
                    <p className="font-medium text-white">{item.name}</p>
                    <p className="text-sm text-slate-400">{item.category}</p>
                  </div>
                  <p className="text-sm font-semibold text-violet-300">{formatMVR(item.price)}</p>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Inventory alerts</h3>
                <p className="text-sm text-slate-400">Low stock items to restock.</p>
              </div>
            </div>
            <div className="space-y-4">
              {lowStockAlerts.length ? (
                lowStockAlerts.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-slate-800 bg-slate-950 px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="text-sm text-slate-400">Only {item.quantity} {item.unit} remaining</p>
                      </div>
                      <span className="rounded-2xl bg-rose-600/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-rose-300">Low stock</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">All inventory looks healthy.</p>
              )}
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Monthly sales comparison</h3>
              <p className="text-sm text-slate-400">Performance for the last five months.</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demoMonthlySales} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: '#94a3b8' }} />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: 16, border: '1px solid #334155' }} />
                <Bar dataKey="amount" fill="#818cf8" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
      </div>
    </AppShell>
  );
}
