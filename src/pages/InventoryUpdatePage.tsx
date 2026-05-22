import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useInventory } from '../context/InventoryContext';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument } from '../lib/firestore';
import type { InventoryAdjustment, InventoryItem } from '../types';

export default function InventoryUpdatePage() {
  const { inventory, updateInventoryItem } = useInventory();
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, number>>(new Map());
  const [selectedReason, setSelectedReason] = useState<'daily-count' | 'month-end' | 'physical-count' | 'damaged' | 'other'>('daily-count');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!hasFirebaseConfig) return;
    loadCollection<InventoryAdjustment>('inventoryAdjustments', [])
      .then((loaded) => setAdjustments(loaded))
      .catch((error) => console.error('Failed to load adjustments:', error));
  }, []);

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
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white">Update Inventory</h3>
            <p className="text-sm text-slate-400">Track daily, month-end, and physical count adjustments.</p>
          </div>

          <div className="grid gap-4 mb-6">
            <label className="block text-sm text-slate-300">
              Reason for adjustment
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value as typeof selectedReason)}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              >
                <option value="daily-count">Daily Count</option>
                <option value="month-end">Month End</option>
                <option value="physical-count">Physical Count</option>
                <option value="damaged">Damaged</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="block text-sm text-slate-300">
              Notes (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this adjustment..."
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none min-h-24"
              />
            </label>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto mb-6">
            {inventory.map((item) => {
              const currentUpdate = pendingUpdates.get(item.id);
              const displayQty = currentUpdate !== undefined ? currentUpdate : item.quantity;
              const hasChange = currentUpdate !== undefined;

              return (
                <div
                  key={item.id}
                  className={`rounded-3xl border p-4 ${
                    hasChange
                      ? 'border-amber-600 bg-amber-950/30'
                      : 'border-slate-800 bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-xs text-slate-400">Current: {item.quantity} {item.unit}</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={displayQty}
                      onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                      className="w-20 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-right text-slate-100 font-semibold outline-none"
                      placeholder="New qty"
                    />
                  </div>
                  {hasChange && (
                    <p className="text-xs text-amber-300">
                      Change: {currentUpdate! - item.quantity > 0 ? '+' : ''}{currentUpdate! - item.quantity} {item.unit}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={saveAdjustments}
            disabled={pendingUpdates.size === 0}
            className="w-full rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" /> Save All Adjustments ({pendingUpdates.size})
          </button>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
          <h3 className="text-xl font-semibold text-white mb-4">Recent Adjustments</h3>
          <div className="space-y-3 max-h-screen overflow-y-auto">
            {adjustments.map((adj) => (
              <div key={adj.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-white text-sm">{adj.productName}</p>
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
    </AppShell>
  );
}
