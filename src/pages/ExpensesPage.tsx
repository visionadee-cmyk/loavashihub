import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit3, X, Check } from 'lucide-react';
import AppShell from '../components/AppShell';
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
  const [expenseForm, setExpenseForm] = useState<Partial<Expense> & { salaryFrequency?: 'daily' | 'monthly' }>({
    ...defaultExpense,
    salaryFrequency: 'daily',
  });
  const [monthlyForm, setMonthlyForm] = useState(defaultMonthlyExpense);
  const [showDailyForm, setShowDailyForm] = useState(false);
  const [showMonthlyForm, setShowMonthlyForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMonthlyId, setEditingMonthlyId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setExpenses([]);
      setMonthlyExpenses([]);
      return;
    }

    Promise.all([
      loadCollection<Expense>('expenses', []),
      loadCollection<MonthlyExpense>('monthlyExpenses', []),
    ])
      .then(([loadedExpenses, loadedMonthlyExpenses]) => {
        if (loadedExpenses.length) setExpenses(loadedExpenses);
        if (loadedMonthlyExpenses.length) setMonthlyExpenses(loadedMonthlyExpenses);
      })
      .catch((error) => console.error('Failed to load expenses:', error));
  }, []);

  const totalDaily = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);
  const totalMonthly = useMemo(() => monthlyExpenses.reduce((sum, item) => sum + item.amount, 0), [monthlyExpenses]);

  // Group expenses by day
  const groupedByDay = useMemo(() => {
    const grouped: { [key: string]: Expense[] } = {};
    [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach((expense) => {
      if (!grouped[expense.date]) grouped[expense.date] = [];
      grouped[expense.date].push(expense);
    });
    return grouped;
  }, [expenses]);

  // Group monthly expenses by month
  const groupedMonthly = useMemo(() => {
    const grouped: { [key: string]: MonthlyExpense[] } = {};
    monthlyExpenses.forEach((expense) => {
      if (!grouped[expense.dueMonth]) grouped[expense.dueMonth] = [];
      grouped[expense.dueMonth].push(expense);
    });
    return grouped;
  }, [monthlyExpenses]);

  const saveDailyExpense = async () => {
    if (!expenseForm.title || !expenseForm.amount) return;

    const expenseData = {
      id: editingId || `exp-${Date.now()}`,
      title: expenseForm.title,
      amount: expenseForm.amount,
      category: expenseForm.category || 'Daily expenses',
      paidBy: expenseForm.paidBy || 'Daily sales',
      date: expenseForm.date || new Date().toISOString().slice(0, 10),
    } as Expense;

    setExpenses((current) => {
      if (editingId) {
        return current.map((e) => (e.id === editingId ? expenseData : e));
      }
      return [expenseData, ...current];
    });

    if (hasFirebaseConfig) {
      try {
        await saveDocument('expenses', expenseData.id, expenseData);
      } catch (error) {
        console.error('Failed to save expense:', error);
      }
    }

    setExpenseForm(defaultExpense);
    setEditingId(null);
    setShowDailyForm(false);
  };

  const deleteExpense = async (id: string) => {
    setExpenses((current) => current.filter((e) => e.id !== id));
    if (hasFirebaseConfig) {
      try {
        await deleteDocument('expenses', id);
      } catch (error) {
        console.error('Failed to delete expense:', error);
      }
    }
  };

  const beginEditExpense = (expense: Expense) => {
    setEditingId(expense.id);
    setExpenseForm(expense);
    setShowDailyForm(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setExpenseForm(defaultExpense);
    setShowDailyForm(false);
  };

  const saveMonthlyExpense = async () => {
    if (!monthlyForm.title || !monthlyForm.amount) return;

    const monthlyData = {
      id: editingMonthlyId || `monthly-${Date.now()}`,
      title: monthlyForm.title,
      amount: monthlyForm.amount,
      category: monthlyForm.category || 'Rent',
      dueMonth: monthlyForm.dueMonth || 'May 2026',
    } as MonthlyExpense;

    setMonthlyExpenses((current) => {
      if (editingMonthlyId) {
        return current.map((e) => (e.id === editingMonthlyId ? monthlyData : e));
      }
      return [monthlyData, ...current];
    });

    if (hasFirebaseConfig) {
      try {
        await saveDocument('monthlyExpenses', monthlyData.id, monthlyData);
      } catch (error) {
        console.error('Failed to save monthly expense:', error);
      }
    }

    setMonthlyForm(defaultMonthlyExpense);
    setEditingMonthlyId(null);
    setShowMonthlyForm(false);
  };

  const deleteMonthlyExpense = async (id: string) => {
    setMonthlyExpenses((current) => current.filter((e) => e.id !== id));
    if (hasFirebaseConfig) {
      try {
        await deleteDocument('monthlyExpenses', id);
      } catch (error) {
        console.error('Failed to delete monthly expense:', error);
      }
    }
  };

  const beginEditMonthly = (expense: MonthlyExpense) => {
    setEditingMonthlyId(expense.id);
    setMonthlyForm(expense);
    setShowMonthlyForm(true);
  };

  const cancelEditMonthly = () => {
    setEditingMonthlyId(null);
    setMonthlyForm(defaultMonthlyExpense);
    setShowMonthlyForm(false);
  };

  return (
    <AppShell title="Expenses">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_0.85fr]">
        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Daily expense tracker</h3>
              <p className="text-sm text-slate-600">Track daily purchases separated by date.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setExpenseForm(defaultExpense);
                setShowDailyForm(!showDailyForm);
              }}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> {showDailyForm ? 'Cancel' : 'Add new expense'}
            </button>
          </div>

          {showDailyForm && (
            <>
              <div className="mb-6 rounded-3xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">{editingId ? 'Edit Expense' : 'New Expense'}</p>
              </div>
              <div className="grid gap-4 mb-6">
                <label className="block text-sm text-slate-600">
                  Title
                  <input
                    value={expenseForm.title || ''}
                    onChange={(e) => setExpenseForm((current) => ({ ...current, title: e.target.value }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-600">
                    Amount (MVR)
                    <input
                      type="number"
                      value={expenseForm.amount || 0}
                      onChange={(e) => setExpenseForm((current) => ({ ...current, amount: Number(e.target.value) }))}
                      className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                  <label className="block text-sm text-slate-600">
                    Category
                    <select
                      value={expenseForm.category || 'Daily expenses'}
                      onChange={(e) => setExpenseForm((current) => ({ ...current, category: e.target.value }))}
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-600">
                    Paid from
                    <select
                      value={expenseForm.paidBy || 'Daily sales'}
                      onChange={(e) => setExpenseForm((current) => ({ ...current, paidBy: e.target.value }))}
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
                      value={expenseForm.date || ''}
                      onChange={(e) => setExpenseForm((current) => ({ ...current, date: e.target.value }))}
                      className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveDailyExpense}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
                  >
                    <Check className="h-4 w-4" /> {editingId ? 'Update' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-3xl bg-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                  >
                    <X className="h-4 w-4" /> Cancel
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="space-y-6">
            {Object.entries(groupedByDay).length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-8">No expenses yet</p>
            ) : (
              Object.entries(groupedByDay).map(([date, dayExpenses]) => {
                const dayTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
                return (
                  <div key={date}>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="font-semibold text-slate-900">
                        {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </h4>
                      <span className="text-sm font-semibold text-violet-600">{formatMVR(dayTotal)}</span>
                    </div>
                    <div className="space-y-2">
                      {dayExpenses.map((expense) => (
                        <div key={expense.id} className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{expense.title}</p>
                            <p className="text-xs text-slate-500">{expense.category}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{formatMVR(expense.amount)}</span>
                            <button
                              onClick={() => beginEditExpense(expense)}
                              className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteExpense(expense.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Monthly expense plan</h3>
                <p className="text-sm text-slate-600">Record rent, salary and utilities.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingMonthlyId(null);
                  setMonthlyForm(defaultMonthlyExpense);
                  setShowMonthlyForm(!showMonthlyForm);
                }}
                className="inline-flex items-center gap-2 rounded-3xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" /> {showMonthlyForm ? 'Cancel' : 'Add monthly'}
              </button>
            </div>

            {showMonthlyForm && (
              <>
                <div className="mb-6 rounded-3xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">{editingMonthlyId ? 'Edit Monthly Expense' : 'New Monthly Expense'}</p>
                </div>
                <div className="grid gap-4 mb-6">
                  <label className="block text-sm text-slate-600">
                    Title
                    <input
                      value={monthlyForm.title || ''}
                      onChange={(e) => setMonthlyForm((current) => ({ ...current, title: e.target.value }))}
                      className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                  <label className="block text-sm text-slate-600">
                    Amount (MVR)
                    <input
                      type="number"
                      value={monthlyForm.amount || 0}
                      onChange={(e) => setMonthlyForm((current) => ({ ...current, amount: Number(e.target.value) }))}
                      className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                  <label className="block text-sm text-slate-600">
                    Category
                    <select
                      value={monthlyForm.category || 'Rent'}
                      onChange={(e) => setMonthlyForm((current) => ({ ...current, category: e.target.value }))}
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
                      value={monthlyForm.dueMonth || ''}
                      onChange={(e) => setMonthlyForm((current) => ({ ...current, dueMonth: e.target.value }))}
                      className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveMonthlyExpense}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
                    >
                      <Check className="h-4 w-4" /> {editingMonthlyId ? 'Update' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditMonthly}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-3xl bg-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                    >
                      <X className="h-4 w-4" /> Cancel
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="rounded-3xl border border-slate-200 bg-slate-100/80 p-6 mb-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h4 className="font-semibold text-slate-900">Summary</h4>
                <div className="space-y-2 text-right">
                  <p className="text-sm text-slate-600">Daily total</p>
                  <p className="text-xl font-bold text-slate-900">{formatMVR(totalDaily)}</p>
                  <p className="text-sm text-slate-600">Monthly total</p>
                  <p className="text-xl font-bold text-violet-600">{formatMVR(totalMonthly)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(groupedMonthly).length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8">No monthly expenses yet</p>
              ) : (
                Object.entries(groupedMonthly).map(([month, monthExpenses]) => {
                  const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
                  return (
                    <div key={month}>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="font-semibold text-slate-900 text-sm">{month}</h4>
                        <span className="text-sm font-semibold text-violet-600">{formatMVR(monthTotal)}</span>
                      </div>
                      <div className="space-y-2">
                        {monthExpenses.map((expense) => (
                          <div key={expense.id} className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">{expense.title}</p>
                              <p className="text-xs text-slate-500">{expense.category}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">{formatMVR(expense.amount)}</span>
                              <button
                                onClick={() => beginEditMonthly(expense)}
                                className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition"
                                title="Edit"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteMonthlyExpense(expense.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
