import { useEffect, useMemo, useState } from 'react';
import { Pen, Trash2, Check } from 'lucide-react';
import AppShell from '../components/AppShell';
import { formatMVR } from '../lib/mvr';
import { hasFirebaseConfig } from '../lib/firebase';
import { deleteDocument, loadCollection, saveDocument } from '../lib/firestore';
import { uploadImageToCloudinary, isCloudinaryEnabled } from '../lib/cloudinary';
import type { MenuItem } from '../types';

const CATEGORY_OPTIONS = ['Coffee', 'Tea', 'Burger', 'Pizza', 'Dessert', 'Juice', 'Others'] as const;

const initialForm: Partial<MenuItem> = {
  name: '',
  category: 'Coffee',
  price: 0,
  description: '',
  image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=80',
};

export default function MenuManagement() {
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [form, setForm] = useState<Partial<MenuItem>>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const recentItems = useMemo(() => products.slice(0, 6), [products]);
  const categoryOptions = useMemo(
    () => (products.length ? Array.from(new Set(products.map((item) => item.category))) : Array.from(CATEGORY_OPTIONS)),
    [products],
  );

  useEffect(() => {
    if (!hasFirebaseConfig) {
      return;
    }

    setLoading(true);
    loadCollection<MenuItem>('menuItems', [])
      .then((items) => {
        if (items.length) {
          setProducts(items);
        }
      })
      .catch((error) => {
        console.error('Failed to load menu items from Firestore:', error);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadError(null);

    try {
      const imageUrl = await uploadImageToCloudinary(file);
      setForm((current) => ({ ...current, image: imageUrl }));
    } catch (error) {
      setUploadError((error as Error).message);
    }
  };

  const handleSave = async () => {
    const payload: MenuItem = {
      id: editingId ?? `product-${Date.now()}`,
      name: form.name?.trim() || 'New item',
      category: form.category || 'Others',
      price: Number(form.price) || 0,
      description: form.description || 'Fresh product.',
      image: form.image ?? initialForm.image ?? '',
    };

    if (editingId) {
      setProducts((current) => current.map((item) => (item.id === editingId ? payload : item)));
      setEditingId(null);
    } else {
      setProducts((current) => [payload, ...current]);
    }

    if (hasFirebaseConfig) {
      try {
        await saveDocument('menuItems', payload.id, payload);
      } catch (error) {
        console.error('Failed to save menu item to Firestore:', error);
      }
    }

    setForm(initialForm);
  };

  const startEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setForm(item);
  };

  const removeItem = async (id: string) => {
    setProducts((current) => current.filter((item) => item.id !== id));
    if (hasFirebaseConfig) {
      try {
        await deleteDocument('menuItems', id);
      } catch (error) {
        console.error('Failed to remove menu item from Firestore:', error);
      }
    }
  };

  return (
    <AppShell title="Menu management">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_0.95fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Add or edit menu items</h3>
              <p className="text-sm text-slate-400">Configure categories, prices in MVR and item descriptions.</p>
            </div>
            <button
              onClick={handleSave}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {editingId ? 'Save item' : 'Add item'}
            </button>
          </div>

          <div className="grid gap-4">
            <label className="block text-sm text-slate-300">
              Item name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                placeholder="Espresso, Burger, Juice"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Category
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Price (MVR)
                <input
                  type="number"
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  placeholder="25"
                />
              </label>
            </div>
            <label className="block text-sm text-slate-300">
              Description
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="mt-2 h-28 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                placeholder="A delicious new menu item"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Image URL
              <input
                value={form.image}
                onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                placeholder="https://..."
              />
            </label>
            <label className="block text-sm text-slate-300">
              Upload image
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
              />
            </label>
            {uploadError ? <p className="text-sm text-rose-400">Upload error: {uploadError}</p> : null}
            {isCloudinaryEnabled ? (
              <p className="text-sm text-slate-500">Images upload directly to Cloudinary using the configured unsigned preset.</p>
            ) : (
              <p className="text-sm text-amber-400">Set `VITE_CLOUDINARY_UPLOAD_PRESET` to enable camera/file upload directly to Cloudinary.</p>
            )}
            {form.image ? (
              <div className="mt-4 max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-slate-900">
                <img src={form.image} alt="Preview" className="h-48 w-full object-cover" />
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Latest menu items</h3>
                <p className="text-sm text-slate-400">Manage item details and pricing at a glance.</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{products.length} items</span>
            </div>

            <div className="grid gap-4">
              {recentItems.map((product) => (
                <div key={product.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-3xl bg-slate-800">
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold text-white">{product.name}</p>
                          <p className="text-sm text-slate-400">{product.category}</p>
                        </div>
                        <span className="text-sm font-semibold text-violet-300">{formatMVR(product.price)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{product.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(product)}
                      className="inline-flex items-center gap-2 rounded-3xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      <Pen className="h-4 w-4" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(product.id)}
                      className="inline-flex items-center gap-2 rounded-3xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
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
