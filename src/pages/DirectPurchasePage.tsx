import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useInventory } from '../context/InventoryContext';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import { generateInventoryProductId, generateInventoryProductNumber } from '../lib/ids';
import type { DirectPurchaseItem, DirectPurchase, Supplier } from '../types';

const unitOptions = [
  'pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'pack', 'dozen', 'bottle', 'bag',
  'sheet', 'slice', 'packet', 'roll', 'piece', 'carton', 'case', 'jar',
];

export default function DirectPurchasePage() {
  const { inventory, addInventoryItem } = useInventory();
  const [purchases, setPurchases] = useState<DirectPurchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Array<{ id?: string; name: string }>>([]);
  const [items, setItems] = useState<DirectPurchaseItem[]>([]);
  const [form, setForm] = useState({ shopName: '', productName: '', quantity: 1, unit: 'pcs', unitCost: 0, gst: 0 });
  const [newItemUnit, setNewItemUnit] = useState('pcs');

  useEffect(() => {
    if (!hasFirebaseConfig) return;

    Promise.all([
      loadCollection<DirectPurchase>('directPurchases', []),
      loadCollection<Supplier>('suppliers', []),
    ])
      .then(([loadedPurchases, loadedSuppliers]) => {
        if (loadedPurchases.length) setPurchases(loadedPurchases);
        if (loadedSuppliers.length) setSuppliers(loadedSuppliers);
      })
      .catch((error) => console.error('Failed to load direct purchases or suppliers:', error));
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

  const itemExists = form.productName.trim() && products.some((item) => item.name.toLowerCase() === form.productName.trim().toLowerCase());
  const supplierSuggestions = useMemo(() => {
    const query = form.shopName.trim().toLowerCase();
    if (!query) return suppliers.slice(0, 6);
    return suppliers.filter((supplier) => supplier.name.toLowerCase().includes(query)).slice(0, 6);
  }, [suppliers, form.shopName]);
  const shopAlreadySaved = suppliers.some((supplier) => supplier.name.toLowerCase() === form.shopName.trim().toLowerCase());

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.totalCost, 0), [items]);
  const gstAmount = useMemo(() => form.gst || 0, [form.gst]);
  const total = useMemo(() => subtotal + gstAmount, [subtotal, gstAmount]);

  const createInventoryItem = () => {
    const name = form.productName.trim();
    if (!name || itemExists) return;

    addInventoryItem({
      id: `stock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productId: generateInventoryProductId(),
      productNumber: generateInventoryProductNumber(),
      name,
      quantity: 0,
      unit: newItemUnit,
      lowStock: 5,
    });
  };

  const savePurchase = async () => {
    if (!items.length || !form.shopName.trim()) return;

    const shopName = form.shopName.trim();
    const payload: DirectPurchase = {
      id: `dpurch-${Date.now()}`,
      shopName,
      items,
      gst: form.gst,
      subtotal,
      total,
      date: new Date().toISOString().slice(0, 10),
    };

    setPurchases((current) => [payload, ...current]);

    if (!shopAlreadySaved) {
      const newSupplier = {
        id: `supplier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: shopName,
        createdAt: new Date().toISOString(),
      };
      setSuppliers((current) => [newSupplier, ...current]);
      if (hasFirebaseConfig) {
        saveDocument('suppliers', newSupplier.id, newSupplier).catch((error) => console.error('Failed to save supplier:', error));
      }
    }

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
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-900">Direct Purchase Entry</h3>
            <p className="text-sm text-slate-500">Add items directly without RFQ and track total expense.</p>
          </div>

          <div className="grid gap-4 mb-6">
            <label className="block text-sm text-slate-600">
              Shop name
              <div className="relative mt-2">
                <input
                  value={form.shopName}
                  onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                  placeholder="Supplier name"
                  className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                />
                {supplierSuggestions.length > 0 && form.shopName.trim() && (
                  <div className="absolute left-0 right-0 z-10 mt-1 max-h-52 overflow-auto rounded-3xl border border-slate-200 bg-white shadow-xl">
                    {supplierSuggestions.map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, shopName: supplier.name }))}
                        className="w-full cursor-pointer border-b border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100 last:border-b-0"
                      >
                        {supplier.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!shopAlreadySaved && form.shopName.trim() ? (
                <p className="mt-2 text-xs text-emerald-700">This is a new shop. It will be saved for future direct purchases.</p>
              ) : null}
            </label>

            <label className="block text-sm text-slate-500">
              Product name
              <input
                list="product-list"
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                placeholder="Start typing to search"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
              />
              <datalist id="product-list">
                {products.map((product) => (
                  <option key={product.id} value={product.name} />
                ))}
              </datalist>
            </label>

            {form.productName.trim() && !itemExists && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-slate-900">
                <p className="text-sm">The item "{form.productName}" is not in inventory yet.</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="flex-1 text-sm text-slate-700">
                    Unit
                    <select
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                    >
                      {unitOptions.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={createInventoryItem}
                    className="rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    Add item to inventory
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm text-slate-500">
                Quantity
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-500">
                Unit
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                >
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-500">
                Unit cost (MVR)
                <input
                  type="number"
                  min={0}
                  value={form.unitCost}
                  onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                />
              </label>
            </div>

            <button
              onClick={addItem}
              disabled={!form.productName.trim() || !form.shopName.trim()}
              className="mt-4 w-full rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4 inline mr-2" /> Add item
            </button>
          </div>

          {items.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="font-semibold text-slate-900 text-sm">{item.productName}</p>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-400"
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
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1 text-slate-900"
                      placeholder="Qty"
                    />
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1 text-slate-900"
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
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1 text-slate-900"
                      placeholder="Cost"
                    />
                    <span className="rounded-2xl bg-slate-100 px-2 py-1 text-slate-700">
                      {formatMVR(item.totalCost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-6 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
                <label className="block text-sm text-slate-500">
                  GST amount (MVR)
                  <input
                    type="number"
                    min={0}
                    value={form.gst}
                    onChange={(e) => setForm({ ...form, gst: Number(e.target.value) })}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="text-slate-900 font-semibold">{formatMVR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-3">
                    <span className="text-slate-500">GST amount</span>
                    <span className="text-slate-900 font-semibold">{formatMVR(gstAmount)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between">
                    <span className="text-slate-900 font-semibold">Total</span>
                    <span className="text-lg font-bold text-emerald-600">{formatMVR(total)}</span>
                  </div>
                </div>
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

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900 mb-4">Purchase History</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-slate-900">{purchase.shopName}</p>
                  <button
                    onClick={() => deletePurchase(purchase.id)}
                    className="text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-2">{purchase.date}</p>
                <p className="text-sm text-slate-600 mb-2">{purchase.items.length} item(s)</p>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total (with GST amount)</p>
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
