import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Minus, Printer } from 'lucide-react';
import AppShell from '../components/AppShell';
import { formatMVR } from '../lib/mvr';
import { hasFirebaseConfig } from '../lib/firebase';
import { deleteDocument, loadCollection, saveDocument } from '../lib/firestore';
import type { Bill, MenuItem, OrderItem, TableItem } from '../types';
import beveragesDataRaw from '../data/beverages.json?raw';
import chickenRecipesDataRaw from '../data/chickenrecipes.json?raw';
import foniHedhikaaDataRaw from '../data/fonihedhikaa.json?raw';
import hedhikaaDataRaw from '../data/hedhikaa.json?raw';
import maldiviaCurriesDataRaw from '../data/maldiviacurries.json?raw';

const orderTypes = ['Dine-in', 'Takeaway', 'Delivery'] as const;
const paymentMethods = ['Cash', 'Card', 'Bank transfer'] as const;
const placeholderImage = 'https://via.placeholder.com/400x300?text=Menu+Item';
const APP_NAME = 'Loavashi Hub';
const CAFE_DETAILS = 'Loavashi Hub Café · Malé, Maldives · +960 1234 5678';

function generateBillNumber(tableName: string) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const prefix = tableName.trim() || 'Table';
  return `${prefix} ${year}${month}${day}${hour}${minute}${second}`;
}

function buildItem(product: MenuItem): OrderItem {
  return {
    id: `${product.id}-${Date.now()}`,
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity: 1,
    notes: '',
  };
}

function createEmptyBill(tableName: string): Bill {
  const billNumber = generateBillNumber(tableName);
  return {
    id: `bill-${Date.now()}`,
    billNumber,
    title: billNumber,
    table: tableName,
    items: [],
    orderType: 'Dine-in',
    discount: 0,
    tax: 5,
    status: 'Pending',
    notes: '',
    paymentMethod: 'Cash',
    paymentStatus: 'Unpaid',
    createdAt: new Date().toISOString(),
  };
}

