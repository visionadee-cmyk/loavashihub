import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell, AreaChart, Area,
  ComposedChart, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import AppShell from '../components/AppShell';
import { useEffect, useMemo, useState } from 'react';
import { loadCollection, saveDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, AlertTriangle, Package } from 'lucide-react';
import type { Bill, MenuItem, InventoryItem, PurchaseOrder, StaffMember, Expense, Recipe } from '../types';

const paymentColors = ['#16a34a', '#05093f', '#7c4b2e', '#f59e0b'];
const categoryColors = ['#16a34a', '#05093f', '#7c4b2e', '#f59e0b', '#8b5cf6', '#ec4899'];

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
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

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
    loadCollection<StaffMember>('staff', [])
      .then((items) => { if (items.length) setStaffMembers(items); })
      .catch(() => undefined);
    loadCollection<Expense>('expenses', [])
      .then((items) => { if (items.length) setExpenses(items); })
      .catch(() => undefined);
    loadCollection<Recipe>('recipes', [])
      .then((items) => { if (items.length) setRecipes(items); })
      .catch(() => undefined);
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

  const totalRevenue = useMemo(() => {
    return bills.reduce((sum, bill) => sum + bill.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0), 0);
  }, [bills]);

  const averageOrderValue = useMemo(() => {
    return bills.length > 0 ? totalRevenue / bills.length : 0;
  }, [totalRevenue, bills.length]);

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

  const inventoryValue = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.quantity * 100), 0); // Estimated value
  }, [inventory]);

  // Staff statistics
  const totalStaff = staffMembers.length;
  const staffByDesignation = useMemo(() => {
    const counts: Record<string, number> = {};
    staffMembers.forEach((staff) => {
      counts[staff.designation] = (counts[staff.designation] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [staffMembers]);

  const totalMonthlySalary = useMemo(() => {
    return staffMembers.reduce((sum, staff) => sum + staff.salary, 0);
  }, [staffMembers]);

  // Expense statistics
  const totalExpensesAmount = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const expensesByCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    expenses.forEach((expense) => {
      categories[expense.category] = (categories[expense.category] || 0) + expense.amount;
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Net profit calculation
  const netProfit = useMemo(() => {
    return totalRevenue - totalExpensesAmount;
  }, [totalRevenue, totalExpensesAmount]);

  // Active recipes count
  const activeRecipes = useMemo(() => {
    return recipes.filter((recipe) => recipe.status === 'Active').length;
  }, [recipes]);

  // Customer statistics
  const uniqueCustomers = useMemo(() => {
    const customerIds = new Set(bills.map((bill) => bill.customerId).filter(Boolean));
    return customerIds.size;
  }, [bills]);

  // Order status breakdown
  const orderStatusBreakdown = useMemo(() => {
    const statuses: Record<string, number> = {};
    bills.forEach((bill) => {
      statuses[bill.status] = (statuses[bill.status] || 0) + 1;
    });
    return Object.entries(statuses).map(([name, value]) => ({ name, value }));
  }, [bills]);

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

        {/* Main Charts Row */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Daily Sales Chart - Larger */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Revenue Overview</h3>
                <p className="text-sm text-slate-500">Daily revenue and order count for the past week</p>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailySales} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(5, 9, 63, 0.1)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(5, 9, 63, 0.7)', fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fill: 'rgba(5, 9, 63, 0.7)', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(5, 9, 63, 0.7)', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#16a34a" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                  <Bar yAxisId="right" dataKey="orders" fill="#05093f" radius={[4, 4, 0, 0]} name="Orders" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.section>

          {/* Payment Methods */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-slate-900">Payment Methods</h3>
              <p className="text-sm text-slate-500">Revenue distribution by payment type</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    dataKey="value"
                    nameKey="method"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: 'rgba(5, 9, 63, 0.3)' }}
                  >
                    {paymentBreakdown.map((entry, index) => (
                      <Cell key={entry.method} fill={paymentColors[index % paymentColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {paymentBreakdown.map((item, index) => (
                <div key={item.method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} />
                    <span className="text-sm text-slate-600">{item.method}</span>
                  </div>
                  <span className="text-sm font-semibold">{formatMVR(item.value)}</span>
                </div>
              ))}
            </div>
          </motion.section>
        </div>

        {/* Second Row */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Hourly Sales */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-slate-900">Hourly Revenue</h3>
              <p className="text-sm text-slate-500">Revenue distribution across 24 hours</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlySales.filter(h => h.revenue > 0)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(5, 9, 63, 0.1)" />
                  <XAxis dataKey="hour" tick={{ fill: 'rgba(5, 9, 63, 0.7)', fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fill: 'rgba(5, 9, 63, 0.7)', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" fill="#16a34a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.section>

          {/* Category Distribution */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-slate-900">Category Performance</h3>
              <p className="text-sm text-slate-500">Revenue by product category</p>
            </div>
            {categoryData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={categoryData}>
                    <PolarGrid stroke="rgba(5, 9, 63, 0.1)" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: 'rgba(5, 9, 63, 0.7)', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: 'rgba(5, 9, 63, 0.5)', fontSize: 10 }} />
                    <Radar name="Revenue" dataKey="value" stroke="#16a34a" fill="#16a34a" fillOpacity={0.5} />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-72 text-slate-500">
                No category data available yet
              </div>
            )}
          </motion.section>
        </div>

        {/* Third Row */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          {/* Top Products */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Top Selling Products</h3>
                <p className="text-sm text-slate-500">Highest revenue generating items</p>
              </div>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                {topItems.length} products
              </span>
            </div>
            <div className="space-y-3">
              {topItems.map((item: any, index) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-green-200 hover:bg-green-50">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      index < 3 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.quantity} sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatMVR(item.revenue)}</p>
                    <p className="text-xs text-slate-500">{formatMVR(item.price)} each</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Monthly Trend */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-slate-900">Monthly Revenue Trend</h3>
              <p className="text-sm text-slate-500">Revenue performance over time</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySales} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMonthly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#05093f" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#05093f" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(5, 9, 63, 0.1)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(5, 9, 63, 0.7)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'rgba(5, 9, 63, 0.7)', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="amount" stroke="#05093f" fillOpacity={1} fill="url(#colorMonthly)" name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
        </div>

        {/* Bottom Section */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Inventory Alerts */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Inventory Alerts</h3>
                <p className="text-sm text-slate-500">Low stock items requiring attention</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
                {lowStockAlerts.length} alerts
              </span>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {lowStockAlerts.length ? (
                lowStockAlerts.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.quantity} {item.unit} remaining</p>
                    </div>
                    <span className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">
                      Low stock
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <div className="text-center">
                    <Package className="mx-auto h-8 w-8 text-green-500 mb-2" />
                    <p>All inventory levels are healthy</p>
                  </div>
                </div>
              )}
            </div>
          </motion.section>

          {/* Quick Stats */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Business Metrics</h3>
              <p className="text-sm text-slate-500">Key performance indicators</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="text-sm text-slate-500">Total Revenue</p>
                  <p className="text-xl font-bold text-slate-900">{formatMVR(totalRevenue)}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="text-sm text-slate-500">Avg Order Value</p>
                  <p className="text-xl font-bold text-slate-900">{formatMVR(averageOrderValue)}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="text-sm text-slate-500">Total Orders</p>
                  <p className="text-xl font-bold text-slate-900">{bills.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="text-sm text-slate-500">Inventory Value</p>
                  <p className="text-xl font-bold text-slate-900">{formatMVR(inventoryValue)}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </div>
          </motion.section>

          {/* Menu Items */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Active Menu</h3>
                <p className="text-sm text-slate-500">All available products</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {products.length} items
              </span>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {products.slice(0, 8).map((product) => (
                <div key={product.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-200 overflow-hidden">
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.category}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{formatMVR(product.price)}</p>
                </div>
              ))}
              {products.length > 8 && (
                <p className="text-center text-sm text-slate-500 pt-2">
                  + {products.length - 8} more items
                </p>
              )}
              {products.length === 0 && (
                <p className="text-center text-sm text-slate-500 py-8">No menu items available yet</p>
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </AppShell>
  );
}