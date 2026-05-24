import { useEffect, useState, useMemo } from 'react';
import { Save, Search as SearchIcon } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useInventory } from '../context/InventoryContext';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument } from '../lib/firestore';
import type { InventoryAdjustment, InventoryItem } from '../types';

interface ProductDisplay extends InventoryItem {
  source: 'inventory' | 'purchase';
}

export default function InventoryUpdatePage() {
  const { inventory, updateInventoryItem } = useInventory();
  const [allProducts, setAllProducts] = useState<ProductDisplay[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, number>>(new Map());
  const [selectedReason, setSelectedReason] = useState<'daily-count' | 'month-end' | 'physical-count' | 'damaged' | 'other'>('daily-count');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'inventory' | 'purchase'>('all');

  // Filter products based on search term and source
  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSource = filterSource === 'all' || product.source === filterSource;
      return matchesSearch && matchesSource;
    });
  }, [allProducts, searchTerm, filterSource]);

  // Get top 10 purchases
  const top10Purchases = useMemo(() => {
    const purchaseMap = new Map<string, number>();
    allProducts.forEach((product) => {
      if (product.source === 'purchase') {
        const current = purchaseMap.get(product.name) || 0;
        purchaseMap.set(product.name, current + product.quantity);
      }
    });
    return Array.from(purchaseMap.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [allProducts]);

  // Get top 10 inventory items
  const top10Inventory = useMemo(() => {
    return inventory
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [inventory]);

  useEffect(() => {
    if (!hasFirebaseConfig) return;

    const loadData = async () => {
      try {
        // Load adjustments
        const loaded = await loadCollection<InventoryAdjustment>('inventoryAdjustments', []);
        setAdjustments(loaded);

        // Load products from inventory
        const inventoryProducts = inventory.map((item) => ({
          ...item,
          source: 'inventory' as const,
        }));

        // Load products from directPurchases
        const purchases = await loadCollection<any>('directPurchases', []);
        const purchaseProducts = purchases.flatMap((purchase) =>
          purchase.items.map((item: any) => ({
            id: `purchase-${purchase.id}-${item.id}`,
            name: item.productName,
            quantity: item.quantity,
            unit: item.unit || 'units',
            source: 'purchase' as const,
          }))
        );

        // Combine and display all products
        setAllProducts([...inventoryProducts, ...purchaseProducts]);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    loadData();
  }, [inventory]);

  const updateQuantity = (inventoryId: string, newQuantity: number) => {
    setPendingUpdates((current) => {
      const map = new Map(current);
      if (newQuantity < 0) {
        map.delete(inventoryId);
      } else {
        map.set(inventoryId, newQuantity);
      }
      return map;
    });
  };

  const saveAdjustments = async () => {
    if (pendingUpdates.size === 0) return;

    const now = new Date().toISOString().slice(0, 10);

    for (const [inventoryId, newQuantity] of pendingUpdates) {
      const item = inventory.find((i) => i.id === inventoryId);
      if (!item) continue;

      const adjustment: InventoryAdjustment = {
        id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        inventoryId,
        productName: item.name,
        previousQuantity: item.quantity,
        adjustedQuantity: newQuantity - item.quantity,
        newQuantity,
        reason: selectedReason,
        date: now,
        notes,
      };

      const updatedItem: InventoryItem = {
        ...item,
        quantity: newQuantity,
      };

      setAdjustments((current) => [adjustment, ...current]);

      if (hasFirebaseConfig) {
        try {
          await saveDocument('inventoryAdjustments', adjustment.id, adjustment);
          await saveDocument('inventory', item.id, updatedItem);
          updateInventoryItem(updatedItem);
        } catch (error) {
          console.error('Failed to save adjustment:', error);
        }
      } else {
        updateInventoryItem(updatedItem);
      }
    }

    setPendingUpdates(new Map());
    setNotes('');
  };

  return (
    <AppShell title="Inventory Update">
      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-900">Update Inventory</h3>
            <p className="text-sm text-slate-600">Track daily, month-end, and physical count adjustments.</p>
          </div>

          <div className="grid gap-4 mb-6">
            <label className="block text-sm text-slate-600">
              Reason for adjustment
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value as typeof selectedReason)}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
              >
                <option value="daily-count">Daily Count</option>
                <option value="month-end">Month End</option>
                <option value="physical-count">Physical Count</option>
                <option value="damaged">Damaged</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="block text-sm text-slate-600">
              Notes (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this adjustment..."
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none min-h-24"
              />
            </label>
          </div>

          <div className="grid gap-3 mb-6">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm text-slate-600 mb-2">
                  Search Products
                  <div className="relative mt-2">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by product name..."
                      className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 pl-10 text-slate-900 outline-none"
                    />
                  </div>
                </label>
              </div>
              <label className="block text-sm text-slate-600">
                Filter
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
                  className="mt-2 rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                >
                  <option value="all">All</option>
                  <option value="inventory">Inventory</option>
                  <option value="purchase">Purchase</option>
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto mb-6">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((item) => {
                const currentUpdate = pendingUpdates.get(item.id);
                const displayQty = currentUpdate !== undefined ? currentUpdate : item.quantity;
                const hasChange = currentUpdate !== undefined;

                return (
                  <div
                    key={item.id}
                    className={`rounded-3xl border p-4 ${
                      hasChange
                        ? 'border-amber-600 bg-amber-50'
                        : 'border-slate-200 bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            item.source === 'inventory'
                              ? 'bg-blue-600/20 text-blue-300'
                              : 'bg-purple-600/20 text-purple-300'
                          }`}>
                            {item.source === 'inventory' ? 'Inventory' : 'Purchase'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">Current: {item.quantity} {item.unit}</p>
                      </div>
                      {item.source === 'inventory' && (
                        <input
                          type="number"
                          min={0}
                          value={displayQty}
                          onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                          className="w-20 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-right text-slate-900 font-semibold outline-none"
                          placeholder="New qty"
                        />
                      )}
                    </div>
                    {hasChange && (
                      <p className="text-xs text-amber-300">
                        Change: {currentUpdate! - item.quantity > 0 ? '+' : ''}{currentUpdate! - item.quantity} {item.unit}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-100 p-4 text-center text-slate-500">
                No products found matching your search.
              </div>
            )}
          </div>

          <button
            onClick={saveAdjustments}
            disabled={pendingUpdates.size === 0}
            className="w-full rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" /> Save All Adjustments ({pendingUpdates.size})
          </button>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <h3 className="text-xl font-semibold text-slate-900 mb-4">Recent Adjustments</h3>
          <div className="space-y-3 max-h-screen overflow-y-auto">
            {adjustments.map((adj) => (
              <div key={adj.id} className="rounded-3xl border border-slate-200 bg-slate-100 p-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                      <p className="font-semibold text-slate-900 text-sm">{adj.productName}</p>
                    <p className="text-xs text-slate-400">{adj.date}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    adj.adjustedQuantity > 0
                      ? 'bg-emerald-600/20 text-emerald-300'
                      : 'bg-red-600/20 text-red-300'
                  }`}>
                    {adj.adjustedQuantity > 0 ? '+' : ''}{adj.adjustedQuantity}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-1">
                  {adj.previousQuantity} → {adj.newQuantity} ({adj.reason.replace('-', ' ')})
                </p>
                {adj.notes && <p className="text-xs text-slate-500 italic">{adj.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 mt-6 xl:grid-cols-2">
        {/* Top 10 Purchases Section */}
        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">📊 Top 10 Purchases</h3>
            <p className="text-xs text-slate-600">Most purchased products by quantity</p>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {top10Purchases.length > 0 ? (
              top10Purchases.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                      {index + 1}
                    </span>
                    <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">{item.quantity}</span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-center text-slate-500 text-sm">
                No purchase data available
              </div>
            )}
          </div>
        </section>

        {/* Top 10 Inventory Items Section */}
        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">📦 Top 10 Inventory</h3>
            <p className="text-xs text-slate-600">Items with highest stock levels</p>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {top10Inventory.length > 0 ? (
              top10Inventory.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.unit}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">{item.quantity}</span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-center text-slate-500 text-sm">
                No inventory data available
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
