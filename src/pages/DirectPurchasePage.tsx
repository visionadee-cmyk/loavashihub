import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useInventory } from '../context/InventoryContext';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { DirectPurchaseItem, DirectPurchase } from '../types';

const unitOptions = [
  'pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'pack', 'dozen', 'bottle', 'bag',
  'sheet', 'slice', 'packet', 'roll', 'piece', 'carton', 'case', 'jar',
];

export default function DirectPurchasePage() {
  const { inventory } = useInventory();
  const [purchases, setPurchases] = useState<DirectPurchase[]>([]);
  const [products, setProducts] = useState<Array<{ id?: string; name: string }>>([]);
  const [items, setItems] = useState<DirectPurchaseItem[]>([]);
  const [form, setForm] = useState({ shopName: '', productName: '', quantity: 1, unit: 'pcs', unitCost: 0, gst: 0 });

  useEffect(() => {
    if (!hasFirebaseConfig) return;

    Promise.all([
      loadCollection<DirectPurchase>('directPurchases', []),
    ])
      .then(([loadedPurchases]) => {
        if (loadedPurchases.length) setPurchases(loadedPurchases);
      })
      .catch((error) => console.error('Failed to load direct purchases:', error));
  }, []);

  useEffect(() => {
    if (!inventory?.length) return;
    const invOptions = inventory.map((item) => ({ id: item.id, name: item.name }));
    setProducts(invOptions);
  }, [inventory]);

  const addItem = () => {
    if (!form.productName.trim() || !form.shopName.trim() || form.quantity <= 0 || form.unitCost < 0) return;

    const newItem: DirectPurchaseItem = {
      id: `dpurch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productName: form.productName.trim(),
      quantity: form.quantity,
      unit: form.unit,
      unitCost: form.unitCost,
      totalCost: form.quantity * form.unitCost,
    };

    setItems((current) => [newItem, ...current]);
    setForm({ ...form, productName: '', quantity: 1, unit: 'pcs', unitCost: 0 });
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: string, value: number | string) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (field === 'quantity' || field === 'unitCost') {
          const qty = field === 'quantity' ? Number(value) : item.quantity;
          const cost = field === 'unitCost' ? Number(value) : item.unitCost;
          return { ...item, [field]: value, totalCost: qty * cost };
        }
        return { ...item, [field]: value };
      }),
    );
  };

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.totalCost, 0), [items]);
  const gstAmount = useMemo(() => (subtotal * (form.gst || 0)) / 100, [subtotal, form.gst]);
  const total = useMemo(() => subtotal + gstAmount, [subtotal, gstAmount]);

  const savePurchase = async () => {
    if (!items.length || !form.shopName.trim()) return;

    const payload: DirectPurchase = {
      id: `dpurch-${Date.now()}`,
      shopName: form.shopName.trim(),
      items,
      gst: form.gst,
      subtotal,
      total,
      date: new Date().toISOString().slice(0, 10),
    };

    setPurchases((current) => [payload, ...current]);
    setItems([]);
    setForm({ shopName: '', productName: '', quantity: 1, unit: 'pcs', unitCost: 0, gst: 0 });

    if (hasFirebaseConfig) {
      try {
        await saveDocument('directPurchases', payload.id, payload);
      } catch (error) {
        console.error('Failed to save direct purchase:', error);
      }
    }
  };

  const deletePurchase = async (id: string) => {
    setPurchases((current) => current.filter((p) => p.id !== id));
    if (hasFirebaseConfig) {
      try {
        await deleteDocument('directPurchases', id);
      } catch (error) {
        console.error('Failed to delete direct purchase:', error);
      }
    }
  };

  return (
    <AppShell title="Direct Purchase">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white">Direct Purchase Entry</h3>
            <p className="text-sm text-slate-400">Add items directly without RFQ and track total expense.</p>
          </div>

          <div className="grid gap-4 mb-6">
            <label className="block text-sm text-slate-300">
              Shop name
              <input
                value={form.shopName}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                placeholder="Supplier name"
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              />
            </label>

            <label className="block text-sm text-slate-300">
              Product name
              <input
                list="product-list"
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                placeholder="Start typing to search"
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              />
              <datalist id="product-list">
                {products.map((product) => (
                  <option key={product.id} value={product.name} />
                ))}
              </datalist>
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm text-slate-300">
                Quantity
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Unit
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                >
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Unit cost (MVR)
                <input
                  type="number"
                  min={0}
                  value={form.unitCost}
                  onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
            </div>

            <label className="block text-sm text-slate-300">
              GST (%)
              <input
                type="number"
                min={0}
                max={100}
                value={form.gst}
                onChange={(e) => setForm({ ...form, gst: Number(e.target.value) })}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              />
            </label>

            <button
              onClick={addItem}
              disabled={!form.productName.trim() || !form.shopName.trim()}
              className="mt-4 w-full rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4 inline mr-2" /> Add item
            </button>
          </div>

          {items.length > 0 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-3">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="font-semibold text-white text-sm">{item.productName}</p>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4 text-sm">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                      placeholder="Qty"
                    />
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                    >
                      {unitOptions.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={item.unitCost}
                      onChange={(e) => updateItem(item.id, 'unitCost', e.target.value)}
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                      placeholder="Cost"
                    />
                    <span className="rounded-2xl bg-slate-800 px-2 py-1 text-slate-100">
                      {formatMVR(item.totalCost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-6 space-y-3 rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Subtotal</span>
                <span className="text-white font-semibold">{formatMVR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">GST ({form.gst}%)</span>
                <span className="text-white font-semibold">{formatMVR(gstAmount)}</span>
              </div>
              <div className="border-t border-slate-700 pt-3 flex justify-between">
                <span className="text-white font-semibold">Total</span>
                <span className="text-lg font-bold text-emerald-400">{formatMVR(total)}</span>
              </div>
              <button
                onClick={savePurchase}
                className="w-full mt-4 rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Save Purchase
              </button>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
          <h3 className="text-xl font-semibold text-white mb-4">Purchase History</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-white">{purchase.shopName}</p>
                  <button
                    onClick={() => deletePurchase(purchase.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-2">{purchase.date}</p>
                <p className="text-sm text-slate-300 mb-2">{purchase.items.length} item(s)</p>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total (with {purchase.gst}% GST)</p>
                  <p className="text-lg font-bold text-emerald-400">{formatMVR(purchase.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
