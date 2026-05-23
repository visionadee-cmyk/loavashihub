import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

const logo = '/logo.jpeg';

const defaultCredentials = {
  admin: { email: 'admin@loavashi.com', password: 'Admin123' },
  cashier: { email: 'cashier@loavashi.com', password: 'Cashier123' },
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 mb-4">
            <img src={logo} alt="Loavashi Hub" className="h-14 w-14 rounded-full object-cover" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Loavashi Hub</h1>
          <p className="text-sm text-slate-400 mt-2">Restaurant Management System</p>
        </div>

        <form onSubmit={handleLogin} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="space-y-4">
            <label className="block text-sm text-slate-300">
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-violet-500"
                placeholder="Enter your email"
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
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => switchRole('admin')}
                className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                  role === 'admin'
                    ? 'bg-violet-600 text-white'
                    : 'bg-transparent text-slate-300 border border-slate-700 hover:bg-slate-800'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => switchRole('cashier')}
                className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                  role === 'cashier'
                    ? 'bg-white text-slate-900'
                    : 'bg-transparent text-slate-300 border border-slate-700 hover:bg-slate-800'
                }`}
              >
                Cashier
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-3xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : `Sign in as ${role === 'admin' ? 'Admin' : 'Cashier'}`}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          © {new Date().getFullYear()} Loavashi Hub. All rights reserved.
        </p>
      </div>
    </div>
  );
}