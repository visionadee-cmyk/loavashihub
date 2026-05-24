import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
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

interface PurchaseHistoryItemProps {
  purchase: DirectPurchase;
  onEdit: (purchase: DirectPurchase) => void;
  onDelete: (id: string) => void;
}

function PurchaseHistoryItem({ purchase, onEdit, onDelete }: PurchaseHistoryItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 hover:shadow-md transition">
      <div className="flex flex-wrap items-start justify-between mb-3 gap-3">
        <div className="flex-1">
          <p className="font-semibold text-slate-900">{purchase.shopName}</p>
          <p className="text-xs text-slate-400">{purchase.date}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(purchase)}
            className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-yellow-300 shadow-md hover:shadow-lg transition"
          >
            <Edit3 className="h-4 w-4" /> Edit Purchase
          </button>
          <button
            onClick={() => onDelete(purchase.id)}
            className="inline-flex items-center gap-1 rounded-3xl bg-red-50 px-3 py-2 text-red-600 hover:bg-red-100"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-3xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 inline-flex items-center gap-1"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {purchase.items.length} item{purchase.items.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-600">Subtotal: <span className="font-semibold text-slate-900">{formatMVR(purchase.subtotal)}</span></span>
        {purchase.gst > 0 && (
          <span className="text-slate-600">GST: <span className="font-semibold text-slate-900">{formatMVR(purchase.gst)}</span></span>
        )}
        <span className="text-emerald-600 font-bold">Total: {formatMVR(purchase.total)}</span>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">Items purchased:</p>
          <ul className="space-y-2">
            {purchase.items.map((item, index) => (
              <li key={index} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-medium text-slate-900 flex-1">{item.productName}</span>
                  <span className="text-slate-600 text-sm font-semibold">{formatMVR(item.totalCost)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                  <div>Qty: <span className="font-semibold text-slate-900">{item.quantity} {item.unit}</span></div>
                  <div>Unit: <span className="font-semibold text-slate-900">{formatMVR(item.unitCost)}/{item.unit}</span></div>
                  <div className="text-right">Total: <span className="font-semibold text-emerald-600">{formatMVR(item.totalCost)}</span></div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function DirectPurchasePage() {
  const { inventory, addInventoryItem } = useInventory();
  const [purchases, setPurchases] = useState<DirectPurchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Array<{ id?: string; name: string }>>([]);
  const [items, setItems] = useState<DirectPurchaseItem[]>([]);
  const [form, setForm] = useState({ shopName: '', productName: '', quantity: 1, unit: 'pcs', unitCost: 0, gst: 0, date: new Date().toISOString().slice(0, 10) });
  const [newItemUnit, setNewItemUnit] = useState('pcs');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

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
  const productSuggestions = useMemo(() => {
    const query = form.productName.trim().toLowerCase();
    if (!query) return products.slice(0, 6);
    return products.filter((product) => product.name.toLowerCase().includes(query)).slice(0, 6);
  }, [products, form.productName]);
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
      id: editingId ?? `dpurch-${Date.now()}`,
      shopName,
      items,
      gst: form.gst,
      subtotal,
      total,
      date: form.date || new Date().toISOString().slice(0, 10),
    };

    setPurchases((current) => {
      if (editingId) {
        return current.map((purchase) => (purchase.id === editingId ? payload : purchase));
      }
      return [payload, ...current];
    });

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
    setForm({ shopName: '', productName: '', quantity: 1, unit: 'pcs', unitCost: 0, gst: 0, date: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    setShowForm(false);

    if (hasFirebaseConfig) {
      try {
        await saveDocument('directPurchases', payload.id, payload);
      } catch (error) {
        console.error('Failed to save direct purchase:', error);
      }
    }
  };

  const beginEditPurchase = (purchase: DirectPurchase) => {
    setEditingId(purchase.id);
    setForm({
      shopName: purchase.shopName,
      productName: '',
      quantity: 1,
      unit: 'pcs',
      unitCost: 0,
      gst: purchase.gst,
      date: purchase.date,
    });
    setItems(purchase.items);
    setShowForm(true);
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

  const cancelPurchaseEdit = () => {
    setEditingId(null);
    setItems([]);
    setForm({ shopName: '', productName: '', quantity: 1, unit: 'pcs', unitCost: 0, gst: 0, date: new Date().toISOString().slice(0, 10) });
  };

  // Group purchases by date and calculate daily totals
  const groupedPurchases = useMemo(() => {
    const grouped: { [key: string]: DirectPurchase[] } = {};
    const sortedPurchases = [...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    sortedPurchases.forEach((purchase) => {
      if (!grouped[purchase.date]) {
        grouped[purchase.date] = [];
      }
      grouped[purchase.date].push(purchase);
    });
    
    return grouped;
  }, [purchases]);

  return (
    <AppShell title="Direct Purchase">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Direct Purchase Entry</h3>
              <p className="text-sm text-slate-500">Add items directly without RFQ and track total expense.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="whitespace-nowrap inline-flex items-center gap-2 rounded-full bg-lime-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-lime-300 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="h-5 w-5" /> {showForm ? 'Cancel' : 'Add direct purchase'}
            </button>
          </div>

          {showForm && (
          <>
          <div className="mb-4 rounded-3xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">{editingId ? '✎ Editing Purchase' : 'Adding New Purchase'}</p>
          </div>
          <div className="grid gap-4 mb-6">
            <label className="block text-sm text-slate-600">
              Shop name
              <div className="relative mt-2">
                <input
                  value={form.shopName}
                  onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                  onFocus={() => setIsShopDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsShopDropdownOpen(false), 200)}
                  placeholder="Supplier name"
                  className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                />
                {supplierSuggestions.length > 0 && form.shopName.trim() && isShopDropdownOpen && (
                  <div className="absolute left-0 right-0 z-10 mt-1 max-h-52 overflow-auto rounded-3xl border border-slate-200 bg-white shadow-xl">
                    {supplierSuggestions.map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => {
                          setForm((current) => ({ ...current, shopName: supplier.name }));
                          setIsShopDropdownOpen(false);
                        }}
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
              Purchase date
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
              />
            </label>

            <label className="block text-sm text-slate-500">
              Product name
              <div className="relative mt-2">
                <input
                  value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  onFocus={() => setIsProductDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsProductDropdownOpen(false), 200)}
                  placeholder="Start typing to search"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                />
                {productSuggestions.length > 0 && form.productName.trim() && isProductDropdownOpen && (
                  <div className="absolute left-0 right-0 z-10 mt-1 max-h-52 overflow-auto rounded-3xl border border-slate-200 bg-white shadow-xl">
                    {productSuggestions.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => {
                          setForm((current) => ({ ...current, productName: product.name }));
                          setIsProductDropdownOpen(false);
                        }}
                        className="w-full cursor-pointer border-b border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100 last:border-b-0"
                      >
                        {product.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
          </>
          )}

          {items.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 space-y-3">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-slate-900 text-sm">Items ({items.length})</p>
              </div>
              {items.map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="font-semibold text-slate-900">{item.productName}</p>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-5">
                    <div className="text-sm">
                      <p className="text-slate-500 text-xs mb-1">Quantity</p>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-2 py-2 text-slate-900"
                        placeholder="Qty"
                      />
                    </div>
                    <div className="text-sm">
                      <p className="text-slate-500 text-xs mb-1">Unit</p>
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-2 py-2 text-slate-900"
                      >
                        {unitOptions.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    <div className="text-sm">
                      <p className="text-slate-500 text-xs mb-1">Unit Cost (MVR)</p>
                      <input
                        type="number"
                        min={0}
                        value={item.unitCost}
                        onChange={(e) => updateItem(item.id, 'unitCost', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-2 py-2 text-slate-900"
                        placeholder="Cost"
                      />
                    </div>
                    <div className="text-sm">
                      <p className="text-slate-500 text-xs mb-1">Total</p>
                      <div className="rounded-2xl bg-slate-100 px-2 py-2 text-slate-700 font-semibold">
                        {formatMVR(item.totalCost)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-6 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <label className="block text-sm text-slate-500">
                  Purchase date
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
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
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="text-slate-900 font-semibold">{formatMVR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">GST</span>
                    <span className="text-slate-900 font-semibold">{formatMVR(gstAmount)}</span>
                  </div>
                  <div className="border-t border-emerald-200 pt-2 mt-2 flex justify-between">
                    <span className="text-slate-900 font-semibold">Total</span>
                    <span className="text-lg font-bold text-emerald-600">{formatMVR(total)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center pt-2">
                <button
                  onClick={savePurchase}
                  className="flex-1 rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  {editingId ? 'Update Purchase' : 'Save Purchase'}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={cancelPurchaseEdit}
                    className="flex-1 rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900 mb-4">Purchase History</h3>
          <div className="space-y-3">
            {purchases.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No purchases yet. Add your first direct purchase above.</p>
            ) : null}
            {purchases.length > 0 && (
              <p className="text-xs text-slate-500 mb-3">{purchases.length} purchase(s) recorded</p>
            )}
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {Object.entries(groupedPurchases).map(([date, dayPurchases]) => {
                const dailyTotal = dayPurchases.reduce((sum, p) => sum + p.total, 0);
                const formattedDate = new Date(date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                
                return (
                  <div key={date} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
                      <div>
                        <p className="font-semibold text-slate-900">{formattedDate}</p>
                        <p className="text-xs text-slate-500">{dayPurchases.length} transaction(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Daily Total</p>
                        <p className="text-lg font-bold text-emerald-600">{formatMVR(dailyTotal)}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {dayPurchases.map((purchase) => (
                        <PurchaseHistoryItem
                          key={purchase.id}
                          purchase={purchase}
                          onEdit={beginEditPurchase}
                          onDelete={deletePurchase}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
