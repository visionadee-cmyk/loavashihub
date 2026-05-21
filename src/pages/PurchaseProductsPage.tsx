import { useEffect, useMemo, useState } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useInventory } from '../context/InventoryContext';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { PurchaseOrder, RFQItem } from '../types';

const defaultPurchase: Partial<PurchaseOrder> = {
  productName: '',
  vendor: '',
  quantity: 1,
  unit: 'pcs',
  unitCost: 0,
  status: 'Ordered',
  date: new Date().toISOString().slice(0, 10),
};

export default function PurchaseProductsPage() {
  const { inventory, addInventoryItem, updateInventoryItem } = useInventory();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Array<{ id?: string; name: string; costPrice?: number; source?: string }>>([]);
  const [form, setForm] = useState<Partial<PurchaseOrder>>(defaultPurchase);
  const [rfqItems, setRfqItems] = useState<RFQItem[]>([]);
  const [rfqForm, setRfqForm] = useState<Partial<RFQItem>>({ productName: '', quantity: 1, unit: 'pcs' });

  const addRfqItem = () => {
    const productName = rfqForm.productName?.trim();
    if (!productName || !rfqForm.quantity || rfqForm.quantity <= 0) return;

    const newItem: RFQItem = {
      id: `rfq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productName,
      quantity: rfqForm.quantity,
      unit: rfqForm.unit || 'pcs',
      vendor: rfqForm.vendor?.trim() || '',
      unitCost: rfqForm.unitCost ?? 0,
    };

    setRfqItems((current) => [newItem, ...current]);
    setRfqForm({ productName: '', quantity: 1, unit: 'pcs' });
  };

  const updateRfqItem = (id: string, field: keyof RFQItem, value: string | number) => {
    setRfqItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const removeRfqItem = (id: string) => {
    setRfqItems((current) => current.filter((item) => item.id !== id));
  };

  const canGeneratePurchaseOrders = rfqItems.length > 0 && rfqItems.every(
    (item) => item.vendor?.trim().length && item.unitCost !== undefined && item.unitCost >= 0,
  );

  const generatePurchaseOrdersFromRFQ = async () => {
    if (!canGeneratePurchaseOrders) return;

    const newOrders: PurchaseOrder[] = rfqItems.map((item) => ({
      id: `purchase-${Date.now()}-${item.id}`,
      menuItemId: products.find((product) => product.name === item.productName)?.id,
      productName: item.productName,
      vendor: item.vendor?.trim() || 'Unknown vendor',
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost ?? 0,
      totalCost: item.quantity * (item.unitCost ?? 0),
      status: 'Ordered',
      date: new Date().toISOString().slice(0, 10),
    }));

    setOrders((current) => [...newOrders, ...current]);
    setRfqItems([]);
    setRfqForm({ productName: '', quantity: 1, unit: 'pcs' });

    if (hasFirebaseConfig) {
      await Promise.all(newOrders.map(async (order) => {
        try {
          await saveDocument('purchaseOrders', order.id, order);
        } catch (error) {
          console.error('Failed to save generated purchase order:', error);
        }
      }));
    }
  };

  useEffect(() => {
    if (!hasFirebaseConfig) {
      return;
    }

    loadCollection<PurchaseOrder>('purchaseOrders', [])
      .then((loadedOrders) => {
        if (loadedOrders.length) {
          setOrders(loadedOrders);
        }
      })
      .catch((error) => {
        console.error('Failed to load purchase orders from Firestore:', error);
      });
  }, []);

  useEffect(() => {
    if (!inventory || !inventory.length) return;

    const invOptions = inventory.map((item) => ({
      id: item.id,
      name: item.name,
      costPrice: 0,
      source: 'inventory',
    }));

    setProducts(invOptions);
    setForm((current) => ({
      ...current,
      productName: current.productName || invOptions[0].name,
    }));
  }, [inventory]);

  const totalSpend = useMemo(
    () => orders.reduce((sum, order) => sum + order.totalCost, 0),
    [orders],
  );

  const receivedOrders = useMemo(
    () => orders.filter((order) => order.status === 'Received').length,
    [orders],
  );

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status !== 'Received').length,
    [orders],
  );

  const restockOrder = (order: PurchaseOrder) => {
    const existingItem = inventory.find(
      (item) => item.name.toLowerCase() === order.productName.toLowerCase(),
    );

    if (existingItem) {
      updateInventoryItem({
        ...existingItem,
        quantity: existingItem.quantity + order.quantity,
      });
      return;
    }

    addInventoryItem({
      id: `stock-${Date.now()}`,
      name: order.productName,
      quantity: order.quantity,
      unit: order.unit,
      lowStock: 5,
    });
  };

  const updateStatus = async (id: string, status: PurchaseOrder['status']) => {
    const updatedOrders = orders.map((order) => {
      if (order.id !== id) return order;
      if (order.status !== 'Received' && status === 'Received') {
        restockOrder({ ...order, status });
      }
      return { ...order, status };
    });

    setOrders(updatedOrders);

    if (hasFirebaseConfig) {
      const updatedOrder = updatedOrders.find((order) => order.id === id);
      if (updatedOrder) {
        try {
          await saveDocument('purchaseOrders', id, updatedOrder);
        } catch (error) {
          console.error('Failed to update purchase order in Firestore:', error);
        }
      }
    }
  };

  const saveOrder = async () => {
    const selectedProduct = products.find((product) => product.name === form.productName) ?? products[0];
    const payload: PurchaseOrder = {
      id: `purchase-${Date.now()}`,
      menuItemId: selectedProduct?.id,
      productName: selectedProduct?.name ?? (form.productName?.trim() || 'New item'),
      vendor: form.vendor?.trim() || 'Unknown vendor',
      quantity: form.quantity ?? 1,
      unit: form.unit || 'pcs',
      unitCost: form.unitCost ?? 0,
      totalCost: (form.quantity ?? 1) * (form.unitCost ?? 0),
      status: form.status || 'Ordered',
      date: form.date || new Date().toISOString().slice(0, 10),
    };

    setOrders((current) => [payload, ...current]);
    setForm(defaultPurchase);

    if (hasFirebaseConfig) {
      try {
        await saveDocument('purchaseOrders', payload.id, payload);
      } catch (error) {
        console.error('Failed to save purchase order to Firestore:', error);
      }
    }
  };

  return (
    <AppShell title="Purchase products">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">RFQ item list</h3>
              <p className="text-sm text-slate-400">Build a request-for-quotation list first, then assign shop prices and generate purchase orders.</p>
            </div>
            <button
              type="button"
              onClick={addRfqItem}
              disabled={!products.length || !rfqForm.productName?.trim()}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add RFQ item
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm text-slate-300">
              Product name
              <input
                list="purchase-product-list"
                value={rfqForm.productName}
                onChange={(event) => setRfqForm((current) => ({
                  ...current,
                  productName: event.target.value,
                }))}
                placeholder="Start typing to search products"
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              />
              <datalist id="purchase-product-list">
                {products.map((product) => (
                  <option key={`${product.source ?? 'p'}-${product.id ?? product.name}`} value={product.name} />
                ))}
              </datalist>
            </label>
            <label className="block text-sm text-slate-300">
              Quantity
              <input
                type="number"
                min={1}
                value={rfqForm.quantity}
                onChange={(event) => setRfqForm((current) => ({
                  ...current,
                  quantity: Number(event.target.value),
                }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Unit
              <input
                value={rfqForm.unit}
                onChange={(event) => setRfqForm((current) => ({
                  ...current,
                  unit: event.target.value,
                }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              />
            </label>
          </div>

          {rfqItems.length > 0 && (
            <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-white">RFQ items</h4>
                  <p className="text-sm text-slate-400">Assign vendor and unit cost before making purchase orders.</p>
                </div>
                <button
                  type="button"
                  onClick={generatePurchaseOrdersFromRFQ}
                  disabled={!canGeneratePurchaseOrders}
                  className="inline-flex items-center gap-2 rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create purchase orders
                </button>
              </div>

              <div className="space-y-4">
                {rfqItems.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{item.productName}</p>
                        <p className="text-sm text-slate-400">{item.quantity} {item.unit}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRfqItem(item.id)}
                        className="rounded-3xl bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <label className="block text-sm text-slate-300">
                        Shop name
                        <input
                          value={item.vendor ?? ''}
                          onChange={(event) => updateRfqItem(item.id, 'vendor', event.target.value)}
                          placeholder="Vendor or supplier"
                          className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                        />
                      </label>
                      <label className="block text-sm text-slate-300">
                        Unit cost (MVR)
                        <input
                          type="number"
                          min={0}
                          value={item.unitCost ?? 0}
                          onChange={(event) => updateRfqItem(item.id, 'unitCost', Number(event.target.value))}
                          className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                        />
                      </label>
                      <div className="block text-sm text-slate-300">
                        <span className="block mb-2">Total</span>
                        <span className="inline-flex items-center rounded-3xl bg-slate-800 px-4 py-3 text-slate-100">
                          {formatMVR((item.unitCost ?? 0) * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!canGeneratePurchaseOrders && (
                <p className="mt-4 text-sm text-amber-300">Fill shop name and unit cost for every RFQ item before creating purchase orders.</p>
              )}
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Purchase order entry</h3>
                <p className="text-sm text-slate-400">Create new purchase orders for consumables and supplies.</p>
              </div>
              <button
                onClick={saveOrder}
                disabled={!products.length}
                className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add purchase
              </button>
            </div>

            <div className="grid gap-4">
            <label className="block text-sm text-slate-300">
              Product name
              <input
                list="purchase-product-list"
                value={form.productName}
                onChange={(event) => {
                  const selectedProduct = products.find((product) => product.name === event.target.value);
                  setForm((current) => ({
                    ...current,
                    productName: event.target.value,
                    unitCost: selectedProduct?.costPrice ?? current.unitCost ?? 0,
                  }));
                }}
                placeholder="Start typing to search products"
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              />
              <datalist id="purchase-product-list">
                {products.map((product) => (
                  <option key={`${product.source ?? 'p'}-${product.id ?? product.name}`} value={product.name} />
                ))}
              </datalist>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Vendor
                <input
                  value={form.vendor}
                  onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  placeholder="Island Suppliers"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Order date
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm text-slate-300">
                Quantity
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Unit
                <input
                  value={form.unit}
                  onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Unit cost (MVR)
                <input
                  type="number"
                  min={0}
                  value={form.unitCost}
                  onChange={(event) => setForm((current) => ({ ...current, unitCost: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
            </div>

            <label className="block text-sm text-slate-300">
              Status
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PurchaseOrder['status'] }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              >
                <option value="Ordered">Ordered</option>
                <option value="Received">Received</option>
                <option value="Pending">Pending</option>
              </select>
            </label>
          </div>
        </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Purchase summary</h3>
                <p className="text-sm text-slate-400">Review ordered products and total spend.</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{orders.length} orders</span>
            </div>
            <div className="grid gap-3">
              {orders.map((order) => (
                <div key={order.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{order.productName}</p>
                      <p className="text-sm text-slate-400">{order.vendor} • {order.quantity} {order.unit}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">{order.status}</p>
                      <p className="text-lg font-semibold text-white">{formatMVR(order.totalCost)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {order.status !== 'Received' ? (
                      <button
                        type="button"
                        onClick={() => updateStatus(order.id, 'Received')}
                        className="rounded-3xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        Mark received
                      </button>
                    ) : (
                      <span className="rounded-full bg-emerald-600/10 px-3 py-2 text-sm text-emerald-300">Inventory restocked</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-white">Spend total</h3>
                  <p className="text-sm text-slate-400">Real-time purchase cost total.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-3xl bg-slate-800 px-4 py-3 text-sm text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {receivedOrders} received
                </div>
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">{formatMVR(totalSpend)}</p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-white">Restock status</h3>
                  <p className="text-sm text-slate-400">Orders that are pending inventory receipt.</p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{pendingOrders} pending</span>
              </div>
              <div className="mt-4 space-y-3 text-slate-300">
                <p>{receivedOrders} order{receivedOrders === 1 ? '' : 's'} have been restocked.</p>
                <p>{pendingOrders} order{pendingOrders === 1 ? '' : 's'} still need receipt confirmation.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