function parseFallbackMenuItems(): MenuItem[] {
  const fallbackSources = [
    { raw: beveragesDataRaw, category: 'Beverages' },
    { raw: chickenRecipesDataRaw, category: 'Chicken' },
    { raw: foniHedhikaaDataRaw, category: 'Foni Heddikaa' },
    { raw: hedhikaaDataRaw, category: 'Hedhikaa' },
    { raw: maldiviaCurriesDataRaw, category: 'Maldivian Curries' },
  ];

  return fallbackSources.flatMap(({ raw, category }) => {
    const items = JSON.parse(raw) as Array<Record<string, unknown>>;
    return items.map((item) => {
      const name = String(item.title ?? item.name ?? 'Menu item');
      const ingredients = Array.isArray(item.ingredients) ? item.ingredients : [];
      const description = ingredients
        .slice(0, 3)
        .map((ingredient) => (typeof ingredient === 'object' && ingredient !== null ? String((ingredient as any).name ?? '') : String(ingredient)))
        .filter(Boolean)
        .join(', ');

      return {
        id: `fallback-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        category,
        price: 0,
        costPrice: 0,
        description: description || `Imported ${category} item`,
        image: placeholderImage,
      };
    });
  });
}

export default function POSPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [activeBillId, setActiveBillId] = useState<string>('');
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);

  const persistBill = async (bill: Bill) => {
    if (!hasFirebaseConfig) return;
    try {
      await saveDocument('bills', bill.id, bill);
    } catch (error) {
      console.error('Failed to persist bill:', error);
    }
  };

  useEffect(() => {
    const fallbackProducts = parseFallbackMenuItems();
    const fallbackTables: TableItem[] = [
      { id: 'table-1', name: 'Table 1', seats: 4, section: 'Indoor' },
    ];

    if (!hasFirebaseConfig) {
      setProducts(fallbackProducts);
      setTables(fallbackTables);
      const newBill = createEmptyBill(fallbackTables[0].name);
      setBills([newBill]);
      setActiveBillId(newBill.id);
      return;
    }

    const loadData = async () => {
      try {
        const [loadedProducts, loadedTables, loadedBills] = await Promise.all([
          loadCollection<MenuItem>('menuItems', []),
          loadCollection<TableItem>('tables', []),
          loadCollection<Bill>('bills', []),
        ]);

        setProducts(loadedProducts.length ? loadedProducts : fallbackProducts);
        setTables(loadedTables.length ? loadedTables : fallbackTables);

        if (loadedBills.length) {
          setBills(loadedBills);
          setActiveBillId(loadedBills[0].id);
          return;
        }

        const defaultTable = (loadedTables[0]?.name ?? fallbackTables[0].name) as string;
        const newBill = createEmptyBill(defaultTable);
        setBills([newBill]);
        setActiveBillId(newBill.id);
      } catch (error) {
        console.error('Failed to load POS data from Firestore:', error);
        setProducts(fallbackProducts);
        setTables(fallbackTables);
        const newBill = createEmptyBill(fallbackTables[0].name);
        setBills([newBill]);
        setActiveBillId(newBill.id);
      }
    };

    loadData();
  }, []);

  const activeBill = bills.find((bill) => bill.id === activeBillId) ?? bills[0] ?? createEmptyBill(tables[0]?.name ?? 'Table 1');

  const updateBill = (updatedBill: Bill) => {
    setBills((current) => current.map((bill) => (bill.id === updatedBill.id ? updatedBill : bill)));
    persistBill(updatedBill);
  };

  const saveCurrentBill = () => {
    if (activeBill.items.length === 0) {
      window.alert('Add at least one item before saving the bill.');
      return;
    }
    if (activeBill.status === 'Pending') {
      updateBill({ ...activeBill, status: 'Pending' });
    } else {
      persistBill(activeBill);
    }
    window.alert('Bill saved successfully. It is now active.');
  };

  const payCurrentBill = () => {
    if (activeBill.items.length === 0) {
      window.alert('Add items before completing the bill.');
      return;
    }
    updateBill({ ...activeBill, status: 'Served', paymentStatus: 'Paid' });
  };

  const activeBills = bills.filter((bill) => bill.status !== 'Served');
  const completedBills = bills.filter((bill) => bill.status === 'Served');
  const occupiedTableCount = useMemo(() => new Set(activeBills.map((bill) => bill.table)).size, [activeBills]);
  const selectedBills = bills.filter((bill) => selectedBillIds.includes(bill.id));
  const canMergeSelected = selectedBills.length === 2;

  const toggleBillSelection = (billId: string) => {
    setSelectedBillIds((current) =>
      current.includes(billId) ? current.filter((id) => id !== billId) : [...current, billId],
    );
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const subtotal = useMemo(
    () => activeBill.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [activeBill.items],
  );
  const taxAmount = Math.round((subtotal * activeBill.tax) / 100);
  const total = subtotal + taxAmount - activeBill.discount;

  const handleAddItem = (product: MenuItem) => {
    const updatedBill = {
      ...activeBill,
      items: activeBill.items.some((item) => item.productId === product.id)
        ? activeBill.items.map((item) =>
            item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...activeBill.items, buildItem(product)],
    };

    updateBill(updatedBill);
  };

  const updateQuantity = (itemId: string, amount: number) => {
    const updatedBill = {
      ...activeBill,
      items: activeBill.items
        .map((item) =>
          item.id === itemId ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item,
        )
        .filter((item) => item.quantity > 0),
    };
    updateBill(updatedBill);
  };

  const createBill = () => {
    const nextBill = createEmptyBill(tables[0]?.name ?? 'Table 1');
    setBills((current) => [...current, nextBill]);
    setActiveBillId(nextBill.id);
    persistBill(nextBill);
  };

  const mergeSelectedBills = async () => {
    if (!canMergeSelected) {
      window.alert('Select exactly two bills to merge.');
      return;
    }

    const [target, source] = selectedBills;
    const mergedItems = [...target.items, ...source.items].reduce<OrderItem[]>((acc, item) => {
      const existing = acc.find((entry) => entry.productId === item.productId && entry.notes === item.notes);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        acc.push({ ...item });
      }
      return acc;
    }, []);

    const updatedTarget = { ...target, items: mergedItems };
    setBills((current) =>
      current
        .filter((bill) => bill.id !== source.id)
        .map((bill) => (bill.id === target.id ? updatedTarget : bill)),
    );
    setActiveBillId(target.id);
    setSelectedBillIds([]);
    updateBill(updatedTarget);
    await deleteDocument('bills', source.id);
  };

  const splitBill = (itemId: string) => {
    const itemToSplit = activeBill.items.find((item) => item.id === itemId);
    if (!itemToSplit || itemToSplit.quantity < 2) return;
      const updatedOriginal = {
        ...activeBill,
        items: activeBill.items.map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item,
        ),
      };
      const splitBillId = `bill-${Date.now()}`;
      const splitItem = { ...itemToSplit, id: `${itemToSplit.id}-split`, quantity: 1 };
      const splitBill: Bill = {
        id: splitBillId,
        title: `Bill ${String.fromCharCode(65 + bills.length)}`,
        table: activeBill.table,
        items: [splitItem],
        orderType: activeBill.orderType,
        discount: 0,
        tax: activeBill.tax,
        status: 'Pending',
        notes: activeBill.notes,
        paymentMethod: activeBill.paymentMethod,
        paymentStatus: 'Unpaid',
        createdAt: new Date().toISOString(),
      };

      setBills((current) => [...current.map((bill) => (bill.id === activeBill.id ? updatedOriginal : bill)), splitBill]);
      updateBill(updatedOriginal);
      persistBill(splitBill);
    };

  const printReceipt = () => {
    const receiptContent = `
      <html>
      <head>
        <title>Receipt</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
          h1 { margin: 0 0 8px; }
          .line { border-bottom: 1px dashed #ccc; margin: 12px 0; }
          .item { display: flex; justify-content: space-between; margin: 6px 0; }
          .footer { margin-top: 24px; }
        </style>
      </head>
      <body>
        <h1>${APP_NAME}</h1>
        <p>${CAFE_DETAILS}</p>
        <p>Invoice: ${activeBill.billNumber ?? activeBill.title}</p>
        <p>Table: ${activeBill.table} · ${activeBill.orderType}</p>
        <p>${new Date(activeBill.createdAt).toLocaleString()}</p>
        <div class="line"></div>
        ${activeBill.items
          .map(
            (item) =>
              `<div class="item"><span>${item.quantity} x ${item.name}</span><span>${formatMVR(item.price * item.quantity)}</span></div>`,
          )
          .join('')}
        <div class="line"></div>
        <div class="item"><strong>Subtotal</strong><strong>${formatMVR(subtotal)}</strong></div>
        <div class="item"><span>Tax ${activeBill.tax}%</span><span>${formatMVR(taxAmount)}</span></div>
        <div class="item"><span>Discount</span><span>${formatMVR(activeBill.discount)}</span></div>
        <div class="item"><strong>Total</strong><strong>${formatMVR(total)}</strong></div>
        <div class="footer"><p>Thank you for dining with us.</p></div>
      </body>
      </html>`;
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (printWindow) {
      printWindow.document.write(receiptContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <AppShell title="POS Billing">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="relative rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-300">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search menu items"
                    className="w-full bg-transparent pl-10 text-sm text-white outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={createBill}
                  className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  <Plus className="h-4 w-4" />
                  New bill
                </button>
                <button
                  type="button"
                  onClick={mergeSelectedBills}
                  disabled={!canMergeSelected}
                  className="inline-flex items-center gap-2 rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Merge bills
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Active bills</p>
                <p className="mt-3 text-2xl font-semibold text-white">{activeBills.length}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Tables occupied</p>
                <p className="mt-3 text-2xl font-semibold text-white">{occupiedTableCount}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Completed bills</p>
                <p className="mt-3 text-2xl font-semibold text-white">{completedBills.length}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span className="rounded-full bg-slate-800 px-3 py-2">Select two bills to merge</span>
              <span className="rounded-full bg-slate-800 px-3 py-2">Marked served bills are counted as completed</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {bills.map((bill) => (
                <button
                  key={bill.id}
                  type="button"
                  onClick={() => setActiveBillId(bill.id)}
                  className={`rounded-3xl px-4 py-2 text-sm ${bill.id === activeBill.id ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {bill.title}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
              {['All', ...Array.from(new Set(products.map((product) => product.category)))].map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-3xl px-4 py-2 text-sm font-medium transition ${
                    activeCategory === category ? 'bg-violet-500 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

          <div className="grid gap-4 md:grid-cols-2">
            {filteredProducts.map((product) => (
              <motion.article
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/20"
              >
                <div className="flex items-start gap-4">
                  <img src={product.image} alt={product.name} className="h-20 w-20 rounded-3xl object-cover" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">{product.name}</h3>
                      <span className="text-sm text-violet-300">{formatMVR(product.price)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{product.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddItem(product)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Add to bill
                </button>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Active bill</p>
                <h3 className="text-2xl font-semibold text-white">{activeBill.title}</h3>
                <p className="text-sm text-slate-400">
                  {activeBill.billNumber ?? activeBill.title} · {activeBill.table} · {activeBill.orderType}
                </p>
                <p className="text-sm text-slate-400">Created {new Date(activeBill.createdAt).toLocaleString()}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={saveCurrentBill}
                  className="rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 hover:bg-slate-800"
                >
                  Save bill
                </button>
                <button
                  type="button"
                  onClick={payCurrentBill}
                  className="rounded-3xl border border-emerald-600 bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  Pay & complete
                </button>
                <button
                  type="button"
                  onClick={printReceipt}
                  className="rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  <Printer className="mr-2 inline-block h-4 w-4" />
                  Print receipt
                </button>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  Table selection
                  <select
                    value={activeBill.table}
                    onChange={(event) => {
                      const table = event.target.value;
                      updateBill({ ...activeBill, table });
                    }}
                    className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  >
                    {tables.map((table) => (
                      <option key={table.id} value={table.name}>{table.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-slate-300">
                  Order type
                  <select
                    value={activeBill.orderType}
                    onChange={(event) => {
                      const orderType = event.target.value as typeof orderTypes[number];
                      updateBill({ ...activeBill, orderType });
                    }}
                    className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  >
                    {orderTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm text-slate-300">
                Notes for kitchen
                <textarea
                  value={activeBill.notes}
                  onChange={(event) => updateBill({ ...activeBill, notes: event.target.value })}
                  className="mt-2 h-24 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  placeholder="Add order instructions"
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Bills</p>
                <p className="text-lg font-semibold text-white">{bills.length} active bill{bills.length > 1 ? 's' : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {bills.map((bill) => (
                  <label
                    key={bill.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-3xl border px-4 py-3 text-sm transition ${selectedBillIds.includes(bill.id) ? 'border-violet-500 bg-slate-800 text-white' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600 hover:bg-slate-900'}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedBillIds.includes(bill.id)}
                      onChange={() => toggleBillSelection(bill.id)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-500 focus:ring-violet-500"
                    />
                    <span>{bill.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">Order items</h3>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{activeBill.status}</span>
            </div>

            {activeBill.items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center text-slate-400">No items added yet.</div>
            ) : (
              <div className="space-y-3">
                {activeBill.items.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-3xl border border-slate-800 bg-slate-900 px-4 py-4 md:grid-cols-[1fr_auto]">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">{item.name}</p>
                        <button
                          type="button"
                          onClick={() => splitBill(item.id)}
                          className="rounded-2xl bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
                        >
                          Split
                        </button>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{formatMVR(item.price)} each</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 rounded-3xl border border-slate-700 bg-slate-950 px-3 py-2">
                        <button type="button" onClick={() => updateQuantity(item.id, -1)} className="rounded-full bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"><Minus className="h-3 w-3" /></button>
                        <span className="text-sm text-white">{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.id, 1)} className="rounded-full bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"><Plus className="h-3 w-3" /></button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">Total</p>
                        <p className="font-semibold text-white">{formatMVR(item.price * item.quantity)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  Discount
                  <input
                    type="number"
                    min={0}
                    value={activeBill.discount}
                    onChange={(event) => {
                      const discount = Number(event.target.value);
                      setBills((current) =>
                        current.map((bill) => (bill.id === activeBill.id ? { ...bill, discount } : bill)),
                      );
                    }}
                    className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Payment type
                  <select
                    value={activeBill.paymentMethod}
                    onChange={(event) => {
                      const paymentMethod = event.target.value as typeof paymentMethods[number];
                      setBills((current) =>
                        current.map((bill) => (bill.id === activeBill.id ? { ...bill, paymentMethod } : bill)),
                      );
                    }}
                    className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Subtotal</span>
                    <span>{formatMVR(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Tax</span>
                    <span>{formatMVR(taxAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Discount</span>
                    <span>{formatMVR(activeBill.discount)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xl font-semibold text-white">
                    <span>Total</span>
                    <span>{formatMVR(total)}</span>
                  </div>
                </div>
              </div>
              <button type="button" onClick={printReceipt} className="inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-violet-600 px-4 py-4 text-sm font-semibold text-white hover:bg-violet-500">
                <Printer className="h-4 w-4" />
                Print thermal receipt
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
