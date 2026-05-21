import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, hasFirebaseConfig } from '../lib/firebase';
import { demoUsers } from '../data/demo';
import type { AppUser, UserRole } from '../types';

interface AuthContextState {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextState | undefined>(undefined);
const STORAGE_KEY = 'loavashi-user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (error) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  async function login(email: string, password: string, role: UserRole) {
    setLoading(true);
    try {
      if (hasFirebaseConfig && auth) {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          const userData: AppUser = {
            id: email,
            name: role === 'admin' ? 'Loavashi Admin' : 'Cashier User',
            role,
            email,
          };
          setUser(userData);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
          return;
        } catch (error) {
          // If Firebase login fails, fall back to demo credentials for local testing.
          console.warn('Firebase login failed, falling back to demo users.', error);
        }
      }

      const demoUser = demoUsers.find(
        (record) => record.email === email && record.password === password && record.role === role,
      );

      if (!demoUser) {
        throw new Error('Invalid credentials. Use admin@loavashi.com/admin123 or cashier@loavashi.com/cashier123.');
      }

      const userData: AppUser = {
        id: demoUser.email,
        name: demoUser.name,
        role: demoUser.role,
        email: demoUser.email,
      };
      setUser(userData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    if (hasFirebaseConfig && auth) {
      await signOut(auth).catch(() => undefined);
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
