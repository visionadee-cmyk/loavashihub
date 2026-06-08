import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { MenuItem, OutsourceItem } from '../types';

const initialForm = {
  date: new Date().toISOString().slice(0, 10),
  partyName: '',
  menuItemId: '',
  sellingPrice: 0,
  costPerPortion: 0,
  portions: 1,
  notes: '',
};

export default function OutsourceItemsPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [items, setItems] = useState<OutsourceItem[]>([]);
  const [partyNames, setPartyNames] = useState<{ id: string; name: string }[]>([]);
  const [partyEditId, setPartyEditId] = useState<string | null>(null);
  const [partyEditName, setPartyEditName] = useState('');
  const [menuQuery, setMenuQuery] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState<{
    itemId: string;
    amount: number;
    paymentDate: string;
    deductionDate: string;
  } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSource, setPaymentSource] = useState<'dailyRevenue' | 'companyAccount'>('dailyRevenue');
  const [directRevenueEntry, setDirectRevenueEntry] = useState<any | null>(null);

  // load direct revenue entry for selected deductionDate when payment form opens/changes
  useEffect(() => {
    if (!paymentForm || !paymentForm.deductionDate || !hasFirebaseConfig) {
      setDirectRevenueEntry(null);
      return;
    }
    let mounted = true;
    loadCollection('dailyDirectRevenue', []).then((entries) => {
      if (!mounted) return;
      const found = entries.find((e: any) => e.date === paymentForm.deductionDate);
      setDirectRevenueEntry(found ?? null);
    }).catch(() => setDirectRevenueEntry(null));
    return () => { mounted = false; };
  }, [paymentForm?.deductionDate]);

  useEffect(() => {
    if (!hasFirebaseConfig) return;

    Promise.all([
      loadCollection<MenuItem>('menuItems', []),
      loadCollection<OutsourceItem>('outsourceItems', []),
      loadCollection<{ id: string; name: string }>('partyNames', []),
    ])
      .then(([loadedMenuItems, loadedOutsourceItems, loadedPartyNames]) => {
        if (loadedMenuItems.length) setMenuItems(loadedMenuItems);
        if (loadedOutsourceItems.length) setItems(loadedOutsourceItems.sort((a, b) => b.date.localeCompare(a.date)));
        // populate party names from collection and also fallback to existing outsource items
        if (Array.isArray(loadedPartyNames) && loadedPartyNames.length) {
          // dedupe by name and keep id
          const map = new Map<string, { id: string; name: string }>();
          loadedPartyNames.forEach((p) => map.set(p.name, { id: p.id, name: p.name }));
          setPartyNames(Array.from(map.values()));
        } else {
          const names = Array.from(new Set(loadedOutsourceItems.map((it: OutsourceItem) => it.partyName)));
          setPartyNames(names.map((n, i) => ({ id: `party-fallback-${i}`, name: n })));
        }
      })
      .catch((error) => console.error('Failed to load outsource items or menu items:', error));
  }, []);

  const selectedMenuItem = menuItems.find((item) => item.id === form.menuItemId);

  const totalOutsourceRevenue = useMemo(
    () => items.reduce((sum, item) => sum + item.totalRevenue, 0),
    [items],
  );

  const totalOutsourceCost = useMemo(
    () => items.reduce((sum, item) => sum + item.totalCost, 0),
    [items],
  );

  const totalOutsourceProfit = useMemo(
    () => items.reduce((sum, item) => sum + item.profit, 0),
    [items],
  );

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleSelectMenuItem = (menuItemId: string) => {
    const selected = menuItems.find((item) => item.id === menuItemId);
    setForm((current) => ({
      ...current,
      menuItemId,
      sellingPrice: selected?.price ?? current.sellingPrice,
      costPerPortion: selected?.costPrice ?? current.costPerPortion,
    }));
    setMenuQuery(selected?.name ?? '');
  };

  const saveOutsourceItem = async () => {
    if (!form.partyName.trim() || !form.menuItemId || form.portions <= 0 || form.costPerPortion < 0 || form.sellingPrice < 0) {
      return;
    }

    const selected = menuItems.find((item) => item.id === form.menuItemId);
    const existing = editingId ? items.find((item) => item.id === editingId) : undefined;
    const payload: OutsourceItem = {
      id: editingId ?? `outsource-${Date.now()}`,
      date: form.date,
      partyName: form.partyName.trim(),
      menuItemId: form.menuItemId,
      menuItemName: selected?.name ?? 'Unknown item',
      sellingPrice: form.sellingPrice,
      costPerPortion: form.costPerPortion,
      portions: form.portions,
      totalCost: Number((form.costPerPortion * form.portions).toFixed(2)),
      totalRevenue: Number((form.sellingPrice * form.portions).toFixed(2)),
      profit: Number(((form.sellingPrice - form.costPerPortion) * form.portions).toFixed(2)),
      notes: form.notes.trim(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      partyPaid: existing?.partyPaid ?? false,
      partyPaymentAmount: existing?.partyPaymentAmount,
      partyPaymentDate: existing?.partyPaymentDate,
      costDeductionDate: existing?.costDeductionDate,
    };

    setItems((current) => {
      if (editingId) {
        return current.map((item) => (item.id === editingId ? payload : item));
      }
      return [payload, ...current];
    });

    if (hasFirebaseConfig) {
      try {
        await saveDocument('outsourceItems', payload.id, payload);
        // ensure party name saved for future quick select
        const existing = partyNames.find((p) => p.name.toLowerCase() === payload.partyName.toLowerCase());
        if (!existing) {
          const partyId = `party-${Date.now()}`;
          try {
            await saveDocument('partyNames', partyId, { id: partyId, name: payload.partyName, createdAt: new Date().toISOString() });
            setPartyNames((curr) => [{ id: partyId, name: payload.partyName }, ...curr]);
          } catch (err) {
            // non-fatal
            console.error('Failed to save party name:', err);
          }
        }
      } catch (error) {
        console.error('Failed to save outsource item:', error);
      }
    }

    resetForm();
    setShowForm(false);
  };

  const beginEdit = (item: OutsourceItem) => {
    setEditingId(item.id);
    setForm({
      date: item.date,
      partyName: item.partyName,
      menuItemId: item.menuItemId,
      sellingPrice: item.sellingPrice,
      costPerPortion: item.costPerPortion,
      portions: item.portions,
      notes: item.notes || '',
    });
    setShowForm(true);
    setShowFormModal(true);
  };

  const deleteOutsourceItem = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    if (paymentForm?.itemId === id) {
      setPaymentForm(null);
    }
    if (hasFirebaseConfig) {
      try {
        await deleteDocument('outsourceItems', id);
      } catch (error) {
        console.error('Failed to delete outsource item:', error);
      }
    }
  };

  const beginPayParty = (item: OutsourceItem) => {
    setPaymentForm({
      itemId: item.id,
      amount: item.partyPaymentAmount ?? item.totalCost,
      paymentDate: item.partyPaymentDate ?? new Date().toISOString().slice(0, 10),
      deductionDate: item.costDeductionDate ?? item.date,
    });
    setShowPaymentModal(true);
  };

  // compute stats per saved party name
  const partyStats = useMemo(() => {
    const map = new Map<string, { paid: number; pending: number; remaining: number }>();
    items.forEach((it) => {
      const name = it.partyName || 'Unknown';
      const entry = map.get(name) ?? { paid: 0, pending: 0, remaining: 0 };
      const paid = it.partyPaid ? (it.partyPaymentAmount ?? it.totalCost) : 0;
      const pending = it.totalCost - paid;
      entry.paid += paid;
      entry.pending += pending > 0 ? pending : 0;
      entry.remaining = entry.pending;
      map.set(name, entry);
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
  }, [items]);

  // group items by party and compute totals per party
  const partyGroups = useMemo(() => {
    const map = new Map<string, OutsourceItem[]>();
    items.forEach((it) => {
      const name = it.partyName || 'Unknown';
      const arr = map.get(name) ?? [];
      arr.push(it);
      map.set(name, arr);
    });

    return Array.from(map.entries()).map(([name, arr]) => {
      const totals = arr.reduce(
        (s, it) => ({
          totalCost: s.totalCost + (it.totalCost || 0),
          totalRevenue: s.totalRevenue + (it.totalRevenue || 0),
          profit: s.profit + (it.profit || 0),
        }),
        { totalCost: 0, totalRevenue: 0, profit: 0 },
      );
      // sort items newest first
      arr.sort((a, b) => b.date.localeCompare(a.date));
      return { name, items: arr, totals };
    });
  }, [items]);

  const savePayment = async (source: 'dailyRevenue' | 'companyAccount') => {
    if (!paymentForm) return;
    const { itemId, paymentDate, deductionDate } = paymentForm;

    const item = items.find((it) => it.id === itemId);
    if (!item) return;

    // always use the outsource total cost as the payment amount
    const amountToUse = item.totalCost;

    // update outsource item locally
    const updated: OutsourceItem = { ...item, partyPaid: true, partyPaymentAmount: amountToUse, partyPaymentDate: paymentDate, costDeductionDate: deductionDate };
    setItems((curr) => curr.map((it) => (it.id === itemId ? updated : it)));

    if (hasFirebaseConfig) {
      try {
        await saveDocument('outsourceItems', updated.id, updated);
      } catch (err) {
        console.error('Failed to save outsource payment info:', err);
      }
    }

    // handle source-specific deductions
    if (source === 'dailyRevenue' && hasFirebaseConfig) {
      try {
        const entries: any[] = await loadCollection('dailyDirectRevenue', []);
        const entry = entries.find((e) => e.date === deductionDate);
        if (!entry) {
          // no direct revenue for date: notify and finish
          // keep update on outsource item but warn in console
          console.warn('No Daily Direct Revenue entry found for', deductionDate);
        } else {
          // preferentially deduct from cashTotal, then cardTotal
          let remaining = amountToUse;
          const cash = Number(entry.cashTotal || 0);
          const card = Number(entry.cardTotal || 0);
          let newCash = cash;
          let newCard = card;
          if (cash >= remaining) {
            newCash = cash - remaining;
            remaining = 0;
          } else {
            remaining -= cash;
            newCash = 0;
            newCard = Math.max(0, card - remaining);
            remaining = 0;
          }
          const newTotal = Number((newCash + newCard + (entry.purchasedFromCashDrawer || 0)).toFixed(2));
          const updatedEntry = { ...entry, cashTotal: newCash, cardTotal: newCard, totalDirectRevenue: newTotal };
          try {
            await saveDocument('dailyDirectRevenue', updatedEntry.id, updatedEntry);
            setDirectRevenueEntry(updatedEntry);
          } catch (err) {
            console.error('Failed to update dailyDirectRevenue entry:', err);
          }
        }
      } catch (err) {
        console.error('Failed to load dailyDirectRevenue to deduct payment:', err);
      }
    }

    if (source === 'companyAccount' && hasFirebaseConfig) {
      try {
        const accounts: any[] = await loadCollection('companyAccount', []);
        const acc = accounts.find((a) => a.id === 'main') ?? { id: 'main', balance: 0, transactions: [] };
        const updatedAcc = { ...acc, balance: Number((Number(acc.balance || 0) - amountToUse).toFixed(2)), transactions: [...(acc.transactions || []), { id: `txn-${Date.now()}`, date: paymentDate, amount: -amountToUse, type: 'outsourcePayment', party: item.partyName, outsourceItemId: item.id }] };
        try {
          await saveDocument('companyAccount', 'main', updatedAcc);
        } catch (err) {
          console.error('Failed to update companyAccount:', err);
        }
      } catch (err) {
        console.error('Failed to load companyAccount:', err);
      }
    }

    setPaymentForm(null);
    setShowPaymentModal(false);
  };

  const [showBulkPayModal, setShowBulkPayModal] = useState(false);
  const [bulkItems, setBulkItems] = useState<OutsourceItem[]>([]);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkPaymentDate, setBulkPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkDeductionDate, setBulkDeductionDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkPaymentSource, setBulkPaymentSource] = useState<'dailyRevenue' | 'companyAccount'>('dailyRevenue');

  const beginBulkPay = (partyName: string) => {
    const group = partyGroups.find((g) => g.name === partyName);
    if (!group) return;
    const unpaid = group.items.filter((it) => !it.partyPaid);
    setBulkItems(unpaid);
    const sel: Record<string, boolean> = {};
    unpaid.forEach((it) => { sel[it.id] = true; });
    setBulkSelectedIds(sel);
    setBulkPaymentDate(new Date().toISOString().slice(0, 10));
    setBulkDeductionDate(new Date().toISOString().slice(0, 10));
    setBulkPaymentSource('dailyRevenue');
    setShowBulkPayModal(true);
  };

  const saveBulkPayment = async (source: 'dailyRevenue' | 'companyAccount') => {
    const ids = Object.keys(bulkSelectedIds).filter((id) => bulkSelectedIds[id]);
    if (!ids.length) return;

    const selectedItems = bulkItems.filter((it) => ids.includes(it.id));
    const totalAmount = selectedItems.reduce((s, it) => s + it.totalCost, 0);

    if (!window.confirm(`Mark ${ids.length} item${ids.length !== 1 ? 's' : ''} as paid? This will update records and deduct ${formatMVR(totalAmount)} from the selected source.`)) {
      return;
    }

    // update items locally
    setItems((curr) => curr.map((it) => (ids.includes(it.id) ? { ...it, partyPaid: true, partyPaymentAmount: it.totalCost, partyPaymentDate: bulkPaymentDate, costDeductionDate: bulkDeductionDate } : it)));

    if (hasFirebaseConfig) {
      try {
        // save each updated outsource item
        for (const it of selectedItems) {
          const updated = { ...it, partyPaid: true, partyPaymentAmount: it.totalCost, partyPaymentDate: bulkPaymentDate, costDeductionDate: bulkDeductionDate };
          try {
            // save without awaiting sequentially to be safe but sequential here for clarity
            // eslint-disable-next-line no-await-in-loop
            await saveDocument('outsourceItems', updated.id, updated);
          } catch (err) {
            console.error('Failed to save outsource item in bulk:', err);
          }
        }

        if (source === 'dailyRevenue') {
          // deduct totalAmount from dailyDirectRevenue entry
          const entries: any[] = await loadCollection('dailyDirectRevenue', []);
          const entry = entries.find((e) => e.date === bulkDeductionDate);
          if (entry) {
            let remaining = totalAmount;
            const cash = Number(entry.cashTotal || 0);
            const card = Number(entry.cardTotal || 0);
            let newCash = cash;
            let newCard = card;
            if (cash >= remaining) {
              newCash = cash - remaining;
              remaining = 0;
            } else {
              remaining -= cash;
              newCash = 0;
              newCard = Math.max(0, card - remaining);
              remaining = 0;
            }
            const newTotal = Number((newCash + newCard + (entry.purchasedFromCashDrawer || 0)).toFixed(2));
            const updatedEntry = { ...entry, cashTotal: newCash, cardTotal: newCard, totalDirectRevenue: newTotal };
            try {
              await saveDocument('dailyDirectRevenue', updatedEntry.id, updatedEntry);
              setDirectRevenueEntry(updatedEntry);
            } catch (err) {
              console.error('Failed to update dailyDirectRevenue in bulk:', err);
            }
          } else {
            console.warn('No dailyDirectRevenue entry found for bulk deduction date', bulkDeductionDate);
          }
        }

        if (source === 'companyAccount') {
          const accounts: any[] = await loadCollection('companyAccount', []);
          const acc = accounts.find((a) => a.id === 'main') ?? { id: 'main', balance: 0, transactions: [] };
          const updatedAcc = { ...acc, balance: Number((Number(acc.balance || 0) - totalAmount).toFixed(2)), transactions: [...(acc.transactions || []), { id: `txn-bulk-${Date.now()}`, date: bulkPaymentDate, amount: -totalAmount, type: 'outsourceBulkPayment', count: ids.length }] };
          try {
            await saveDocument('companyAccount', 'main', updatedAcc);
          } catch (err) {
            console.error('Failed to update companyAccount in bulk:', err);
          }
        }
      } catch (err) {
        console.error('Failed during bulk payment save:', err);
      }
    }

    setShowBulkPayModal(false);
    setBulkItems([]);
    setBulkSelectedIds({});
  };

  const bulkSelectedCount = useMemo(() => Object.values(bulkSelectedIds).filter(Boolean).length, [bulkSelectedIds]);
  const bulkAllSelected = bulkItems.length > 0 && bulkItems.every((it) => !!bulkSelectedIds[it.id]);

  

  const deleteParty = async (id: string) => {
    setPartyNames((current) => current.filter((p) => p.id !== id));
    if (hasFirebaseConfig) {
      try {
        await deleteDocument('partyNames', id);
      } catch (error) {
        console.error('Failed to delete party name:', error);
      }
    }
  };

  const beginPartyEdit = (party: { id: string; name: string }) => {
    setPartyEditId(party.id);
    setPartyEditName(party.name);
  };

  const cancelPartyEdit = () => {
    setPartyEditId(null);
    setPartyEditName('');
  };

  const savePartyEdit = async () => {
    if (!partyEditId || !partyEditName.trim()) return;

    const updatedName = partyEditName.trim();
    setPartyNames((current) =>
      current.map((party) =>
        party.id === partyEditId ? { ...party, name: updatedName } : party,
      ),
    );

    if (hasFirebaseConfig) {
      try {
        await saveDocument('partyNames', partyEditId, { id: partyEditId, name: updatedName });
      } catch (error) {
        console.error('Failed to update party name:', error);
      }
    }

    cancelPartyEdit();
  };

  return (
    <AppShell title="Outsource Items">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <span className="inline-block rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white">UPDATED</span>
          <span className="text-sm text-slate-500">Deploy check: {new Date().toISOString()}</span>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {[
            { label: 'Outsource Revenue', value: formatMVR(totalOutsourceRevenue) },
            { label: 'Outsource Cost', value: formatMVR(totalOutsourceCost) },
            { label: 'Total Outsource Profit', value: formatMVR(totalOutsourceProfit) },
          ].map((card) => (
            <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{card.label}</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Outsource item entry</h3>
              <p className="text-sm text-slate-500">Create party-based outsource records with automatic selling price and profit tracking.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm((current) => !current);
                if (showForm) resetForm();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" /> {showForm ? 'Close form' : 'Add outsource item'}
            </button>
          </div>

          {showForm && !showFormModal && (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Party name
                  <input
                    type="text"
                    list="party-names"
                    value={form.partyName}
                    onChange={(e) => setForm({ ...form, partyName: e.target.value })}
                    placeholder="Party or event name"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                  <datalist id="party-names">
                    {partyNames.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </label>
                <label className="block text-sm text-slate-700">
                  Date
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <label className="block text-sm text-slate-700 relative">
                  Menu item
                  <input
                    type="text"
                    value={menuQuery}
                    onChange={(e) => setMenuQuery(e.target.value)}
                    placeholder="Search menu items by name"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                  {menuQuery && (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white">
                      {menuItems.filter((m) => m.name.toLowerCase().includes(menuQuery.toLowerCase())).slice(0, 10).map((m) => (
                        <li
                          key={m.id}
                          onClick={() => handleSelectMenuItem(m.id)}
                          className="cursor-pointer px-4 py-2 text-sm hover:bg-slate-100"
                        >
                          {m.name}
                        </li>
                      ))}
                      {menuItems.filter((m) => m.name.toLowerCase().includes(menuQuery.toLowerCase())).length === 0 && (
                        <li className="px-4 py-2 text-sm text-slate-500">No matching items</li>
                      )}
                    </ul>
                  )}
                </label>
                <label className="block text-sm text-slate-700">
                  Selling price per portion
                  <input
                    type="number"
                    value={form.sellingPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Cost price per portion
                  <input
                    type="number"
                    value={form.costPerPortion}
                    onChange={(e) => setForm({ ...form, costPerPortion: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <label className="block text-sm text-slate-700">
                  Number of portions
                  <input
                    type="number"
                    value={form.portions}
                    onChange={(e) => setForm({ ...form, portions: Number(e.target.value) })}
                    min="1"
                    step="1"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Menu item name
                  <input
                    type="text"
                    value={selectedMenuItem?.name || ''}
                    disabled
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Notes (optional)
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Customer / party note"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Total revenue</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMVR(form.sellingPrice * form.portions)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Total cost</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMVR(form.costPerPortion * form.portions)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Projected profit</p>
                    <p className={`mt-2 text-2xl font-semibold ${form.sellingPrice - form.costPerPortion >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatMVR((form.sellingPrice - form.costPerPortion) * form.portions)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveOutsourceItem}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  <Plus className="h-4 w-4" /> {editingId ? 'Update Outsource' : 'Save Outsource'}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {/* Edit form modal */}
          {showFormModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
              <div className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{editingId ? 'Edit Outsource' : 'Add Outsource'}</h3>
                    <p className="text-sm text-slate-500">Create or update outsource entries.</p>
                  </div>
                  <button type="button" onClick={() => { setShowFormModal(false); if (!editingId) resetForm(); }} className="rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200">✕</button>
                </div>

                <div className="space-y-5">
                  {/* reuse same form fields as inline */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="block text-sm text-slate-700">
                      Party name
                      <input
                        type="text"
                        list="party-names"
                        value={form.partyName}
                        onChange={(e) => setForm({ ...form, partyName: e.target.value })}
                        placeholder="Party or event name"
                        className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                      />
                    </label>
                    <label className="block text-sm text-slate-700">
                      Date
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <label className="block text-sm text-slate-700 relative">
                      Menu item
                      <input
                        type="text"
                        value={menuQuery}
                        onChange={(e) => setMenuQuery(e.target.value)}
                        placeholder="Search menu items by name"
                        className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                      />
                      {menuQuery && (
                        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white">
                          {menuItems.filter((m) => m.name.toLowerCase().includes(menuQuery.toLowerCase())).slice(0, 10).map((m) => (
                            <li key={m.id} onClick={() => handleSelectMenuItem(m.id)} className="cursor-pointer px-4 py-2 text-sm hover:bg-slate-100">{m.name}</li>
                          ))}
                        </ul>
                      )}
                    </label>
                    <label className="block text-sm text-slate-700">
                      Selling price per portion
                      <input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} min="0" step="0.01" className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none" />
                    </label>
                    <label className="block text-sm text-slate-700">
                      Cost price per portion
                      <input type="number" value={form.costPerPortion} onChange={(e) => setForm({ ...form, costPerPortion: Number(e.target.value) })} min="0" step="0.01" className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none" />
                    </label>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <label className="block text-sm text-slate-700">
                      Number of portions
                      <input type="number" value={form.portions} onChange={(e) => setForm({ ...form, portions: Number(e.target.value) })} min="1" step="1" className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none" />
                    </label>
                    <label className="block text-sm text-slate-700">
                      Menu item name
                      <input type="text" value={selectedMenuItem?.name || ''} disabled className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none" />
                    </label>
                    <label className="block text-sm text-slate-700">
                      Notes (optional)
                      <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Customer / party note" className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none" />
                    </label>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Total revenue</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMVR(form.sellingPrice * form.portions)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Total cost</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMVR(form.costPerPortion * form.portions)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Projected profit</p>
                        <p className={`mt-2 text-2xl font-semibold ${form.sellingPrice - form.costPerPortion >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMVR((form.sellingPrice - form.costPerPortion) * form.portions)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={async () => { await saveOutsourceItem(); setShowFormModal(false); }} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"><Plus className="h-4 w-4" /> {editingId ? 'Update Outsource' : 'Save Outsource'}</button>
                    <button type="button" onClick={() => { setShowFormModal(false); resetForm(); }} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {showPaymentModal && paymentForm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
            <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Pay for party</h3>
                  <p className="text-sm text-slate-500">Record payment and choose source to deduct from.</p>
                </div>
                <button type="button" onClick={() => { setShowPaymentModal(false); setPaymentForm(null); }} className="rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200">✕</button>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <label className="block text-sm text-slate-700">
                  Amount (will use total cost)
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">Saved payment will be the outsource item's total cost.</p>
                </label>

                <label className="block text-sm text-slate-700">
                  Payment date
                  <input type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none" />
                </label>

                <label className="block text-sm text-slate-700">
                  Deduction date (for daily revenue)
                  <input type="date" value={paymentForm.deductionDate} onChange={(e) => setPaymentForm({ ...paymentForm, deductionDate: e.target.value })} className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none" />
                </label>
              </div>

              <div className="mt-4">
                <p className="text-sm text-slate-600">Payment source</p>
                <div className="mt-2 flex gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="radio" checked={paymentSource === 'dailyRevenue'} onChange={() => setPaymentSource('dailyRevenue')} />
                    Daily revenue
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="radio" checked={paymentSource === 'companyAccount'} onChange={() => setPaymentSource('companyAccount')} />
                    Company account
                  </label>
                </div>
              </div>

              {paymentSource === 'dailyRevenue' && (
                <div className="mt-4 rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Selected date totals</p>
                  {directRevenueEntry ? (
                    <div className="mt-2 text-sm text-slate-700">
                      <p>Cash total: {formatMVR(directRevenueEntry.cashTotal || 0)}</p>
                      <p>Card total: {formatMVR(directRevenueEntry.cardTotal || 0)}</p>
                      <p>Total direct revenue: {formatMVR(directRevenueEntry.totalDirectRevenue || 0)}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No direct revenue entry found for selected date.</p>
                  )}
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => savePayment(paymentSource)} className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500">Save payment</button>
                <button type="button" onClick={() => { setShowPaymentModal(false); setPaymentForm(null); }} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          </div>
        ) : null}

        {showBulkPayModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
            <div className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Bulk pay party items</h3>
                  <p className="text-sm text-slate-500">Select items to mark as paid and deduct from chosen source.</p>
                </div>
                <button type="button" onClick={() => setShowBulkPayModal(false)} className="rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm text-slate-600">Unpaid items</div>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={bulkAllSelected}
                        onChange={() => {
                          if (bulkAllSelected) {
                            setBulkSelectedIds({});
                          } else {
                            const sel: Record<string, boolean> = {};
                            bulkItems.forEach((it) => { sel[it.id] = true; });
                            setBulkSelectedIds(sel);
                          }
                        }}
                      />
                      Select all
                    </label>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {bulkItems.length === 0 ? (
                      <div className="text-sm text-slate-500">No unpaid items for this party.</div>
                    ) : (
                      bulkItems.map((it) => (
                        <label key={it.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="flex-1">
                            <div className="font-semibold">{it.menuItemName}</div>
                            <div className="text-sm text-slate-500">{it.date} · {it.portions} portions</div>
                          </div>
                          <div className="ml-4 flex items-center gap-4">
                            <div className="text-sm font-semibold">{formatMVR(it.totalCost)}</div>
                            <input type="checkbox" checked={!!bulkSelectedIds[it.id]} onChange={() => setBulkSelectedIds((s) => ({ ...s, [it.id]: !s[it.id] }))} />
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-2 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="text-xs text-slate-500">Total selected</p>
                    <p className="text-xl font-semibold text-slate-900">{formatMVR(bulkItems.reduce((s, it) => s + (bulkSelectedIds[it.id] ? it.totalCost : 0), 0))}</p>
                  </div>

                  <label className="block text-sm text-slate-700">
                    Payment date
                    <input type="date" value={bulkPaymentDate} onChange={(e) => setBulkPaymentDate(e.target.value)} className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none" />
                  </label>

                  <label className="block text-sm text-slate-700">
                    Deduction date (for daily revenue)
                    <input type="date" value={bulkDeductionDate} onChange={(e) => setBulkDeductionDate(e.target.value)} className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none" />
                  </label>

                  <div>
                    <p className="text-sm text-slate-600">Payment source</p>
                    <div className="mt-2 flex gap-3">
                      <label className="inline-flex items-center gap-2 text-sm"><input type="radio" checked={bulkPaymentSource === 'dailyRevenue'} onChange={() => setBulkPaymentSource('dailyRevenue')} /> Daily revenue</label>
                      <label className="inline-flex items-center gap-2 text-sm"><input type="radio" checked={bulkPaymentSource === 'companyAccount'} onChange={() => setBulkPaymentSource('companyAccount')} /> Company account</label>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveBulkPayment(bulkPaymentSource)}
                      disabled={bulkSelectedCount === 0}
                      className={`rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white ${bulkSelectedCount === 0 ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      Save payments
                    </button>
                    <button type="button" onClick={() => setShowBulkPayModal(false)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Saved party stats</h3>
              <p className="text-sm text-slate-500">Totals per party: paid, pending and remaining balances.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">{partyStats.length} parties</span>
          </div>

          {partyStats.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
              No party stats to show.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {partyStats.map((p) => (
                <div key={p.name} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                  <div className="mt-3 grid gap-2 grid-cols-3 text-sm">
                    <div>
                      <p className="text-xs uppercase text-slate-500">Paid</p>
                      <p className="font-semibold text-emerald-600">{formatMVR(p.paid)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500">Pending</p>
                      <p className="font-semibold text-slate-900">{formatMVR(p.pending)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500">Remaining</p>
                      <p className="font-semibold text-rose-600">{formatMVR(p.remaining)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Outsource item history</h3>
              <p className="text-sm text-slate-500">Review or modify saved outsource records.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">{items.length} records</span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
              No outsource items yet. Add one to begin tracking party costs and profits.
            </div>
          ) : (
            <div className="space-y-6">
              {partyGroups.map((party) => (
                <div key={party.name} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{party.name}</p>
                      <p className="text-sm text-slate-500">{party.items.length} record{party.items.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Total revenue</p>
                        <p className="font-semibold text-emerald-600">{formatMVR(party.totals.totalRevenue)}</p>
                        <p className="text-xs text-slate-500 mt-1">Total cost</p>
                        <p className="font-semibold text-slate-900">{formatMVR(party.totals.totalCost)}</p>
                        <p className="text-xs text-slate-500 mt-1">Profit</p>
                        <p className={`font-semibold ${party.totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMVR(party.totals.profit)}</p>
                      </div>
                      <div>
                        <button type="button" onClick={() => beginBulkPay(party.name)} className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-500">Pay All</button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {party.items.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{item.menuItemName}</p>
                            <p className="text-sm text-slate-500">{item.date} · Portions: {item.portions}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => beginEdit(item)}
                              className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-3 py-1 text-sm font-semibold text-slate-900 hover:bg-yellow-200"
                            >
                              <Edit3 className="h-4 w-4" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => beginPayParty(item)}
                              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                              {item.partyPaid ? 'Edit payment' : 'Pay'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteOutsourceItem(item.id)}
                              className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-3 text-sm text-slate-600">
                          <div className="flex-1">Revenue: <span className="font-semibold text-emerald-600">{formatMVR(item.totalRevenue)}</span></div>
                          <div className="flex-1">Cost: <span className="font-semibold text-slate-900">{formatMVR(item.totalCost)}</span></div>
                          <div className="flex-1">Profit: <span className={`font-semibold ${item.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMVR(item.profit)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Saved party names</h3>
              <p className="text-sm text-slate-500">Manage saved party names used for outsource entries.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">{partyNames.length} names</span>
          </div>

          {partyNames.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
              No saved party names.
            </div>
          ) : (
            <div className="space-y-2">
              {partyNames.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  {partyEditId === p.id ? (
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={partyEditName}
                        onChange={(e) => setPartyEditName(e.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={savePartyEdit}
                          className="rounded-full bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelPartyEdit}
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 text-sm font-semibold text-slate-900">{p.name}</div>
                  )}
                  <div className="flex items-center gap-2">
                    {partyEditId !== p.id ? (
                      <button
                        type="button"
                        onClick={() => beginPartyEdit(p)}
                        className="inline-flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-yellow-200"
                      >
                        Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => deleteParty(p.id)}
                      className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
