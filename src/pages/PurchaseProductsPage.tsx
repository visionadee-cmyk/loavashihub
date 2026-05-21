import { useEffect, useMemo, useState } from 'react';
import { Plus, DollarSign, CheckCircle2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { demoPurchases } from '../data/demo';
import { useInventory } from '../context/InventoryContext';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument } from '../lib/firestore';
import type { PurchaseOrder } from '../types';

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
  const [orders, setOrders] = useState<PurchaseOrder[]>(demoPurchases);
  const [form, setForm] = useState<Partial<PurchaseOrder>>(defaultPurchase);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      return;
    }

    loadCollection<PurchaseOrder>('purchaseOrders', [])
      .then((items) => {
        if (items.length) {
          setOrders(items);
        }
      })
      .catch((error) => {
        console.error('Failed to load purchase orders from Firestore:', error);
      });
  }, []);

  const totalSpend = useMemo(
    () => orders.reduce((sum, order) => sum + order.totalCost, 0),
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
    const payload: PurchaseOrder = {
      id: `purchase-${Date.now()}`,
      productName: form.productName?.trim() || 'New product',
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
              <h3 className="text-xl font-semibold text-white">Purchase order entry</h3>
              <p className="text-sm text-slate-400">Create new purchase orders for consumables and supplies.</p>
            </div>
            <button
              onClick={saveOrder}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> Add purchase
            </button>
          </div>

          <div className="grid gap-4">
            <label className="block text-sm text-slate-300">
              Product name
              <input
                value={form.productName}
                onChange={(event) => setForm((current) => ({ ...current, productName: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                placeholder="Coffee beans"
              />
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
                Unit cost
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
                      <p className="text-lg font-semibold text-white"><DollarSign className="mr-1 inline h-4 w-4" />{order.totalCost}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    {order.status !== 'Received' ? (
                      <button
                        type="button"
                        onClick={() => updateStatus(order.id, 'Received')}
                        className="rounded-3xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        Mark received
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Spend total</h3>
                <p className="text-sm text-slate-400">Real-time purchase cost total.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-3xl bg-slate-800 px-4 py-3 text-sm text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {orders.filter((order) => order.status === 'Received').length} received
              </div>
            </div>
            <p className="mt-4 text-3xl font-semibold text-white"><DollarSign className="mr-2 inline h-5 w-5" />{totalSpend}</p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
