import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { CardPayment, DailyDirectRevenue, DirectPurchase, DirectPurchaseItem, Expense } from '../types';

// cash counts removed: switch to single cash total input

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
    salaryPaidFromCompany: 0,
    purchasedFromCompanyAccount: 0,
    bankTransfer: 0,
    cashTotal: 0,
    cardTotal: 0,
    otherCardPayments: [] as CardPayment[],
    cashDrawerPurchases: [] as Array<{
      id: string;
      shopName: string;
      items: DirectPurchaseItem[];
      amount: number;
    }>,
    lastTookCashAt: undefined as string | undefined,
    lastTookCashAmount: 0,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [hasManuallyChangedDrawer, setHasManuallyChangedDrawer] = useState(false);
  const [hasManuallyChangedSalary, setHasManuallyChangedSalary] = useState(false);
  const [hasManuallyChangedOpeningFloat, setHasManuallyChangedOpeningFloat] = useState(false);
  const [showTookCash, setShowTookCash] = useState(false);
  const [tookCashAmount, setTookCashAmount] = useState<number>(0);
  const [lastTookCashAt, setLastTookCashAt] = useState<string | undefined>(undefined);

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

  const cashTotal = form.cashTotal || 0;
  const cardTotal = useMemo(
    () => (form.cardTotal || 0) + (form.otherCardPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0),
    [form.cardTotal, form.otherCardPayments],
  );
  const vikuraAmount = form.vikuraAmount || 0;
  const totalDirectRevenue = useMemo(
    () => cashTotal + cardTotal + (form.purchasedFromCashDrawer || 0) + (form.bankTransfer || 0),
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

  const updateCashTotal = (value: number) => {
    setForm((current) => ({ ...current, cashTotal: value }));
  };

  const handleTookCashSave = () => {
    const value = Number(tookCashAmount) || 0;
    if (value <= 0) return;
    const now = new Date().toISOString();
    setForm((current) => ({
      ...current,
      purchasedFromCashDrawer: (current.purchasedFromCashDrawer || 0) + value,
      lastTookCashAt: now,
      lastTookCashAmount: value,
    }));
    setLastTookCashAt(now);
    setHasManuallyChangedDrawer(true);
    setTookCashAmount(0);
    setShowTookCash(false);
  };

  const addOtherPayment = () => {
    const existingOtherPayments = form.otherCardPayments?.filter((p) => p.type.startsWith('Other ')) || [];
    const nextNumber = existingOtherPayments.length + 1;
    setForm((current) => ({
      ...current,
      otherCardPayments: [
        ...(current.otherCardPayments || []),
        { id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: `Other ${nextNumber}`, amount: 0 },
      ],
    }));
  };

  const updateOtherPayment = (id: string, field: keyof CardPayment, value: string | number) => {
    setForm((current) => ({
      ...current,
      otherCardPayments: (current.otherCardPayments || []).map((payment) =>
        payment.id !== id ? payment : { ...payment, [field]: field === 'amount' ? Number(value) : value },
      ),
    }));
  };

  const removeOtherPayment = (id: string) => {
    setForm((current) => ({
      ...current,
      otherCardPayments: (current.otherCardPayments || []).filter((payment) => payment.id !== id),
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
      salaryPaidFromCompany: form.salaryPaidFromCompany,
      purchasedFromCompanyAccount: form.purchasedFromCompanyAccount,
      bankTransfer: form.bankTransfer,
      vikuraAmount: form.vikuraAmount,
      purchasedFromCashDrawer: form.purchasedFromCashDrawer,
      // preserve legacy cashCounts shape with zeros (we store a single cashTotal separately)
      cashCounts: {
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
      },
      // store other card payment breakdown separately and the numeric card total
      cardPayments: (form.otherCardPayments || []).filter((payment) => payment.amount > 0),
      cashTotal: form.cashTotal || 0,
      lastTookCashAt: (form as any).lastTookCashAt,
      lastTookCashAmount: (form as any).lastTookCashAmount,
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
        lastTookCashAt: undefined,
        lastTookCashAmount: 0,
        dailySalary: 0,
        salaryPaidFromCompany: 0,
        purchasedFromCompanyAccount: 0,
        bankTransfer: 0,
        cashTotal: 0,
        cardTotal: 0,
        otherCardPayments: [],
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
    setForm({
      date: entry.date,
      closedBy: entry.closedBy,
      openingPettyCash: (entry as any).openingPettyCash || 0,
      closingPettyCash: (entry as any).closingPettyCash || 0,
      vikuraAmount: (entry as any).vikuraAmount || 0,
      purchasedFromCashDrawer: (entry as any).purchasedFromCashDrawer || 0,
      dailySalary: (entry as any).dailySalary || 0,
      salaryPaidFromCompany: (entry as any).salaryPaidFromCompany || 0,
      purchasedFromCompanyAccount: (entry as any).purchasedFromCompanyAccount || 0,
      bankTransfer: (entry as any).bankTransfer || 0,
      cashTotal: (entry as any).cashTotal || 0,
      cardTotal: (entry as any).cardTotal || 0,
      otherCardPayments: (entry as any).cardPayments || [],
      cashDrawerPurchases: [],
      lastTookCashAt: (entry as any).lastTookCashAt,
      lastTookCashAmount: (entry as any).lastTookCashAmount || 0,
    });
    setLastTookCashAt((entry as any).lastTookCashAt);
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
      salaryPaidFromCompany: 0,
      purchasedFromCompanyAccount: 0,
      bankTransfer: 0,
      cashTotal: 0,
      cardTotal: 0,
      otherCardPayments: [],
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

  const shareDayReport = (date: string, dayEntries: DailyDirectRevenue[]) => {
    // Calculate components per requested formula:
    // revenue = petty cash difference + cash breakdown (counts) + purchased from cash drawer + daily salary
    const floatDifference = dayEntries.reduce((sum, e) => sum + ((e.closingPettyCash || 0) - (e.openingPettyCash || 0)), 0);
    const cashBreakdown = dayEntries.reduce((sum, e) => sum + (e.cashTotal || 0), 0);
    const purchasedFromCashDrawer = dayEntries.reduce((sum, e) => sum + (e.purchasedFromCashDrawer || 0), 0);
    const dailySalaryTotal = dayEntries.reduce((sum, e) => sum + (e.dailySalary || 0), 0);
    const cardTotal = dayEntries.reduce((sum, e) => sum + (e.cardTotal || 0), 0);
    const bankTransferTotal = dayEntries.reduce((sum, e) => sum + ((e as any).bankTransfer || 0), 0);
    const purchasedFromCompanyTotal = dayEntries.reduce((sum, e) => sum + ((e as any).purchasedFromCompanyAccount || 0), 0);
    const salaryPaidFromCompanyTotal = dayEntries.reduce((sum, e) => sum + ((e as any).salaryPaidFromCompany || 0), 0);
    const vikuraTotal = dayEntries.reduce((sum, e) => sum + ((e as any).vikuraAmount || 0), 0);

    // include cash drawer direct purchases saved in directPurchases collection for the date
    const cashDrawerTotal = directPurchases
      .filter((p) => p.date === date && (p.total || 0) > 0)
      .reduce((sum, p) => sum + (p.total || 0), 0);

    // include card totals and only include positive cash-drawer direct purchases in revenue
    // NOTE: purchasedFromCompanyAccount and salaryPaidFromCompany are NOT part of revenue (they're company-account transactions)
    const revenue = floatDifference + cashBreakdown + cardTotal + purchasedFromCashDrawer + dailySalaryTotal + cashDrawerTotal + bankTransferTotal;

    // compute expenses for the date from expenses collection and include purchases and salaries
    const expensesForDate = expenses
      .filter((ex) => ex.date === date)
      .reduce((sum, ex) => sum + (ex.amount || 0), 0);

    const totalExpenses = expensesForDate + cashDrawerTotal + purchasedFromCashDrawer + purchasedFromCompanyTotal + dailySalaryTotal + salaryPaidFromCompanyTotal;
    const netRevenue = revenue - totalExpenses;

    const formattedDate = new Date(date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

    let text = `${formattedDate}\nCash flow..\n\n`;
    text += `Petty cash difference: ${formatMVR(floatDifference)}\n`;
    text += `Cash breakdown (counts): ${formatMVR(cashBreakdown)}\n`;
    text += `Card payments: ${formatMVR(cardTotal)}\n`;
    text += `Purchased from Cash Drawer (form): ${formatMVR(purchasedFromCashDrawer)}\n`;
    text += `Purchased from Cash Drawer (direct purchases): ${formatMVR(cashDrawerTotal)}\n`;
    text += `Vikura (Manual POS): ${formatMVR(vikuraTotal)}\n`;
    text += `Salary paid (Cash Drawer): ${formatMVR(dailySalaryTotal)}\n`;
    text += `Purchased from Company Account: ${formatMVR(purchasedFromCompanyTotal)}\n`;
    text += `Salary paid from Company Account: ${formatMVR(salaryPaidFromCompanyTotal)}\n`;
    text += `Bank transfer: ${formatMVR(bankTransferTotal)}\n\n`;
    text += `Calculated revenue: ${formatMVR(revenue)}\n`;
    text += `Total Expenses: ${formatMVR(totalExpenses)}\n`;
    text += `Net Revenue: ${formatMVR(netRevenue)}`;

    // show preview modal before sharing
    setSharePreviewText(text);
    setShowSharePreview(true);
  };

  const [showSharePreview, setShowSharePreview] = useState(false);
  const [sharePreviewText, setSharePreviewText] = useState('');

  const copyPreviewToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(sharePreviewText);
    } catch (e) {
      // ignore
    }
  };

  const openWhatsAppFromPreview = () => {
    const encoded = encodeURIComponent(sharePreviewText);
    const url = `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
    setShowSharePreview(false);
  };

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
            <h4 className="text-lg font-semibold text-slate-900">Cash total</h4>
            <p className="text-sm text-slate-500">Enter the total cash amount counted in the drawer (single value).</p>

            <div className="grid gap-4 sm:grid-cols-2 mt-5">
              <label className="block text-sm text-slate-500">
                Cash total (from drawer)
                <input
                  type="number"
                  min={0}
                  value={form.cashTotal}
                  onChange={(e) => updateCashTotal(Number(e.target.value))}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTookCash((s) => !s)}
                  className="inline-flex items-center gap-2 rounded-3xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Took cash
                </button>
                {showTookCash && (
                  <div className="inline-flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={tookCashAmount}
                      onChange={(e) => setTookCashAmount(Number(e.target.value))}
                      placeholder="Amount"
                      className="mt-0 w-36 rounded-3xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleTookCashSave}
                      className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-white p-3 border">
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <p className="text-amber-700 text-xs">Cash total</p>
                  <p className="text-sm font-semibold">{formatMVR(cashTotal)}</p>
                </div>
                {(form as any).lastTookCashAt ? (
                  <div>
                    <p className="text-amber-700 text-xs">Last cash taken</p>
                    <p className="text-sm font-medium">{formatMVR((form as any).lastTookCashAmount || 0)} — {new Date((form as any).lastTookCashAt).toLocaleString()}</p>
                  </div>
                ) : null}
              </div>
            </div>

          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Card / other payments</h4>
                <p className="text-sm text-slate-500">Enter total card value and optionally add other payment types.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addOtherPayment}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  <Plus className="h-4 w-4" /> Add payment type
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-slate-500">
                  Card total
                  <input
                    type="number"
                    min={0}
                    value={form.cardTotal}
                    onChange={(e) => setForm((c) => ({ ...c, cardTotal: Number(e.target.value) }))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
              </div>

              {(form.otherCardPayments || []).map((payment) => (
                <div key={payment.id} className="grid gap-3 sm:grid-cols-[2fr_1fr_48px]">
                  <label className="block text-sm text-slate-500">
                    Payment type
                    <input
                      type="text"
                      value={payment.type}
                      onChange={(e) => updateOtherPayment(payment.id, 'type', e.target.value)}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                  <label className="block text-sm text-slate-500">
                    Amount
                    <input
                      type="number"
                      min={0}
                      value={payment.amount}
                      onChange={(e) => updateOtherPayment(payment.id, 'amount', Number(e.target.value))}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeOtherPayment(payment.id)}
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
                Salary paid from cash drawer
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
              <label className="block text-sm text-slate-500">
                Salary paid from company account
                <input
                  type="number"
                  value={form.salaryPaidFromCompany}
                  onChange={(e) => setForm({ ...form, salaryPaidFromCompany: Number(e.target.value) })}
                  placeholder="e.g., 0"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-500">
                Purchased from company account
                <input
                  type="number"
                  value={form.purchasedFromCompanyAccount}
                  onChange={(e) => setForm({ ...form, purchasedFromCompanyAccount: Number(e.target.value) })}
                  placeholder="e.g., 0"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-500">
                Bank transfer
                <input
                  type="number"
                  value={form.bankTransfer}
                  onChange={(e) => setForm({ ...form, bankTransfer: Number(e.target.value) })}
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
                className="flex-1 rounded-3xl px-4 py-3 text-sm font-semibold text-white transition bg-emerald-600 hover:bg-emerald-500 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
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
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => shareDayReport(date, dayEntries)}
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm"
                        >
                          Share
                        </button>
                      </div>
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
      {showSharePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSharePreview(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Share preview</h3>
            <p className="text-sm text-slate-500 mt-1">Review the message before sharing</p>
            <div className="mt-4 max-h-60 overflow-y-auto rounded-lg border bg-slate-50 p-3 text-sm whitespace-pre-wrap">
              {sharePreviewText}
            </div>
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={copyPreviewToClipboard}
                className="rounded-lg border px-3 py-2 text-sm font-semibold bg-white text-slate-700 hover:bg-slate-50"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={openWhatsAppFromPreview}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 shadow-sm"
              >
                Open WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setShowSharePreview(false)}
                className="rounded-lg border px-3 py-2 text-sm font-semibold bg-white text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
