import { useEffect, useMemo, useState } from 'react';
import { Pen, Trash2, Check, Search, X, Star } from 'lucide-react';
import AppShell from '../components/AppShell';
import { formatMVR } from '../lib/mvr';
import { hasFirebaseConfig } from '../lib/firebase';
import { deleteDocument, loadCollection, saveDocument } from '../lib/firestore';
import { uploadImageToCloudinary, isCloudinaryEnabled } from '../lib/cloudinary';import { generateMenuItemId } from '../lib/ids';import type { MenuItem } from '../types';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const CATEGORY_OPTIONS = ['Coffee', 'Tea', 'Burger', 'Pizza', 'Dessert', 'Juice', 'Others'] as const;

const initialForm: Partial<MenuItem> = {
  name: '',
  nameBn: '',
  category: 'Coffee',
  price: 0,
  costPrice: 0,
  description: '',
  image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=80',
  isSignature: false,
};

export default function MenuManagement() {
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [addForm, setAddForm] = useState<Partial<MenuItem>>(initialForm);
  const [editForm, setEditForm] = useState<Partial<MenuItem>>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const firebaseMissing = !hasFirebaseConfig;

  const [categories, setCategories] = useState<string[]>(Array.from(CATEGORY_OPTIONS));
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    // attempt to load saved categories from Firestore collection 'categories'
    if (!hasFirebaseConfig) return;
    loadCollection<{ id: string; title: string }>('categories', [])
      .then((items) => {
        if (items && items.length) setCategories(items.map((c) => c.title));
      })
      .catch(() => undefined);
  }, []);

  const addCategory = async () => {
    const title = newCategory.trim();
    if (!title) return;
    const id = `category-${Date.now()}`;
    setCategories((c) => [...c, title]);
    setNewCategory('');
    if (hasFirebaseConfig) {
      try {
        await saveDocument('categories', id, { id, title });
      } catch (error) {
        console.error('Failed to save category:', error);
      }
    }
  };

  const categoryOptions = useMemo(() => {
    if (categories.length) return categories;
    if (products.length) return Array.from(new Set(products.map((item) => item.category)));
    return Array.from(CATEGORY_OPTIONS);
  }, [categories, products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase())
        || product.description.toLowerCase().includes(searchQuery.toLowerCase())
        || product.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'All' || product.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, filterCategory]);

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

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<Partial<MenuItem>>>,
  ) => {
    if (!isCloudinaryEnabled) {
      setUploadError('Cloudinary upload preset is not configured. Set VITE_CLOUDINARY_UPLOAD_PRESET in your .env or Vercel environment variables.');
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadError(null);

    try {
      const imageUrl = await uploadImageToCloudinary(file);
      setter((current) => ({ ...current, image: imageUrl }));
    } catch (error) {
      setUploadError((error as Error).message);
    }
  };

  const handleAdd = async () => {
    // require Bangla name for bilingual support
    if (!addForm.nameBn || !addForm.nameBn.trim()) {
      setSaveError('Bangla name is required. Please provide the item name in Bangla.');
      return;
    }
    setSaveError(null);
    const id = generateMenuItemId();
    const payload: MenuItem = {
      id,
      menuItemId: id,
      name: addForm.name?.trim() || 'New item',
      nameBn: addForm.nameBn?.trim() || '',
      category: addForm.category || 'Others',
      price: Number(addForm.price) || 0,
      costPrice: Number(addForm.costPrice) || 0,
      description: addForm.description || 'Fresh product.',
      image: addForm.image ?? initialForm.image ?? '',
      isSignature: Boolean(addForm.isSignature),
    };

    setProducts((current) => [payload, ...current]);

    if (hasFirebaseConfig) {
      try {
        await saveDocument('menuItems', payload.id, payload);
      } catch (error) {
        console.error('Failed to save menu item to Firestore:', error);
        setSaveError('Failed to save menu item to Firestore. Check deployment logs.');
      }
    } else {
      setSaveError('Firebase is not configured for this deployment. Menu items will not persist to Firestore.');
    }

    setAddForm(initialForm);
    setSaveError(null);
  };

  const handleEditSave = async () => {
    if (!editingId) {
      return;
    }

    // require Bangla name for bilingual support
    if (!editForm.nameBn || !editForm.nameBn.trim()) {
      setSaveError('Bangla name is required. Please provide the item name in Bangla.');
      return;
    }
    setSaveError(null);

    const payload: MenuItem = {
      id: editingId,
      menuItemId: editForm.menuItemId || editingId,
      name: editForm.name?.trim() || 'Updated item',
      nameBn: editForm.nameBn?.trim() || '',
      category: editForm.category || 'Others',
      price: Number(editForm.price) || 0,
      costPrice: Number(editForm.costPrice) || 0,
      description: editForm.description || 'Fresh product.',
      image: editForm.image ?? initialForm.image ?? '',
      isSignature: Boolean(editForm.isSignature),
    };

    setProducts((current) => current.map((item) => (item.id === editingId ? payload : item)));
    setEditingId(null);
    setIsEditModalOpen(false);

    if (hasFirebaseConfig) {
      try {
        await saveDocument('menuItems', payload.id, payload);
      } catch (error) {
        console.error('Failed to save menu item to Firestore:', error);
        setSaveError('Failed to save menu item to Firestore. Check deployment logs.');
      }
    } else {
      setSaveError('Firebase is not configured for this deployment. Menu items will not persist to Firestore.');
    }

    setEditForm(initialForm);
  };

  const startEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setEditForm(item);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditingId(null);
    setEditForm(initialForm);
    setIsEditModalOpen(false);
    setSaveError(null);
    setUploadError(null);
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

  const exportMenuItems = () => {
    const items = filteredProducts.map((p) => ({
      ID: p.id,
      MenuItemID: p.menuItemId ?? p.id,
      Name: p.name,
      NameBn: p.nameBn,
      Category: p.category,
      Price: p.price ?? 0,
      CostPrice: p.costPrice ?? 0,
      Description: p.description ?? '',
      IsSignature: p.isSignature ? 'Yes' : 'No',
      Image: p.image ?? '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(items);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MenuItems');
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    saveAs(blob, 'menu-items.xlsx');
  };

  return (
    <AppShell title="Menu items management">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_0.95fr]">
        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <div className="mb-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Add or edit menu items</h3>
                <p className="text-sm text-slate-600">Configure categories, prices in MVR and item descriptions.</p>
              </div>
              <button
                onClick={handleAdd}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Add item
              </button>
            </div>
            {firebaseMissing ? (
              <div className="rounded-3xl border border-amber-400 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Firestore is not configured in this deployment. Menu item changes will not sync to POS or persist across reloads unless Firebase is configured.
              </div>
            ) : null}
            {saveError ? (
              <div className="rounded-3xl border border-rose-500 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {saveError}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4">
            <label className="block text-sm text-slate-600">
              Item name (English)
              <input
                value={addForm.name}
                onChange={(event) => setAddForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                placeholder="Espresso, Burger, Juice"
              />
            </label>

            <label className="block text-sm text-slate-600">
              Item name (Bangla)
              <input
                value={addForm.nameBn}
                onChange={(event) => setAddForm((current) => ({ ...current, nameBn: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                placeholder="বাংলা নাম"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm text-slate-600">
                Category
                <select
                  value={addForm.category}
                  onChange={(event) => setAddForm((current) => ({ ...current, category: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <div className="space-y-2">
                <label className="block text-xs text-slate-500">Add new category</label>
                <div className="flex gap-2">
                  <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Signature" className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-2 text-slate-900 outline-none" />
                  <button type="button" onClick={addCategory} className="rounded-3xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white">Add</button>
                </div>
              </div>
              <label className="block text-sm text-slate-600">
                <span className="flex items-center justify-between">Signature dish <small className="text-xs text-slate-400">(highlight on POS & reports)</small></span>
                <div className="mt-2 inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(addForm.isSignature)}
                    onChange={(e) => setAddForm((current) => ({ ...current, isSignature: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <Star className="h-4 w-4 text-amber-400" />
                </div>
              </label>
              <label className="block text-sm text-slate-600">
                Cost price (MVR)
                <input
                  type="number"
                  value={addForm.costPrice}
                  onChange={(event) => setAddForm((current) => ({ ...current, costPrice: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                  placeholder="0"
                />
              </label>
              <label className="block text-sm text-slate-600">
                Selling price (MVR)
                <input
                  type="number"
                  value={addForm.price}
                  onChange={(event) => setAddForm((current) => ({ ...current, price: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                  placeholder="25"
                />
              </label>
            </div>
            <label className="block text-sm text-slate-600">
              Description
              <textarea
                value={addForm.description}
                onChange={(event) => setAddForm((current) => ({ ...current, description: event.target.value }))}
                className="mt-2 h-28 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                placeholder="A delicious new menu item"
              />
            </label>
            <label className="block text-sm text-slate-600">
              Image URL
              <input
                value={addForm.image}
                onChange={(event) => setAddForm((current) => ({ ...current, image: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                placeholder="https://..."
              />
            </label>
            <label className="block text-sm text-slate-600">
              Upload image
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => handleImageUpload(event, setAddForm)}
                disabled={!isCloudinaryEnabled}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            {uploadError ? <p className="text-sm text-rose-400">Upload error: {uploadError}</p> : null}
            {isCloudinaryEnabled ? (
              <p className="text-sm text-slate-500">Images upload directly to Cloudinary using the configured unsigned preset.</p>
            ) : (
              <p className="text-sm text-amber-400">Cloudinary upload preset is not configured. Set <code>VITE_CLOUDINARY_UPLOAD_PRESET</code> in your local .env or in Vercel environment variables.</p>
            )}
            {addForm.image ? (
              <div className="mt-4 max-w-md overflow-hidden rounded-3xl border border-slate-300 bg-slate-100">
                <img src={addForm.image} alt="Preview" className="h-48 w-full object-cover" />
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
            <div className="mb-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Menu items</h3>
                  <p className="text-sm text-slate-600">Manage all products and update menu item details, images, and pricing.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{filteredProducts.length} of {products.length}</span>
                  <button type="button" onClick={exportMenuItems} className="inline-flex items-center gap-2 rounded-3xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Export Excel
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, category, or description..."
                    className="w-full rounded-3xl border border-slate-300 bg-slate-100 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-violet-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-500 sm:min-w-[180px]"
                >
                  <option value="All">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                <div key={product.id} className="rounded-3xl border border-slate-200 bg-slate-100 p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-3xl bg-slate-800">
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{product.name}</p>
                          {product.nameBn ? <p className="text-sm text-slate-600">{product.nameBn}</p> : null}
                          <p className="text-sm text-slate-600">{product.category}</p>
                          <p className="text-sm text-slate-600">ID: {product.menuItemId ?? product.id}</p>
                          <p className="text-sm text-slate-600">Cost: {formatMVR(product.costPrice ?? 0)}</p>
                        </div>
                        <span className="text-sm font-semibold text-violet-300">{formatMVR(product.price)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{product.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(product)}
                      className="inline-flex items-center gap-2 rounded-3xl border border-slate-300 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
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
              ))
              ) : (
                <div className="rounded-3xl border border-slate-300 bg-slate-100/50 p-8 text-center">
                  <p className="text-slate-400">No menu items found. Try adjusting your search or filters.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {isEditModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 pt-8 sm:items-center">
          <div className="w-full max-w-3xl max-h-[calc(100vh-5rem)] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/40">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Edit menu item</h3>
                <p className="text-sm text-slate-600">Update the item details and save to close the popup.</p>
              </div>
              <button type="button" onClick={closeEditModal} className="rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4">
              <label className="block text-sm text-slate-600">
                Item name
                <input
                  value={editForm.name}
                  onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-900 outline-none"
                  placeholder="Espresso, Burger, Juice"
                />
              </label>
              <label className="block text-sm text-slate-600">
                Item name (Bangla)
                <input
                  value={editForm.nameBn}
                  onChange={(event) => setEditForm((current) => ({ ...current, nameBn: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-900 outline-none"
                  placeholder="বাংলা নাম"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm text-slate-600">
                  Category
                  <select
                    value={editForm.category}
                    onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-900 outline-none"
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-slate-600">
                  <span className="flex items-center justify-between">Signature dish <small className="text-xs text-slate-400">(highlight on POS & reports)</small></span>
                  <div className="mt-2 inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.isSignature)}
                      onChange={(e) => setEditForm((current) => ({ ...current, isSignature: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <Star className="h-4 w-4 text-amber-400" />
                  </div>
                </label>
                <label className="block text-sm text-slate-600">
                  Cost price (MVR)
                  <input
                    type="number"
                    value={editForm.costPrice}
                    onChange={(event) => setEditForm((current) => ({ ...current, costPrice: Number(event.target.value) }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-900 outline-none"
                    placeholder="0"
                  />
                </label>
                <label className="block text-sm text-slate-600">
                  Selling price (MVR)
                  <input
                    type="number"
                    value={editForm.price}
                    onChange={(event) => setEditForm((current) => ({ ...current, price: Number(event.target.value) }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-900 outline-none"
                    placeholder="25"
                  />
                </label>
              </div>
              <label className="block text-sm text-slate-600">
                Description
                <textarea
                  value={editForm.description}
                  onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                  className="mt-2 h-28 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-900 outline-none"
                  placeholder="A delicious new menu item"
                />
              </label>
              <label className="block text-sm text-slate-600">
                Image URL
                <input
                  value={editForm.image}
                  onChange={(event) => setEditForm((current) => ({ ...current, image: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-900 outline-none"
                  placeholder="https://..."
                />
              </label>
              <label className="block text-sm text-slate-600">
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => handleImageUpload(event, setEditForm)}
                  disabled={!isCloudinaryEnabled}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              {uploadError ? <p className="text-sm text-rose-400">Upload error: {uploadError}</p> : null}
              {editForm.image ? (
                <div className="mt-4 max-w-md overflow-hidden rounded-3xl border border-slate-300 bg-slate-100">
                  <img src={editForm.image} alt="Preview" className="h-48 w-full object-cover" />
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEditModal}
                className="inline-flex items-center justify-center rounded-3xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                className="inline-flex items-center justify-center rounded-3xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
