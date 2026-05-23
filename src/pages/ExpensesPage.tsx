import { useEffect, useMemo, useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import AppShell from '../components/AppShell';
import { formatMVR } from '../lib/mvr';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument } from '../lib/firestore';
import type { Expense, MonthlyExpense, StaffMember } from '../types';

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
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [expenseForm, setExpenseForm] = useState<Partial<Expense> & { salaryFrequency?: 'daily' | 'monthly' }>({
    ...defaultExpense,
    salaryFrequency: 'daily',
  });
  const [monthlyForm, setMonthlyForm] = useState(defaultMonthlyExpense);
  const [showDailyForm, setShowDailyForm] = useState(false);
  const [showMonthlyForm, setShowMonthlyForm] = useState(false);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setExpenses([]);
      setMonthlyExpenses([]);
      setStaffMembers([]);
      return;
    }

    Promise.all([
      loadCollection<Expense>('expenses', []),
      loadCollection<MonthlyExpense>('monthlyExpenses', []),
      loadCollection<StaffMember>('staff', []),
    ])
      .then(([loadedExpenses, loadedMonthlyExpenses, loadedStaff]) => {
        if (loadedExpenses.length) setExpenses(loadedExpenses);
        if (loadedMonthlyExpenses.length) setMonthlyExpenses(loadedMonthlyExpenses);
        if (loadedStaff.length) setStaffMembers(loadedStaff);
      })
      .catch((error) => console.error('Failed to load expenses or staff:', error));
  }, []);

  const totalDaily = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);
  const totalMonthly = useMemo(() => monthlyExpenses.reduce((sum, item) => sum + item.amount, 0), [monthlyExpenses]);

  return (
    <AppShell title="Expenses">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_0.85fr]">
        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Daily expense tracker</h3>
              <p className="text-sm text-slate-600">Upload receipts and track purchases by staff.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowDailyForm(!showDailyForm)}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> {showDailyForm ? 'Cancel' : 'Add new expense'}
            </button>
          </div>

          {showDailyForm && (
          <>
          <div className="grid gap-4">
            <label className="block text-sm text-slate-600">
              Title
              <input
                value={expenseForm.title}
                onChange={(event) => setExpenseForm((current) => ({ ...current, title: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-600">
                Amount (MVR)
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, amount: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-600">
                Category
                <select
                  value={expenseForm.category}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                >
                  <option>Daily expenses</option>
                  <option>Salary</option>
                  <option>Purchases</option>
                  <option>Bank</option>
                  <option>Other</option>
                </select>
              </label>
            </div>
            {expenseForm.category === 'Salary' && (
              <div className="grid gap-4 sm:grid-cols-2 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                <label className="block text-sm text-slate-600">
                  Staff member
                  <select
                    value={expenseForm.title || ''}
                    onChange={(event) => setExpenseForm((current) => ({ ...current, title: event.target.value }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                  >
                    <option value="">Select staff...</option>
                    {staffMembers.length > 0 ? (
                      staffMembers.map((staff) => (
                        <option key={staff.id} value={staff.name}>{staff.name} ({staff.designation})</option>
                      ))
                    ) : (
                      <option value="" disabled>No staff members found</option>
                    )}
                  </select>
                </label>
                <label className="block text-sm text-slate-600">
                  Salary frequency
                  <select
                    value={(expenseForm as any).salaryFrequency || 'daily'}
                    onChange={(event) => setExpenseForm((current) => ({ ...current, salaryFrequency: event.target.value as 'daily' | 'monthly' }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                  >
                    <option value="daily">Daily salary</option>
                    <option value="monthly">Monthly salary</option>
                  </select>
                </label>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-600">
                Paid from
                <select
                  value={expenseForm.paidBy}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, paidBy: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                >
                  <option>Daily sales</option>
                  <option>Bank</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="block text-sm text-slate-600">
                Date
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
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
          </>
          )}

          <div className="mt-6 grid gap-4">
            {expenses.map((expense) => (
              <div key={expense.id} className="rounded-3xl border border-slate-200 bg-slate-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{expense.title}</p>
                    <p className="text-sm text-slate-600">{expense.category} • {expense.date}</p>
                  </div>
                  <p className="text-sm font-semibold text-violet-300">{formatMVR(expense.amount)}</p>
                </div>
                <p className="mt-3 text-sm text-slate-600">Paid from {expense.paidBy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Monthly expense plan</h3>
                <p className="text-sm text-slate-600">Record rent, salary and utilities.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{monthlyExpenses.length} entries</span>
                <button
                  type="button"
                  onClick={() => setShowMonthlyForm(!showMonthlyForm)}
                  className="inline-flex items-center gap-2 rounded-3xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  <Plus className="h-4 w-4" /> {showMonthlyForm ? 'Cancel' : 'Add monthly'}
                </button>
              </div>
            </div>

            {showMonthlyForm && (
            <>
            <div className="grid gap-4">
              <label className="block text-sm text-slate-600">
                Title
                <input
                  value={monthlyForm.title}
                  onChange={(event) => setMonthlyForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-600">
                Amount (MVR)
                <input
                  type="number"
                  value={monthlyForm.amount}
                  onChange={(event) => setMonthlyForm((current) => ({ ...current, amount: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-600">
                Category
                <select
                  value={monthlyForm.category}
                  onChange={(event) => setMonthlyForm((current) => ({ ...current, category: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                >
                  <option>Rent</option>
                  <option>Salary</option>
                  <option>Utility bills</option>
                  <option>Visa costs</option>
                  <option>Medical costs</option>
                  <option>Accommodation costs</option>
                </select>
              </label>
              <label className="block text-sm text-slate-600">
                Due month
                <input
                  type="text"
                  value={monthlyForm.dueMonth}
                  onChange={(event) => setMonthlyForm((current) => ({ ...current, dueMonth: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
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
            </>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-100/80 p-6 shadow-2xl shadow-slate-300/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Expense summary</h3>
                <p className="text-sm text-slate-600">Overview of daily and monthly costs.</p>
              </div>
              <div className="space-y-2 text-right">
                <p className="text-sm text-slate-600">Daily total</p>
                <p className="text-2xl font-semibold text-slate-900">{formatMVR(totalDaily)}</p>
                <p className="text-sm text-slate-600">Monthly total</p>
                <p className="text-2xl font-semibold text-violet-300">{formatMVR(totalMonthly)}</p>
              </div>
            </div>
            <div className="grid gap-3">
              {monthlyExpenses.map((record) => (
                <div key={record.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{record.title}</p>
                      <p className="text-sm text-slate-600">{record.category} · {record.dueMonth}</p>
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
