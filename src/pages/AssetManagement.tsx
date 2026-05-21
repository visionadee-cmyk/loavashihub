import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import { demoAssets } from '../data/demo';
import type { Asset } from '../types';

const defaultAsset: Partial<Asset> = {
  name: '',
  category: 'Kitchen',
  value: 0,
  purchaseDate: new Date().toISOString().slice(0, 10),
  location: '',
  status: 'Operational',
};

export default function AssetManagement() {
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => {
    if (!hasFirebaseConfig) {
      setAssets(demoAssets);
      return;
    }

    loadCollection<Asset>('assets', [])
      .then((items) => {
        if (items.length) setAssets(items);
      })
      .catch((error) => console.error('Failed to load assets from Firestore:', error));
  }, []);
  const [form, setForm] = useState<Partial<Asset>>(defaultAsset);
  const [editingId, setEditingId] = useState<string | null>(null);

  const saveAsset = () => {
    const payload: Asset = {
      id: editingId ?? `asset-${Date.now()}`,
      name: form.name?.trim() || 'New asset',
      category: form.category || 'General',
      value: form.value ?? 0,
      purchaseDate: form.purchaseDate || new Date().toISOString().slice(0, 10),
      location: form.location?.trim() || 'Unknown',
      status: form.status || 'Operational',
    };

    if (editingId) {
      setAssets((current) => current.map((asset) => (asset.id === editingId ? payload : asset)));
      setEditingId(null);
    } else {
      setAssets((current) => [payload, ...current]);
    }

    if (hasFirebaseConfig) {
      saveDocument('assets', payload.id, payload).catch((error) => console.error('Failed to save asset:', error));
    }

    setForm(defaultAsset);
  };

  const startEditing = (asset: Asset) => {
    setEditingId(asset.id);
    setForm({ ...asset });
  };

  const deleteAsset = (id: string) => {
    setAssets((current) => current.filter((asset) => asset.id !== id));
    if (hasFirebaseConfig) {
      deleteDocument('assets', id).catch((error) => console.error('Failed to delete asset:', error));
    }
  };

  return (
    <AppShell title="Asset management">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Assets register</h3>
              <p className="text-sm text-slate-400">Track equipment, devices and capital assets.</p>
            </div>
            <button
              onClick={saveAsset}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> Save asset
            </button>
          </div>

          <div className="grid gap-4">
            <label className="block text-sm text-slate-300">
              Asset name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                placeholder="Espresso machine"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Category
                <input
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  placeholder="Kitchen"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Location
                <input
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  placeholder="Main kitchen"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Value
                <input
                  type="number"
                  min={0}
                  value={form.value}
                  onChange={(event) => setForm((current) => ({ ...current, value: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Purchase date
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(event) => setForm((current) => ({ ...current, purchaseDate: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
            </div>

            <label className="block text-sm text-slate-300">
              Status
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Asset['status'] }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              >
                <option value="Operational">Operational</option>
                <option value="Needs repair">Needs repair</option>
                <option value="Disposed">Disposed</option>
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Asset list</h3>
                <p className="text-sm text-slate-400">View fixed assets and track their condition.</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{assets.length} items</span>
            </div>

            <div className="grid gap-4">
              {assets.map((asset) => (
                <div key={asset.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{asset.name}</p>
                      <p className="text-sm text-slate-400">{asset.category} · {asset.location}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditing(asset)}
                        className="rounded-2xl bg-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-700"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteAsset(asset.id)}
                        className="rounded-2xl bg-rose-600 px-3 py-2 text-white hover:bg-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 text-sm text-slate-400">
                    <div className="rounded-3xl bg-slate-950 px-4 py-3">
                      <p className="font-semibold text-slate-200">Value</p>
                      <p className="mt-1">{asset.value} MVR</p>
                    </div>
                    <div className="rounded-3xl bg-slate-950 px-4 py-3">
                      <p className="font-semibold text-slate-200">Purchased</p>
                      <p className="mt-1">{asset.purchaseDate}</p>
                    </div>
                    <div className="rounded-3xl bg-slate-950 px-4 py-3">
                      <p className="font-semibold text-slate-200">Status</p>
                      <p className="mt-1">{asset.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
