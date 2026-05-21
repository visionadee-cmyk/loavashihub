import { useEffect, useMemo, useState } from 'react';
import { Plus, Receipt, Upload } from 'lucide-react';
import AppShell from '../components/AppShell';
import { demoExpenses, demoMonthlyExpenses } from '../data/demo';
import { formatMVR } from '../lib/mvr';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import type { Expense, MonthlyExpense } from '../types';

const defaultExpense: Partial<Expense> = {
  title: '',
  amount: 0,
  category: 'Daily expenses',
  paidBy: 'Daily sales',
  date: new Date().toISOString().slice(0, 10),
};

const defaultMonthlyExpense: Partial<MonthlyExpense> = {
  title: '',
  amount: 0,
  category: 'Rent',
  dueMonth: 'May 2026',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([]);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setExpenses(demoExpenses);
      setMonthlyExpenses(demoMonthlyExpenses);
      return;
    }

    loadCollection<Expense>('expenses', [])
      .then((items) => { if (items.length) setExpenses(items); })
      .catch((error) => console.error('Failed to load expenses:', error));

    loadCollection<MonthlyExpense>('monthlyExpenses', [])
      .then((items) => { if (items.length) setMonthlyExpenses(items); })
      .catch((error) => console.error('Failed to load monthly expenses:', error));
  }, []);
  const [expenseForm, setExpenseForm] = useState(defaultExpense);
  const [monthlyForm, setMonthlyForm] = useState(defaultMonthlyExpense);

  const totalDaily = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);
  const totalMonthly = useMemo(() => monthlyExpenses.reduce((sum, item) => sum + item.amount, 0), [monthlyExpenses]);

  return (
    <AppShell title="Expenses">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_0.85fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Daily expense tracker</h3>
              <p className="text-sm text-slate-400">Upload receipts and track purchases by staff.</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500">
              <Upload className="h-4 w-4" /> Upload receipt
            </button>
          </div>

          <div className="grid gap-4">
            <label className="block text-sm text-slate-300">
              Title
              <input
                value={expenseForm.title}
                onChange={(event) => setExpenseForm((current) => ({ ...current, title: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Amount (MVR)
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, amount: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Category
                <select
                  value={expenseForm.category}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                >
                  <option>Daily expenses</option>
                  <option>Purchases</option>
                  <option>Bank</option>
                  <option>Other</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Paid from
                <select
                  value={expenseForm.paidBy}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, paidBy: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                >
                  <option>Daily sales</option>
                  <option>Bank</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Date
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                  const newExpense = {
                    id: `exp-${Date.now()}`,
                    title: expenseForm.title || 'New expense',
                    amount: expenseForm.amount || 0,
                    category: expenseForm.category || 'Daily expenses',
                    paidBy: expenseForm.paidBy || 'Daily sales',
                    date: expenseForm.date || new Date().toISOString().slice(0, 10),
                  } as Expense;

                  setExpenses((current) => [newExpense, ...current]);
                  setExpenseForm(defaultExpense);

                  if (hasFirebaseConfig) {
                    saveDocument('expenses', newExpense.id, newExpense).catch((error) => console.error('Failed to save expense:', error));
                  }
                }}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> Add expense
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            {expenses.map((expense) => (
              <div key={expense.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{expense.title}</p>
                    <p className="text-sm text-slate-400">{expense.category} • {expense.date}</p>
                  </div>
                  <p className="text-sm font-semibold text-violet-300">{formatMVR(expense.amount)}</p>
                </div>
                <p className="mt-3 text-sm text-slate-400">Paid from {expense.paidBy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Monthly expense plan</h3>
                <p className="text-sm text-slate-400">Record rent, salary and utilities.</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{monthlyExpenses.length} entries</span>
            </div>

            <div className="grid gap-4">
              <label className="block text-sm text-slate-300">
                Title
                <input
                  value={monthlyForm.title}
                  onChange={(event) => setMonthlyForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Amount (MVR)
                <input
                  type="number"
                  value={monthlyForm.amount}
                  onChange={(event) => setMonthlyForm((current) => ({ ...current, amount: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Category
                <select
                  value={monthlyForm.category}
                  onChange={(event) => setMonthlyForm((current) => ({ ...current, category: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                >
                  <option>Rent</option>
                  <option>Salary</option>
                  <option>Utility bills</option>
                  <option>Visa costs</option>
                  <option>Medical costs</option>
                  <option>Accommodation costs</option>
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Due month
                <input
                  type="text"
                  value={monthlyForm.dueMonth}
                  onChange={(event) => setMonthlyForm((current) => ({ ...current, dueMonth: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const newMonthly = {
                    id: `monthly-${Date.now()}`,
                    title: monthlyForm.title || 'Monthly expense',
                    amount: monthlyForm.amount || 0,
                    category: monthlyForm.category || 'Rent',
                    dueMonth: monthlyForm.dueMonth || 'May 2026',
                  } as MonthlyExpense;

                  setMonthlyExpenses((current) => [newMonthly, ...current]);
                  setMonthlyForm(defaultMonthlyExpense);

                  if (hasFirebaseConfig) {
                    saveDocument('monthlyExpenses', newMonthly.id, newMonthly).catch((error) => console.error('Failed to save monthly expense:', error));
                  }
                }}
                className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
              >
                <Receipt className="h-4 w-4" /> Add monthly expense
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Expense summary</h3>
                <p className="text-sm text-slate-400">Overview of daily and monthly costs.</p>
              </div>
              <div className="space-y-2 text-right">
                <p className="text-sm text-slate-400">Daily total</p>
                <p className="text-2xl font-semibold text-white">{formatMVR(totalDaily)}</p>
                <p className="text-sm text-slate-400">Monthly total</p>
                <p className="text-2xl font-semibold text-violet-300">{formatMVR(totalMonthly)}</p>
              </div>
            </div>
            <div className="grid gap-3">
              {monthlyExpenses.map((record) => (
                <div key={record.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{record.title}</p>
                      <p className="text-sm text-slate-400">{record.category} · {record.dueMonth}</p>
                    </div>
                    <p className="text-sm font-semibold text-violet-300">{formatMVR(record.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
