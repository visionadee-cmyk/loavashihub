import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { CardPayment, DailyDirectRevenue, DirectPurchase, DirectPurchaseItem, Expense } from '../types';

const initialCashCounts = {
  fiftyLari: 0,
  oneRf: 0,
  twoRf: 0,
  note5: 0,
  note10: 0,
  note20: 0,
  note50: 0,
  note100: 0,
  note500: 0,
  note1000: 0,
};

const defaultPaymentTypes = ['Visa debit', 'Visa', 'Master debit', 'Amex debit', 'Transfer'];

const createDefaultCardPayments = (): CardPayment[] => {
  return defaultPaymentTypes.map((type, index) => ({
    id: `card-${Date.now()}-${index}`,
    type,
    amount: 0,
  }));
};

function computeCashTotal(cash: typeof initialCashCounts) {
  return (
    cash.fiftyLari * 50 +
    cash.oneRf * 1 +
    cash.twoRf * 2 +
    cash.note5 * 5 +
    cash.note10 * 10 +
    cash.note20 * 20 +
    cash.note50 * 50 +
    cash.note100 * 100 +
    cash.note500 * 500 +
    cash.note1000 * 1000
  );
}

export default function DailyDirectRevenuePage() {
  const [entries, setEntries] = useState<DailyDirectRevenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [directPurchases, setDirectPurchases] = useState<DirectPurchase[]>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    closedBy: '',
    openingPettyCash: 0,
    closingPettyCash: 0,
    vikuraAmount: 0,
    purchasedFromCashDrawer: 0,
    dailySalary: 0,
    cashCounts: { ...initialCashCounts },
    cardPayments: createDefaultCardPayments(),
    cashDrawerPurchases: [] as Array<{
      id: string;
      shopName: string;
      items: DirectPurchaseItem[];
      amount: number;
    }>,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [hasManuallyChangedDrawer, setHasManuallyChangedDrawer] = useState(false);
  const [hasManuallyChangedSalary, setHasManuallyChangedSalary] = useState(false);
  const [hasManuallyChangedOpeningFloat, setHasManuallyChangedOpeningFloat] = useState(false);

  useEffect(() => {
    if (!hasFirebaseConfig) return;

    Promise.all([
      loadCollection<DailyDirectRevenue>('dailyDirectRevenue', []),
      loadCollection<Expense>('expenses', []),
      loadCollection<DirectPurchase>('directPurchases', []),
    ])
      .then(([revenueData, expenseData, directPurchaseData]) => {
        if (revenueData.length) setEntries(revenueData);
        if (expenseData.length) setExpenses(expenseData);
        if (directPurchaseData.length) setDirectPurchases(directPurchaseData);
      })
      .catch((error) => console.error('Failed to load daily direct revenue data:', error));
  }, []);

  // Prefill opening petty cash from the most recent previous entry's closing float
  useEffect(() => {
    if (!showForm) return;
    if (editingId) return; // don't override when editing
    if (hasManuallyChangedOpeningFloat) return; // respect manual changes

    // find latest entry with date < form.date
    const prev = [...entries]
      .filter((e) => e.date < form.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (prev && prev.closingPettyCash !== undefined && (form.openingPettyCash === 0 || form.openingPettyCash === null)) {
      setForm((current) => ({ ...current, openingPettyCash: prev.closingPettyCash ?? 0 }));
    }
  }, [showForm, form.date, entries, editingId, hasManuallyChangedOpeningFloat]);

  const cashTotal = useMemo(() => computeCashTotal(form.cashCounts), [form.cashCounts]);
  const cardTotal = useMemo(
    () => form.cardPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0),
    [form.cardPayments],
  );
  const vikuraAmount = form.vikuraAmount || 0;
  const totalDirectRevenue = useMemo(
    () => cashTotal + cardTotal + (form.purchasedFromCashDrawer || 0),
    [cashTotal, cardTotal, form.purchasedFromCashDrawer],
  );

  const directPurchaseDrawerTotal = useMemo(
    () => directPurchases
      .filter((purchase) => purchase.date === form.date)
      .reduce((sum, purchase) => sum + purchase.total, 0),
    [directPurchases, form.date],
  );

  const expenseSalaryTotal = useMemo(
    () => expenses
      .filter((expense) => expense.date === form.date && expense.category === 'Salary')
      .reduce((sum, expense) => sum + expense.amount, 0),
    [expenses, form.date],
  );

  const updateCashCount = (field: keyof typeof initialCashCounts, value: number) => {
    setForm((current) => ({
      ...current,
      cashCounts: { ...current.cashCounts, [field]: value },
    }));
  };

  const addCardPayment = () => {
    // Generate a new payment type name (e.g., "Other 1", "Other 2", etc.)
    const existingOtherPayments = form.cardPayments.filter((p) => p.type.startsWith('Other '));
    const nextNumber = existingOtherPayments.length + 1;
    
    setForm((current) => ({
      ...current,
      cardPayments: [
        ...current.cardPayments,
        { id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: `Other ${nextNumber}`, amount: 0 },
      ],
    }));
  };

  const updateCardPayment = (id: string, field: keyof CardPayment, value: string | number) => {
    setForm((current) => ({
      ...current,
      cardPayments: current.cardPayments.map((payment) =>
        payment.id !== id ? payment : { ...payment, [field]: field === 'amount' ? Number(value) : value },
      ),
    }));
  };

  const removeCardPayment = (id: string) => {
    setForm((current) => ({
      ...current,
      cardPayments: current.cardPayments.filter((payment) => payment.id !== id),
    }));
  };

  const addCashDrawerPurchase = () => {
    setForm((current) => ({
      ...current,
      cashDrawerPurchases: [
        ...current.cashDrawerPurchases,
        {
          id: `cashpurch-${Date.now()}`,
          shopName: '',
          items: [],
          amount: 0,
        },
      ],
    }));
  };

  const removeCashDrawerPurchase = (id: string) => {
    setForm((current) => ({
      ...current,
      cashDrawerPurchases: current.cashDrawerPurchases.filter((p) => p.id !== id),
    }));
  };

  const updateCashDrawerPurchase = (
    id: string,
    field: 'shopName' | 'amount',
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      cashDrawerPurchases: current.cashDrawerPurchases.map((p) =>
        p.id !== id ? p : { ...p, [field]: value },
      ),
    }));
  };

  const addItemToPurchase = (purchaseId: string) => {
    setForm((current) => ({
      ...current,
      cashDrawerPurchases: current.cashDrawerPurchases.map((p) =>
        p.id !== purchaseId
          ? p
          : {
              ...p,
              items: [
                ...p.items,
                {
                  id: `item-${Date.now()}`,
                  productName: '',
                  quantity: 1,
                  unit: 'pcs',
                  unitCost: 0,
                  totalCost: 0,
                },
              ],
            },
        ),
    }));
  };

  const updatePurchaseItem = (
    purchaseId: string,
    itemId: string,
    field: 'productName' | 'quantity' | 'unit' | 'unitCost',
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      cashDrawerPurchases: current.cashDrawerPurchases.map((p) =>
        p.id !== purchaseId
          ? p
          : {
              ...p,
              items: p.items.map((item) => {
                if (item.id !== itemId) return item;
                const updated = { ...item, [field]: value };
                if (field === 'quantity' || field === 'unitCost') {
                  updated.totalCost = (updated.quantity as number) * (updated.unitCost as number);
                }
                return updated;
              }),
            },
        ),
    }));
  };

  const removeItemFromPurchase = (purchaseId: string, itemId: string) => {
    setForm((current) => ({
      ...current,
      cashDrawerPurchases: current.cashDrawerPurchases.map((p) =>
        p.id !== purchaseId ? p : { ...p, items: p.items.filter((i) => i.id !== itemId) },
      ),
    }));
  };

  const saveRevenue = async () => {
    if (!form.closedBy.trim() || totalDirectRevenue <= 0) return;

    const existingEntry = entries.find((entry) => entry.id === editingId);
    const payload: DailyDirectRevenue = {
      id: editingId ?? `directrev-${Date.now()}`,
      date: form.date,
      closedBy: form.closedBy.trim(),
      openingPettyCash: form.openingPettyCash,
      closingPettyCash: form.closingPettyCash,
      dailySalary: form.dailySalary,
      vikuraAmount: form.vikuraAmount,
      purchasedFromCashDrawer: form.purchasedFromCashDrawer,
      cashCounts: { ...form.cashCounts },
      cardPayments: form.cardPayments.filter((payment) => payment.amount > 0),
      cashTotal,
      cardTotal,
      totalDirectRevenue,
      createdAt: existingEntry?.createdAt ?? new Date().toISOString(),
    };

    setSaving(true);
    try {
      await saveDocument('dailyDirectRevenue', payload.id, payload);
      
      // Save cash drawer purchases as DirectPurchase entries
      const newDirectPurchases: DirectPurchase[] = [];
      for (const purchase of form.cashDrawerPurchases) {
        if (purchase.shopName.trim() && purchase.items.length > 0) {
          const directPurchasePayload: DirectPurchase = {
            id: `directpurch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            shopName: purchase.shopName.trim(),
            items: purchase.items.filter((item) => item.productName.trim() && item.totalCost > 0),
            gst: 0,
            subtotal: purchase.items.reduce((sum, item) => sum + (item.totalCost || 0), 0),
            total: purchase.items.reduce((sum, item) => sum + (item.totalCost || 0), 0),
            date: form.date,
          };
          try {
            await saveDocument('directPurchases', directPurchasePayload.id, directPurchasePayload);
            newDirectPurchases.push(directPurchasePayload);
          } catch (error) {
            console.error('Failed to save direct purchase:', error);
          }
        }
      }

      if (newDirectPurchases.length > 0) {
        setDirectPurchases((current) => [...current, ...newDirectPurchases]);
      }

      setEntries((current) => {
        if (editingId) {
          return current.map((entry) => (entry.id === editingId ? payload : entry));
        }
        return [payload, ...current];
      });
      setForm({
        date: new Date().toISOString().slice(0, 10),
        closedBy: '',
        openingPettyCash: 0,
        closingPettyCash: 0,
        vikuraAmount: 0,
        purchasedFromCashDrawer: 0,
        dailySalary: 0,
        cashCounts: { ...initialCashCounts },
        cardPayments: createDefaultCardPayments(),
        cashDrawerPurchases: [],
      });
      setHasManuallyChangedOpeningFloat(false);
      setEditingId(null);
    } catch (error) {
      console.error('Failed to save direct revenue entry:', error);
    } finally {
      setSaving(false);
    }
  };

  const beginEditEntry = (entry: DailyDirectRevenue) => {
    setEditingId(entry.id);
    setHasManuallyChangedDrawer(true);
    setHasManuallyChangedSalary(true);
    // Preserve existing card payments but ensure all default types are present
    const existingPayments = entry.cardPayments || [];
    const defaultPayments = createDefaultCardPayments();
    
    // Merge existing payments with defaults, updating amounts for existing types
    const mergedPayments = defaultPayments.map((defaultPayment) => {
      const existing = existingPayments.find((p) => p.type === defaultPayment.type);
      return existing ? { ...existing, id: existing.id } : defaultPayment;
    });
    
    // Add any extra payment types from the entry that aren't in defaults
    const extraPayments = existingPayments.filter((p) => !defaultPaymentTypes.includes(p.type));
    
    setForm({
      date: entry.date,
      closedBy: entry.closedBy,
      openingPettyCash: (entry as any).openingPettyCash || 0,
      closingPettyCash: (entry as any).closingPettyCash || 0,
      vikuraAmount: (entry as any).vikuraAmount || 0,
      purchasedFromCashDrawer: (entry as any).purchasedFromCashDrawer || 0,
      dailySalary: (entry as any).dailySalary || 0,
      cashCounts: { ...entry.cashCounts },
      cardPayments: [...mergedPayments, ...extraPayments],
      cashDrawerPurchases: [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setHasManuallyChangedDrawer(false);
    setHasManuallyChangedSalary(false);
    setHasManuallyChangedOpeningFloat(false);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      closedBy: '',
      openingPettyCash: 0,
      closingPettyCash: 0,
      vikuraAmount: 0,
      purchasedFromCashDrawer: 0,
      dailySalary: 0,
      cashCounts: { ...initialCashCounts },
      cardPayments: createDefaultCardPayments(),
      cashDrawerPurchases: [],
    });
  };

  // Group entries by date and calculate daily totals
  const groupedEntries = useMemo(() => {
    const grouped: { [key: string]: DailyDirectRevenue[] } = {};
    const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    sortedEntries.forEach((entry) => {
      if (!grouped[entry.date]) {
        grouped[entry.date] = [];
      }
      grouped[entry.date].push(entry);
    });
    
    return grouped;
  }, [entries]);

  useEffect(() => {
    if (!hasManuallyChangedDrawer) {
      setForm((current) => ({
        ...current,
        purchasedFromCashDrawer: directPurchaseDrawerTotal,
      }));
    }
  }, [directPurchaseDrawerTotal, hasManuallyChangedDrawer]);

  useEffect(() => {
    if (!hasManuallyChangedSalary) {
      setForm((current) => ({
        ...current,
        dailySalary: expenseSalaryTotal,
      }));
    }
  }, [expenseSalaryTotal, hasManuallyChangedSalary]);

  const deleteEntry = async (id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (!hasFirebaseConfig) return;

    try {
      await deleteDocument('dailyDirectRevenue', id);
    } catch (error) {
      console.error('Failed to delete direct revenue entry:', error);
    }
  };

  return (
    <AppShell title="Daily direct revenue">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Daily Direct Revenue</h3>
              <p className="text-sm text-slate-500">Record cash and card direct revenue separately for daily reporting.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="whitespace-nowrap inline-flex items-center gap-2 rounded-full bg-lime-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-lime-300 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="h-5 w-5" /> {showForm ? 'Cancel' : 'Add DDR'}
            </button>
          </div>

          {showForm && (
          <>
          <div className="mb-4 rounded-full bg-gradient-to-r from-blue-100 to-blue-50 border-2 border-blue-400 p-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></div>
            <p className="text-sm font-bold text-blue-900">{editingId ? '✎ EDITING - Update changes below' : 'Adding New Daily Revenue Entry'}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-500">
              Date
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
              />
            </label>
            <label className="block text-sm text-slate-500">
              Cash counter closed by
              <input
                type="text"
                value={form.closedBy}
                onChange={(e) => setForm({ ...form, closedBy: e.target.value })}
                placeholder="Name"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
              />
            </label>
          </div>

          <div className="mt-6 rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
            <h4 className="text-lg font-semibold text-amber-900">💰 Petty Cash (Float)</h4>
            <p className="text-sm text-amber-800 mt-1">Track the float money kept in drawer for making change to customers</p>
            
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <label className="block text-sm text-amber-900">
                Opening petty cash amount (Start of day)
                <input
                  type="number"
                  value={form.openingPettyCash}
                  onChange={(e) => {
                    setHasManuallyChangedOpeningFloat(true);
                    setForm({ ...form, openingPettyCash: Number(e.target.value) });
                  }}
                  placeholder="e.g., 1000"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-3xl border border-amber-300 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <label className="block text-sm text-amber-900">
                Closing petty cash amount (End of day)
                <input
                  type="number"
                  value={form.closingPettyCash}
                  onChange={(e) => setForm({ ...form, closingPettyCash: Number(e.target.value) })}
                  placeholder="e.g., 1000"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-3xl border border-amber-300 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
            </div>
            
            <div className="mt-4 p-3 bg-white rounded-2xl border border-amber-200">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-amber-700 text-xs">Opening</p>
                  <p className="font-bold text-amber-900">{formatMVR(form.openingPettyCash)}</p>
                </div>
                <div>
                  <p className="text-amber-700 text-xs">Closing</p>
                  <p className="font-bold text-amber-900">{formatMVR(form.closingPettyCash)}</p>
                </div>
                <div>
                  <p className="text-amber-700 text-xs">Difference</p>
                  <p className={`font-bold ${form.closingPettyCash >= form.openingPettyCash ? 'text-green-600' : 'text-red-600'}`}>
                    {formatMVR(form.closingPettyCash - form.openingPettyCash)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h4 className="text-lg font-semibold text-slate-900">Cash breakdown</h4>
            <p className="text-sm text-slate-500">Enter counts for coins and notes.</p>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mt-5">
              {[
                { label: '50 Laari', field: 'fiftyLari' as const },
                { label: '1 Rf', field: 'oneRf' as const },
                { label: '2 Rf', field: 'twoRf' as const },
                { label: '5 Note', field: 'note5' as const },
                { label: '10 Note', field: 'note10' as const },
                { label: '20 Note', field: 'note20' as const },
                { label: '50 Note', field: 'note50' as const },
                { label: '100 Note', field: 'note100' as const },
                { label: '500 Note', field: 'note500' as const },
                { label: '1000 Note', field: 'note1000' as const },
              ].map((item) => (
                <label key={item.field} className="block text-sm text-slate-500">
                  {item.label}
                  <input
                    type="number"
                    min={0}
                    value={form.cashCounts[item.field]}
                    onChange={(e) => updateCashCount(item.field, Number(e.target.value))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
              ))}
            </div>

            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 mt-6">
              <p className="text-sm font-semibold text-slate-900">Notes</p>
              {[
                { label: '5', field: 'note5' as const },
                { label: '10', field: 'note10' as const },
                { label: '20', field: 'note20' as const },
                { label: '50', field: 'note50' as const },
                { label: '100', field: 'note100' as const },
                { label: '500', field: 'note500' as const },
                { label: '1000', field: 'note1000' as const },
              ].map((item) => (
                <label key={item.field} className="block text-sm text-slate-500">
                  {item.label} MVR notes
                  <input
                    type="number"
                    min={0}
                    value={form.cashCounts[item.field]}
                    onChange={(e) => updateCashCount(item.field, Number(e.target.value))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Card / other payments</h4>
                <p className="text-sm text-slate-500">Add one or more payment types.</p>
              </div>
              <button
                type="button"
                onClick={addCardPayment}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" /> Add payment type
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {form.cardPayments.map((payment) => (
                <div key={payment.id} className="grid gap-3 sm:grid-cols-[2fr_1fr_48px]">
                  <label className="block text-sm text-slate-500">
                    Payment type
                    <input
                      type="text"
                      value={payment.type}
                      onChange={(e) => updateCardPayment(payment.id, 'type', e.target.value)}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                  <label className="block text-sm text-slate-500">
                    Amount
                    <input
                      type="number"
                      min={0}
                      value={payment.amount}
                      onChange={(e) => updateCardPayment(payment.id, 'amount', Number(e.target.value))}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeCardPayment(payment.id)}
                    className="mt-8 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition"
                    aria-label="Remove payment type"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h4 className="text-lg font-semibold text-slate-900 mb-4">Manual POS & Additional Items</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm text-slate-500">
                Vikura (Manual POS)
                <input
                  type="number"
                  value={form.vikuraAmount}
                  onChange={(e) => setForm({ ...form, vikuraAmount: Number(e.target.value) })}
                  placeholder="e.g., 0"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-500">
                Purchased from Cash Drawer
                <input
                  type="number"
                  value={form.purchasedFromCashDrawer}
                  onChange={(e) => {
                    setHasManuallyChangedDrawer(true);
                    setForm({ ...form, purchasedFromCashDrawer: Number(e.target.value) });
                  }}
                  placeholder="e.g., 0"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-500">
                Daily salary
                <input
                  type="number"
                  value={form.dailySalary}
                  onChange={(e) => {
                    setHasManuallyChangedSalary(true);
                    setForm({ ...form, dailySalary: Number(e.target.value) });
                  }}
                  placeholder="e.g., 0"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
            </div>
            {directPurchaseDrawerTotal > 0 ? (
              <p className="mt-3 text-sm text-slate-500">Auto-filled from direct purchases: {formatMVR(directPurchaseDrawerTotal)}</p>
            ) : null}
            {expenseSalaryTotal > 0 ? (
              <p className="mt-2 text-sm text-slate-500">Auto-filled from salary expenses: {formatMVR(expenseSalaryTotal)}</p>
            ) : null}
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Cash Drawer Purchases</h4>
                <p className="text-sm text-slate-500">Record purchases made from cash drawer (will be added to Direct Purchases).</p>
              </div>
              <button
                type="button"
                onClick={addCashDrawerPurchase}
                className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
              >
                <Plus className="h-4 w-4" /> Add purchase
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {form.cashDrawerPurchases.map((purchase) => {
                const purchaseTotal = purchase.items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
                return (
                  <div key={purchase.id} className="rounded-2xl border border-purple-200 bg-white p-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_48px]">
                      <label className="block text-sm text-slate-500">
                        Shop name
                        <input
                          type="text"
                          value={purchase.shopName}
                          onChange={(e) => updateCashDrawerPurchase(purchase.id, 'shopName', e.target.value)}
                          placeholder="e.g., Local Supplies"
                          className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                        />
                      </label>
                      <label className="block text-sm text-slate-500">
                        Total amount
                        <input
                          type="number"
                          value={purchase.amount}
                          onChange={(e) => updateCashDrawerPurchase(purchase.id, 'amount', Number(e.target.value))}
                          className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeCashDrawerPurchase(purchase.id)}
                        className="mt-8 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition"
                        aria-label="Remove purchase"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Items in this purchase */}
                    <div className="rounded-lg bg-purple-50 p-3 border border-purple-100">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-purple-900">Items ({purchase.items.length})</p>
                        <button
                          type="button"
                          onClick={() => addItemToPurchase(purchase.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-purple-600 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-500"
                        >
                          <Plus className="h-3 w-3" /> Item
                        </button>
                      </div>

                      <div className="space-y-2">
                        {purchase.items.map((item) => (
                          <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_40px]">
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) => updatePurchaseItem(purchase.id, item.id, 'productName', e.target.value)}
                              placeholder="Product name"
                              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                            />
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updatePurchaseItem(purchase.id, item.id, 'quantity', Number(e.target.value))}
                              placeholder="Qty"
                              min="1"
                              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                            />
                            <input
                              type="number"
                              value={item.unitCost}
                              onChange={(e) => updatePurchaseItem(purchase.id, item.id, 'unitCost', Number(e.target.value))}
                              placeholder="Unit cost"
                              min="0"
                              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                            />
                            <input
                              type="text"
                              value={formatMVR(item.totalCost)}
                              disabled
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 cursor-not-allowed"
                            />
                            <button
                              type="button"
                              onClick={() => removeItemFromPurchase(purchase.id, item.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition text-xs"
                              aria-label="Remove item"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {purchase.items.length > 0 && (
                        <div className="mt-2 text-right">
                          <p className="text-xs text-purple-600">
                            Subtotal: <span className="font-semibold">{formatMVR(purchaseTotal)}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {form.cashDrawerPurchases.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-6">No cash drawer purchases recorded</p>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-sm text-slate-500">Cash total</p>
                <p className="mt-2 text-2xl font-semibold text-[#05093f]">{formatMVR(cashTotal)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-sm text-slate-500">Card total</p>
                <p className="mt-2 text-2xl font-semibold text-[#05093f]">{formatMVR(cardTotal)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-blue-50 p-4 text-center">
                <p className="text-sm text-blue-600">Vikura (Manual POS)</p>
                <p className="mt-2 text-2xl font-semibold text-blue-900">{formatMVR(vikuraAmount)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-sm text-slate-500">Direct revenue</p>
                <p className="mt-2 text-2xl font-semibold text-[#7c4b2e]">{formatMVR(totalDirectRevenue)}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              <div className="rounded-3xl border-2 border-yellow-300 bg-yellow-50 p-4 text-center">
                <p className="text-sm text-yellow-700">Cash + Card Total</p>
                <p className="mt-2 text-xl font-semibold text-yellow-900">{formatMVR(cashTotal + cardTotal)}</p>
              </div>
              <div className={`rounded-3xl border-2 p-4 text-center ${
                vikuraAmount >= (cashTotal + cardTotal) 
                  ? 'border-green-300 bg-green-50' 
                  : 'border-red-300 bg-red-50'
              }`}>
                <p className={`text-sm ${vikuraAmount >= (cashTotal + cardTotal) ? 'text-green-700' : 'text-red-700'}`}>
                  Vikura vs Cash+Card Difference
                </p>
                <p className={`mt-2 text-xl font-semibold ${vikuraAmount >= (cashTotal + cardTotal) ? 'text-green-900' : 'text-red-900'}`}>
                  {formatMVR(vikuraAmount - (cashTotal + cardTotal))}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center pt-2">
              <button
                type="button"
                onClick={saveRevenue}
                disabled={!form.closedBy.trim() || totalDirectRevenue <= 0 || saving}
                className={`flex-1 rounded-3xl px-4 py-3 text-sm font-semibold text-white transition ${
                  editingId
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-lg'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {editingId ? '✓ Update Daily Revenue' : 'Save Daily Revenue'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 rounded-3xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ✕ Cancel Edit
                </button>
              ) : null}
            </div>
          </div>
          </>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Daily Revenue History</h3>
              <p className="text-sm text-slate-500">Review and manage all daily direct revenue entries.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#05093f]">
              {entries.length} entries
            </span>
          </div>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {entries.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No daily revenue entries have been saved yet.</p>
            ) : null}
            {Object.entries(groupedEntries).map(([date, dayEntries]) => {
              const dailyCashTotal = dayEntries.reduce((sum, e) => sum + e.cashTotal, 0);
              const dailyCardTotal = dayEntries.reduce((sum, e) => sum + e.cardTotal, 0);
              const dailyRevenue = dayEntries.reduce((sum, e) => sum + (e.cashTotal + e.cardTotal), 0);
              const formattedDate = new Date(date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
              
              return (
                <div key={date} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
                    <div>
                      <p className="font-semibold text-slate-900">{formattedDate}</p>
                      <p className="text-xs text-slate-500">{dayEntries.length} entry(ies)</p>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-500">Cash: <span className="font-semibold text-slate-900">{formatMVR(dailyCashTotal)}</span></span>
                        <span className="text-slate-500">Card: <span className="font-semibold text-slate-900">{formatMVR(dailyCardTotal)}</span></span>
                      </div>
                      <p className="text-xs text-slate-500">Daily Total</p>
                      <p className="text-lg font-bold text-emerald-600">{formatMVR(dailyRevenue)}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {dayEntries.map((entry) => (
                      <div key={entry.id} className="rounded-3xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">Closed by: {entry.closedBy}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                beginEditEntry(entry);
                                setShowForm(true);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-yellow-300 shadow-md hover:shadow-lg transition"
                            >
                              <Edit3 className="h-3 w-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEntry(entry.id)}
                              className="inline-flex items-center gap-1 rounded-3xl bg-red-50 px-3 py-2 text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-4 text-xs mb-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                            <p className="text-slate-500">Cash:</p>
                            <p className="font-semibold text-slate-900">{formatMVR(entry.cashTotal)}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                            <p className="text-slate-500">Card:</p>
                            <p className="font-semibold text-slate-900">{formatMVR(entry.cardTotal)}</p>
                          </div>
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-2">
                            <p className="text-blue-600">Vikura:</p>
                            <p className="font-semibold text-blue-900">{formatMVR((entry as any).vikuraAmount || 0)}</p>
                          </div>
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-slate-500">Total:</p>
                            <p className="font-semibold text-emerald-700">{formatMVR(entry.cashTotal + entry.cardTotal)}</p>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 text-xs mb-3">
                          <div className="rounded-2xl border-2 border-yellow-300 bg-yellow-50 p-2">
                            <p className="text-yellow-700 font-semibold">Cash + Card Total</p>
                            <p className="font-bold text-yellow-900">{formatMVR(entry.cashTotal + entry.cardTotal)}</p>
                          </div>
                          <div className={`rounded-2xl border-2 p-2 ${
                            ((entry as any).vikuraAmount || 0) >= (entry.cashTotal + entry.cardTotal)
                              ? 'border-green-300 bg-green-50'
                              : 'border-red-300 bg-red-50'
                          }`}>
                            <p className={`font-semibold ${((entry as any).vikuraAmount || 0) >= (entry.cashTotal + entry.cardTotal) ? 'text-green-700' : 'text-red-700'}`}>
                              Vikura Difference
                            </p>
                            <p className={`font-bold ${((entry as any).vikuraAmount || 0) >= (entry.cashTotal + entry.cardTotal) ? 'text-green-900' : 'text-red-900'}`}>
                              {formatMVR(((entry as any).vikuraAmount || 0) - (entry.cashTotal + entry.cardTotal))}
                            </p>
                          </div>
                        </div>
                        {(entry.openingPettyCash !== undefined || entry.closingPettyCash !== undefined) && (
                          <div className="grid gap-2 sm:grid-cols-3 text-xs">
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-2">
                              <p className="text-amber-700 text-xs font-semibold">Opening Float</p>
                              <p className="font-bold text-amber-900">{formatMVR(entry.openingPettyCash || 0)}</p>
                            </div>
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-2">
                              <p className="text-amber-700 text-xs font-semibold">Closing Float</p>
                              <p className="font-bold text-amber-900">{formatMVR(entry.closingPettyCash || 0)}</p>
                            </div>
                            <div className={`rounded-2xl border-2 p-2 ${
                              ((entry.closingPettyCash || 0) >= (entry.openingPettyCash || 0)) 
                                ? 'border-green-200 bg-green-50' 
                                : 'border-red-200 bg-red-50'
                            }`}>
                              <p className={`text-xs font-semibold ${
                                ((entry.closingPettyCash || 0) >= (entry.openingPettyCash || 0)) 
                                  ? 'text-green-700' 
                                  : 'text-red-700'
                              }`}>Float Change</p>
                              <p className={`font-bold ${
                                ((entry.closingPettyCash || 0) >= (entry.openingPettyCash || 0)) 
                                  ? 'text-green-900' 
                                  : 'text-red-900'
                              }`}>{formatMVR((entry.closingPettyCash || 0) - (entry.openingPettyCash || 0))}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
