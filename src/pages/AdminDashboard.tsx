import { motion } from 'framer-motion';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell, AreaChart, Area,
  ComposedChart
} from 'recharts';
import AppShell from '../components/AppShell';
import { useEffect, useMemo, useState } from 'react';
import { loadCollection, saveDocument } from '../lib/firestore';
import { loadDineAndGoCustomers, saveDineAndGoCustomer, deleteDineAndGoCustomer } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, AlertTriangle, Package } from 'lucide-react';
import type { Bill, MenuItem, InventoryItem, PurchaseOrder, DailyDirectRevenue } from '../types';
import type { DineAndGoCustomer } from '../types/dineAndGo';

const paymentColors = ['#16a34a', '#05093f', '#7c4b2e', '#f59e0b'];

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-lg">
        <p className="text-sm font-semibold text-slate-900 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatMVR(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [dailyDirectRevenue, setDailyDirectRevenue] = useState<DailyDirectRevenue[]>([]);

  // Dine-and-Go state
  const [dineAndGoCustomers, setDineAndGoCustomers] = useState<DineAndGoCustomer[]>([]);
  const [dineAndGoForm, setDineAndGoForm] = useState<Partial<DineAndGoCustomer>>({});
  const [editingDineAndGoId, setEditingDineAndGoId] = useState<string | null>(null);
  const [showDineAndGoForm, setShowDineAndGoForm] = useState(false);
  const [chargeAmount, setChargeAmount] = useState<number>(0);
  const [chargingCustomerId, setChargingCustomerId] = useState<string | null>(null);

  useEffect(() => {
    loadCollection<MenuItem>('menuItems', [])
      .then((items) => { if (items.length) setProducts(items); })
      .catch(() => undefined);
    loadCollection<InventoryItem>('inventory', [])
      .then((items) => { if (items.length) setInventory(items); })
      .catch(() => undefined);
    loadCollection<any>('recipes', [])
      .then(async (recipes) => {
        if (!recipes.length) return;
        const existing = await loadCollection<InventoryItem>('inventory', []);
        const existingNames = new Set(existing.map((i) => i.name.toLowerCase().trim()));

        for (const r of recipes) {
          for (const ing of r.ingredients || []) {
            const name = (ing.name || '').trim();
            if (!name) continue;
            if (!existingNames.has(name.toLowerCase())) {
              const payload: InventoryItem = {
                id: ing.inventoryId || `stock-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                name,
                quantity: 0,
                unit: ing.unit || 'pcs',
                lowStock: 5,
              };
              try {
                await saveDocument('inventory', payload.id, payload);
                existingNames.add(name.toLowerCase());
                setInventory((cur) => [payload, ...cur]);
                console.log('Created inventory item from recipe ingredient:', payload.name);
              } catch (error) {
                console.error('Failed to create inventory item for ingredient', name, error);
              }
            }
          }
        }
      })
      .catch(() => undefined);
    loadCollection<Bill>('bills', [])
      .then((items) => { if (items.length) setBills(items); })
      .catch(() => undefined);
    loadCollection<PurchaseOrder>('purchaseOrders', [])
      .then((items) => { if (items.length) setPurchaseOrders(items); })
      .catch(() => undefined);
    loadCollection<DailyDirectRevenue>('dailyDirectRevenue', [])
      .then((items) => { if (items.length) setDailyDirectRevenue(items); })
      .catch(() => undefined);
    
    // Load dine-and-go customers
    loadDineAndGoCustomers().then(setDineAndGoCustomers).catch(() => undefined);
  }, []);

  const todaySales = useMemo(() => {
    const todayKey = new Date().toDateString();
    return bills.reduce((sum, bill) => {
      if (new Date(bill.createdAt).toDateString() !== todayKey) return sum;
      return sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
    }, 0);
  }, [bills]);

  const yesterdaySales = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toDateString();
    return bills.reduce((sum, bill) => {
      if (new Date(bill.createdAt).toDateString() !== yesterdayKey) return sum;
      return sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
    }, 0);
  }, [bills]);

  const salesGrowth = useMemo(() => {
    if (yesterdaySales === 0) return 0;
    return ((todaySales - yesterdaySales) / yesterdaySales) * 100;
  }, [todaySales, yesterdaySales]);

  const openBills = bills.filter((bill) => bill.status !== 'Served').length;
  const receivedOrders = purchaseOrders.filter((order) => order.status === 'Received').length;





  const topItems = useMemo(() => {
    if (!bills.length) return products.slice(0, 5);
    const productCount = bills.reduce<Record<string, { quantity: number; price: number; revenue: number }>>((acc, bill) => {
      bill.items.forEach((item) => {
        if (acc[item.name]) {
          acc[item.name].quantity += item.quantity;
          acc[item.name].revenue += item.price * item.quantity;
        } else {
          acc[item.name] = { quantity: item.quantity, price: item.price, revenue: item.price * item.quantity };
        }
      });
      return acc;
    }, {});

    return Object.entries(productCount)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 6)
      .map(([name, details]) => ({ id: name, name, category: 'POS Product', price: details.price, quantity: details.quantity, revenue: details.revenue }));
  }, [bills, products]);

  const paymentBreakdown = useMemo(() => {
    const breakdown = bills.reduce<Record<string, number>>((acc, bill) => {
      const total = bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      acc[bill.paymentMethod] = (acc[bill.paymentMethod] || 0) + total;
      return acc;
    }, {});

    return Object.entries(breakdown).map(([method, value]) => ({ method, value }));
  }, [bills]);









  const directCashTotal = useMemo(() => {
    return dailyDirectRevenue.reduce((sum, entry) => sum + (entry.cashTotal || 0), 0);
  }, [dailyDirectRevenue]);

  const directCardTotal = useMemo(() => {
    return dailyDirectRevenue.reduce((sum, entry) => sum + (entry.cardTotal || 0), 0);
  }, [dailyDirectRevenue]);





  const dailySales = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      return day;
    });

    const data = days.map((day) => {
      const dayStr = day.toDateString();
      const dayBills = bills.filter((bill) => new Date(bill.createdAt).toDateString() === dayStr);
      const revenue = dayBills.reduce((sum, bill) => sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0), 0);
      const orders = dayBills.length;
      return {
        day: day.toLocaleDateString('en-US', { weekday: 'short' }),
        date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue,
        orders
      };
    });

    return data;
  }, [bills]);

  const hourlySales = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    return hours.map((hour) => {
      const hourBills = bills.filter((bill) => new Date(bill.createdAt).getHours() === hour);
      const revenue = hourBills.reduce((sum, bill) => sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0), 0);
      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        revenue
      };
    });
  }, [bills]);

  const monthlySales = useMemo(() => {
    const totals = bills.reduce<Record<string, number>>((acc, bill) => {
      const date = new Date(bill.createdAt);
      const label = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      acc[label] = (acc[label] || 0) + bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return acc;
    }, {});

    return Object.entries(totals)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([month, amount]) => ({ day: month, amount }));
  }, [bills]);

  const paymentMethodTrend = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      return day;
    });

    return days.map((day) => {
      const dayStr = day.toDateString();
      const dayBills = bills.filter((bill) => new Date(bill.createdAt).toDateString() === dayStr);
      const cash = dayBills.reduce((sum, bill) => {
        if (bill.paymentMethod === 'Cash') {
          return sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
        }
        return sum;
      }, 0);
      const transfer = dayBills.reduce((sum, bill) => {
        if (bill.paymentMethod === 'Bank transfer') {
          return sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
        }
        return sum;
      }, 0);
      const card = dayBills.reduce((sum, bill) => {
        if (bill.paymentMethod === 'Card') {
          return sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
        }
        return sum;
      }, 0);
      return {
        day: day.toLocaleDateString('en-US', { weekday: 'short' }),
        date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        cash,
        transfer,
        card
      };
    });
  }, [bills]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    bills.forEach((bill) => {
      bill.items.forEach((item) => {
        const product = products.find(p => p.name === item.name);
        const category = product?.category || 'Others';
        categories[category] = (categories[category] || 0) + item.price * item.quantity;
      });
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [bills, products]);

  const lowStockAlerts = inventory.filter((item) => item.quantity <= item.lowStock);



  // Dine-and-Go functions
  const saveDineAndGo = async () => {
    const id = editingDineAndGoId ?? `dineandgo-${Date.now()}`;
    const payload: DineAndGoCustomer = {
      id,
      name: dineAndGoForm.name?.trim() || '',
      table: dineAndGoForm.table?.trim() || '',
      company: dineAndGoForm.company?.trim() || '',
      runningTotal: dineAndGoForm.runningTotal ?? 0,
      lastPaymentDate: dineAndGoForm.lastPaymentDate || '',
    };
    if (editingDineAndGoId) {
      setDineAndGoCustomers((cur) => cur.map((c) => (c.id === id ? payload : c)));
      setEditingDineAndGoId(null);
    } else {
      setDineAndGoCustomers((cur) => [payload, ...cur]);
    }
    await saveDineAndGoCustomer(id, payload);
    setDineAndGoForm({});
    setShowDineAndGoForm(false);
  };

  const editDineAndGo = (customer: DineAndGoCustomer) => {
    setEditingDineAndGoId(customer.id ?? null);
    setDineAndGoForm(customer);
    setShowDineAndGoForm(true);
  };

  const removeDineAndGo = async (id: string) => {
    setDineAndGoCustomers((cur) => cur.filter((c) => c.id !== id));
    await deleteDineAndGoCustomer(id);
  };

  const addCharge = async (customerId: string) => {
    if (chargeAmount <= 0) return;
    const customer = dineAndGoCustomers.find((c) => c.id === customerId);
    if (!customer) return;

    const updated: DineAndGoCustomer = {
      ...customer,
      runningTotal: (customer.runningTotal ?? 0) + chargeAmount,
    };

    setDineAndGoCustomers((cur) => cur.map((c) => (c.id === customerId ? updated : c)));
    await saveDineAndGoCustomer(customerId, updated);

    setChargeAmount(0);
    setChargingCustomerId(null);
  };

  const processWeeklyPayment = async (customerId: string) => {
    const customer = dineAndGoCustomers.find((c) => c.id === customerId);
    if (!customer) return;

    const updated: DineAndGoCustomer = {
      ...customer,
      runningTotal: 0,
      lastPaymentDate: new Date().toISOString().split('T')[0],
    };

    setDineAndGoCustomers((cur) => cur.map((c) => (c.id === customerId ? updated : c)));
    await saveDineAndGoCustomer(customerId, updated);
  };

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6 text-[#05093f]">
        {/* KPI Cards with Growth Indicators */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-green-500/10 to-transparent rounded-bl-full" />
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Today's Sales</p>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatMVR(todaySales)}</p>
            <div className="mt-3 flex items-center gap-2">
              {salesGrowth >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${salesGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {salesGrowth >= 0 ? '+' : ''}{salesGrowth.toFixed(1)}%
              </span>
              <span className="text-sm text-slate-500">vs yesterday</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full" />
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Open Bills</p>
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{openBills}</p>
            <p className="mt-3 text-sm text-slate-500">Orders pending fulfillment</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full" />
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Received Orders</p>
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{receivedOrders}</p>
            <p className="mt-3 text-sm text-slate-500">Purchase orders fulfilled</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full" />
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Low Stock</p>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{lowStockAlerts.length}</p>
            <p className="mt-3 text-sm text-slate-500">Items need restocking</p>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Daily Sales Trend */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="mb-4 text-lg font-semibold text-slate-900">7-Day Sales Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" fill="#16a34a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Hourly Sales */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Hourly Sales</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={hourlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" fill="#3b82f6" stroke="#2563eb" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Payment Method Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Payment Methods</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ method, value }) => `${method}: ${formatMVR(value)}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={paymentColors[index % paymentColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Category Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Category Sales</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" width={100} fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Monthly Sales */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"
          >
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Monthly Sales</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="amount" fill="#8b5cf6" stroke="#7c3aed" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Payment Method Trend */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"
          >
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Payment Method Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={paymentMethodTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="cash" fill="#059669" radius={[8, 8, 0, 0]} />
                <Bar dataKey="transfer" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                <Bar dataKey="card" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Top Items */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Top Items</h3>
            <div className="space-y-3">
              {topItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-2xl">
                  <span className="font-medium text-slate-700">{item.name}</span>
                  <span className="text-sm text-slate-500">{formatMVR((item as any).revenue || 0)}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Direct Revenue Summary */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Direct Revenue</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-2xl">
                <span className="font-medium text-slate-700">Cash Total</span>
                <span className="font-bold text-green-600">{formatMVR(directCashTotal)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-2xl">
                <span className="font-medium text-slate-700">Card Total</span>
                <span className="font-bold text-blue-600">{formatMVR(directCardTotal)}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Dine-and-Go Customers Section */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-[#05093f]">Dine-and-Go Customers</h3>
              <p className="text-sm text-slate-500">Track customers who dine and pay weekly. Only admins can edit.</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowDineAndGoForm(!showDineAndGoForm); setEditingDineAndGoId(null); setDineAndGoForm({}); }}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              {showDineAndGoForm ? 'Cancel' : 'Add Dine-and-Go'}
            </button>
          </div>
          {showDineAndGoForm && (
            <div className="grid gap-4 mb-6">
              <label className="block text-sm text-slate-700">
                Name
                <input
                  value={dineAndGoForm.name || ''}
                  onChange={e => setDineAndGoForm(cur => ({ ...cur, name: e.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                  placeholder="Name (optional)"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Table
                  <input
                    value={dineAndGoForm.table || ''}
                    onChange={e => setDineAndGoForm(cur => ({ ...cur, table: e.target.value }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                    placeholder="Table (optional)"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Company
                  <input
                    value={dineAndGoForm.company || ''}
                    onChange={e => setDineAndGoForm(cur => ({ ...cur, company: e.target.value }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                    placeholder="Company (optional)"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Running Total
                  <input
                    type="number"
                    value={dineAndGoForm.runningTotal ?? ''}
                    onChange={e => setDineAndGoForm(cur => ({ ...cur, runningTotal: e.target.value ? Number(e.target.value) : undefined }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                    placeholder="Running total (optional)"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Last Payment Date
                  <input
                    type="date"
                    value={dineAndGoForm.lastPaymentDate || ''}
                    onChange={e => setDineAndGoForm(cur => ({ ...cur, lastPaymentDate: e.target.value }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                    placeholder="Last payment date (optional)"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={saveDineAndGo}
                className="rounded-3xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-500"
              >
                {editingDineAndGoId ? 'Update' : 'Add'} Dine-and-Go
              </button>
            </div>
          )}
          <div className="space-y-4">
            {dineAndGoCustomers.length > 0 ? (
              dineAndGoCustomers.map((customer) => (
                <div key={customer.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-slate-300">
                  <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
                    <div className="grid gap-2 flex-1">
                      <h4 className="font-semibold text-slate-900">{customer.name || 'N/A'}</h4>
                      <div className="flex gap-4 text-sm text-slate-600">
                        {customer.table && <span>Table: {customer.table}</span>}
                        {customer.company && <span>Company: {customer.company}</span>}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="bg-white rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-500">Running Total</p>
                          <p className="text-lg font-bold text-slate-900">{formatMVR(customer.runningTotal ?? 0)}</p>
                        </div>
                        {customer.lastPaymentDate && (
                          <div className="bg-white rounded-lg px-3 py-2">
                            <p className="text-xs text-slate-500">Last Payment</p>
                            <p className="text-sm font-semibold text-slate-900">{customer.lastPaymentDate}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full lg:w-auto lg:min-w-fit">
                      {chargingCustomerId === customer.id ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={chargeAmount}
                            onChange={(e) => setChargeAmount(Number(e.target.value))}
                            className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            placeholder="Amount"
                          />
                          <button
                            type="button"
                            onClick={() => addCharge(customer.id!)}
                            className="rounded-lg bg-green-600 px-3 py-1 text-sm font-semibold text-white hover:bg-green-500"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setChargingCustomerId(null);
                              setChargeAmount(0);
                            }}
                            className="rounded-lg bg-slate-400 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setChargingCustomerId(customer.id!)}
                            className="rounded-lg bg-[#05093f] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900"
                          >
                            Add Charge
                          </button>
                          <button
                            type="button"
                            onClick={() => processWeeklyPayment(customer.id!)}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                          >
                            Weekly Payment
                          </button>
                        </div>
                      )}
                      <div className="flex gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => editDineAndGo(customer)}
                          className="flex-1 rounded-lg bg-slate-400 px-2 py-1 text-white hover:bg-slate-500"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => customer.id && removeDineAndGo(customer.id)}
                          className="flex-1 rounded-lg bg-red-600 px-2 py-1 text-white hover:bg-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <p className="text-sm font-medium">No dine-and-go customers yet</p>
                <p className="text-xs">Add customers to start tracking dine-and-go accounts</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
