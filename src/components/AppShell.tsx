import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LogOut, LayoutDashboard, ShoppingCart, ShoppingBag, Coffee, Table, Users2, ClipboardList, Box, Layers, BookOpen, BarChart3, Clock, CheckCircle2, ListChecks, Menu, X, DollarSign, Package, Brain, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
const logo = '/logo.jpeg';

const adminNav = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/menu', label: 'Menu items', icon: Coffee },
  { path: '/bills/pending', label: 'Open bills', icon: Clock },
  { path: '/bills/completed', label: 'Completed bills', icon: CheckCircle2 },
  { path: '/admin/tables', label: 'Tables', icon: Table },
  { path: '/admin/staff', label: 'Staff', icon: Users2 },
  { path: '/admin/inventory', label: 'Consumables', icon: Box },
  { path: '/admin/purchases', label: 'RFQ & Purchase', icon: ShoppingBag },
  { path: '/admin/suppliers', label: 'Suppliers', icon: Users2 },
  { path: '/admin/direct-purchase', label: 'Direct Purchase', icon: ShoppingCart },
  { path: '/admin/daily-direct-revenue', label: 'Daily direct revenue', icon: DollarSign },
  { path: '/admin/purchase-history', label: 'Purchase History', icon: History },
  { path: '/admin/inventory-update', label: 'Inventory Count', icon: ListChecks },
  { path: '/admin/recipes', label: 'Recipes', icon: BookOpen },
  { path: '/admin/assets', label: 'Assets', icon: Layers },
  { path: '/admin/expenses', label: 'Expenses', icon: ClipboardList },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { path: '/admin/smart-analytics', label: 'Smart Analytics', icon: Brain },
];

const cashierNav = [
  { path: '/pos', label: 'POS', icon: ShoppingCart },
  { path: '/bills/pending', label: 'Open bills', icon: Clock },
  { path: '/bills/completed', label: 'Completed bills', icon: CheckCircle2 },
  { path: '/stock-on-hand', label: 'Stock on Hand', icon: Package },
  { path: '/admin/inventory-update', label: 'Inventory count', icon: ListChecks },
];

interface AppShellProps {
  title: string;
  children: React.ReactNode;
}

export default function AppShell({ title, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navItems = user?.role === 'admin' ? adminNav : cashierNav;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <div className={`fixed inset-0 z-30 bg-slate-900/40 transition-opacity md:hidden ${sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`fixed inset-y-0 left-0 w-64 transform bg-white border-r border-slate-200 p-4 z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Loavashi Hub" className="h-9 w-9 rounded-full border" />
            <div>
              <p className="text-sm font-semibold">Loavashi Hub</p>
              <p className="text-xs text-slate-500">{user?.role === 'admin' ? 'Admin' : 'Cashier'}</p>
            </div>
          </div>
          <button className="md:hidden p-2" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    isActive ? 'bg-[rgb(22_163_74)] text-white' : 'text-[#05093f] hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="h-4 w-4 text-current" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="md:ml-64 min-h-screen flex flex-col">
        <header className="px-4 py-5 sm:px-6 md:px-8 md:py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen((s) => !s)} className="md:hidden inline-flex items-center justify-center rounded-full p-2 bg-white border border-slate-200">
              <Menu className="h-5 w-5 text-slate-700" />
            </button>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{user?.role === 'admin' ? 'Admin' : 'Cashier / POS'}</p>
              <h2 className="text-3xl font-semibold text-slate-900">{title}</h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            <span className="rounded-2xl bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-700">{user?.role === 'admin' ? 'Admin access' : 'Cashier access'}</span>
            <span>{user?.email}</span>
            {user?.role !== 'admin' ? (
              <Link
                to="/pos"
                className="inline-flex items-center gap-2 rounded-3xl border border-orange-500 bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-400"
              >
                Open POS
              </Link>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-3xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 md:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            {children}
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white/70 px-4 py-4 text-slate-600 md:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Loavashi Hub" className="h-10 w-10 rounded-full border border-slate-200 object-cover" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Loavashi Hub</p>
                <p className="text-xs text-slate-500">Cafe management for POS, inventory, purchases and operations.</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Built for Maldivian restaurant workflows · {new Date().getFullYear()}</p>
          </div>
        </footer>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex max-w-4xl items-center justify-around bg-white px-4 py-3 shadow-t md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-xs transition ${
                  isActive ? 'text-[rgb(22_163_74)]' : 'text-[#05093f] hover:text-[#05093f]/80'
                }`
              }
            >
              <Icon className="h-5 w-5 text-current" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
