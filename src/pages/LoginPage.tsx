import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { hasFirebaseConfig } from '../lib/firebase';
import { formatMVR } from '../lib/mvr';
const logo = '/logo.jpeg';
import type { UserRole } from '../types';

const defaultCredentials = {
  admin: { email: '', password: '' },
  cashier: { email: '', password: '' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState(defaultCredentials.admin.email);
  const [password, setPassword] = useState(defaultCredentials.admin.password);
  const [role, setRole] = useState<UserRole>('admin');

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await login(email, password, role);
      navigate(role === 'admin' ? '/admin' : '/pos');
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Login failed', text: (error as Error).message });
    }
  }

  function switchRole(nextRole: UserRole) {
    setRole(nextRole);
    setEmail(defaultCredentials[nextRole].email);
    setPassword(defaultCredentials[nextRole].password);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-900 px-4 py-16 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 rounded-[2rem] border border-slate-800 bg-slate-950/95 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-12">
        <div className="flex flex-col gap-3 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 p-2 shadow-xl shadow-violet-500/30">
            <img src={logo} alt="Loavashi Hub" className="h-full w-full rounded-full object-cover" />
          </div>
          <h1 className="text-4xl font-semibold text-white">Loavashi Hub</h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-400 sm:text-base">
            Modern cafe and restaurant management. Login as admin or cashier to begin.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleLogin} className="space-y-5 rounded-[1.75rem] border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/40">
            <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
              <span>App mode</span>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">{hasFirebaseConfig ? 'Firebase' : 'Demo'}</span>
            </div>

            <div className="space-y-4">
              <label className="block text-sm text-slate-300">
                Email
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-violet-500"
                  placeholder="admin@loavashi.com"
                  autoComplete="username"
                />
              </label>

              <label className="block text-sm text-slate-300">
                Password
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-violet-500"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => switchRole('admin')}
                  className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${role === 'admin' ? 'bg-violet-600 text-white' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                >
                  Admin login
                </button>
                <button
                  type="button"
                  onClick={() => switchRole('cashier')}
                  className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${role === 'cashier' ? 'bg-slate-100 text-slate-950' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                >
                  Cashier login
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-3xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in…' : `Continue as ${role === 'admin' ? 'Admin' : 'Cashier'}`}
            </button>
          </form>

          <div className="space-y-6 rounded-[1.75rem] border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/40">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <h2 className="text-xl font-semibold text-white">MVR Currency Focus</h2>
              <p className="mt-2 text-sm text-slate-400">All sales, reports, receipts and POS totals use Maldivian Rufiyaa.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Revenue example</p>
                <p className="mt-3 text-3xl font-semibold text-white">{formatMVR(1250)}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">POS ready</p>
                <p className="mt-3 text-3xl font-semibold text-white">Modern tablet & desktop UI</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-300">
              <p className="font-semibold text-white">Firebase login required</p>
              <p className="mt-2 text-sm text-slate-400">Enter the Firebase account credentials configured for your app.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
