import { Link, NavLink } from 'react-router-dom';
import { LogOut, LayoutDashboard, ShoppingCart, ShoppingBag, Coffee, Table, Users2, ClipboardList, Box, Layers, BookOpen, BarChart3, FileText, Clock, CheckCircle2 } from 'lucide-react';
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
  { path: '/admin/purchases', label: 'Purchases', icon: ShoppingBag },
  { path: '/admin/recipes', label: 'Recipes', icon: BookOpen },
  { path: '/admin/assets', label: 'Assets', icon: Layers },
  { path: '/admin/expenses', label: 'Expenses', icon: ClipboardList },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

const cashierNav = [
  { path: '/pos', label: 'POS', icon: ShoppingCart },
  { path: '/bills/pending', label: 'Open bills', icon: Clock },
  { path: '/bills/completed', label: 'Completed bills', icon: CheckCircle2 },
  { path: '/admin/reports', label: 'Reports', icon: FileText },
];

interface AppShellProps {
  title: string;
  children: React.ReactNode;
}

export default function AppShell({ title, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const navItems = user?.role === 'admin' ? adminNav : cashierNav;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="md:flex">
        <aside className="hidden md:flex md:w-72 md:flex-col md:border-r md:border-slate-800 md:bg-slate-900 md:px-6 md:py-6">
          <div className="mb-10 flex items-center gap-3 border-b border-slate-800 pb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 p-2 shadow-lg shadow-violet-500/20">
              <img src={logo} alt="Loavashi Hub" className="h-full w-full rounded-full object-cover" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Loavashi Hub</p>
              <h1 className="text-xl font-semibold">{user?.name}</h1>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-medium transition ${
                      isActive ? 'bg-slate-800 text-white shadow-lg shadow-slate-900/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-slate-800 pt-6">
            <button
              onClick={logout}
              className="flex w-full items-center justify-between rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-700 hover:bg-slate-800"
            >
              <span>Sign out</span>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <main className="flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Admin / POS</p>
              <h2 className="text-3xl font-semibold text-white">{title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300 shadow-xl shadow-slate-900/30">
              <span className="rounded-2xl bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{user?.role === 'admin' ? 'Admin access' : 'Cashier access'}</span>
              <span>{user?.email}</span>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-slate-900/20 backdrop-blur-xl">
            {children}
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-800 bg-slate-950/80 px-4 py-4 text-slate-400 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Loavashi Hub" className="h-10 w-10 rounded-full border border-slate-800 object-cover" />
            <div>
              <p className="text-sm font-semibold text-white">Loavashi Hub</p>
              <p className="text-xs text-slate-500">Cafe management for POS, inventory, purchases and operations.</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Built for Maldivian restaurant workflows · {new Date().getFullYear()}</p>
        </div>
      </footer>

      <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex max-w-4xl items-center justify-around bg-slate-950 px-4 py-3 text-slate-300 shadow-t md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.path} to={item.path} className="flex flex-col items-center gap-1 text-xs hover:text-white">
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
