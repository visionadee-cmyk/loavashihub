import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, Zap } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument } from '../lib/firestore';

import { useInventory } from '../context/InventoryContext';
import type { Recipe, RecipeIngredient } from '../types';

const initialRecipe: Partial<Recipe> = {
  name: '',
  ingredients: [],
  salePrice: 0,
  status: 'Active',
};

export default function RecipeManagement() {
  const { inventory, adjustInventoryByRecipe } = useInventory();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  useEffect(() => {
    if (!hasFirebaseConfig) {
      setRecipes([]);
      return;
    }

    loadCollection<Recipe>('recipes', [])
      .then((items) => { if (items.length) setRecipes(items); })
      .catch((error) => console.error('Failed to load recipes from Firestore:', error));
  }, []);
  const [form, setForm] = useState<Partial<Recipe>>(initialRecipe);
  const [ingredient, setIngredient] = useState<Partial<RecipeIngredient>>({ inventoryId: '', quantity: 1, unit: 'pcs', name: '' });

  const stockWarning = useMemo(
    () => inventory.filter((item) => item.quantity <= item.lowStock).length,
    [inventory],
  );

  const saveRecipe = () => {
    if (!form.name?.trim()) return;
    const payload: Recipe = {
      id: `recipe-${Date.now()}`,
      name: form.name.trim(),
      ingredients: form.ingredients ?? [],
      salePrice: form.salePrice ?? 0,
      status: form.status ?? 'Active',
    };
    setRecipes((current) => [payload, ...current]);
    if (hasFirebaseConfig) {
      saveDocument('recipes', payload.id, payload).catch((error) => console.error('Failed to save recipe:', error));
    }
    setForm(initialRecipe);
    setIngredient({ inventoryId: inventory[0]?.id ?? '', quantity: 1, unit: inventory[0]?.unit ?? 'pcs', name: inventory[0]?.name ?? '' });
  };

  const addIngredient = () => {
    const ingredientQuantity = Number(ingredient.quantity ?? 0);
    if (!ingredient.inventoryId || ingredientQuantity <= 0) return;
    const inventoryItem = inventory.find((item) => item.id === ingredient.inventoryId);
    if (!inventoryItem) return;
    const newIngredient: RecipeIngredient = {
      inventoryId: inventoryItem.id,
      name: inventoryItem.name,
      quantity: ingredientQuantity,
      unit: ingredient.unit || inventoryItem.unit,
    };
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients ? [...current.ingredients, newIngredient] : [newIngredient],
    }));
    setIngredient({ inventoryId: inventory[0]?.id ?? '', quantity: 1, unit: inventory[0]?.unit ?? 'pcs', name: inventory[0]?.name ?? '' });
  };

  const useRecipe = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    const success = adjustInventoryByRecipe(recipe);
    if (!success) {
      window.alert('Not enough inventory to use this recipe. Check consumable stock.');
      return;
    }

    window.alert('Recipe used successfully and inventory updated.');
  };

  const toggleRecipeStatus = (id: string) => {
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === id ? { ...recipe, status: recipe.status === 'Active' ? 'Inactive' : 'Active' } : recipe,
      ),
    );
  };

  return (
    <AppShell title="Recipe management">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Menu recipes</h3>
              <p className="text-sm text-slate-400">Create recipes and simulate inventory deduction in real time.</p>
            </div>
            <button
              onClick={saveRecipe}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> Save recipe
            </button>
          </div>

          <div className="grid gap-4">
            <label className="block text-sm text-slate-300">
              Recipe name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                placeholder="Café Latte"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Sale price
                <input
                  type="number"
                  min={0}
                  value={form.salePrice}
                  onChange={(event) => setForm((current) => ({ ...current, salePrice: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Status
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Recipe['status'] }))}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="block text-sm text-slate-300">
                  Ingredient
                  <select
                    value={ingredient.inventoryId}
                    onChange={(event) => {
                      const id = event.target.value;
                      const item = inventory.find((entry) => entry.id === id);
                      setIngredient((current) => ({
                        ...current,
                        inventoryId: id,
                        name: item?.name ?? current.name ?? '',
                        unit: item?.unit ?? current.unit ?? 'pcs',
                      }));
                    }}
                    className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  >
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-slate-300">
                  Quantity
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={ingredient.quantity}
                    onChange={(event) => setIngredient((current) => ({ ...current, quantity: Number(event.target.value) }))}
                    className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Unit
                  <input
                    value={ingredient.unit}
                    onChange={(event) => setIngredient((current) => ({ ...current, unit: event.target.value }))}
                    className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={addIngredient}
                className="inline-flex items-center gap-2 rounded-3xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" /> Add ingredient
              </button>
            </div>

            {form.ingredients?.length ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                <h4 className="text-sm font-semibold text-white">Recipe ingredients</h4>
                <ul className="mt-3 space-y-2 text-slate-300">
                  {form.ingredients.map((ingredient, index) => (
                    <li key={`${ingredient.inventoryId}-${index}`}>
                      {ingredient.name}: {ingredient.quantity} {ingredient.unit}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Inventory status</h3>
                <p className="text-sm text-slate-400">Watch consumables change when recipes are used.</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{stockWarning} low-stock items</span>
            </div>
            <div className="grid gap-3">
              {inventory.map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-sm text-slate-400">{item.quantity} {item.unit}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.24em] ${item.quantity <= item.lowStock ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                      {item.quantity <= item.lowStock ? 'Low stock' : 'In stock'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Recipe list</h3>
                <p className="text-sm text-slate-400">Use recipes to deduct consumables automatically.</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{recipes.length} recipes</span>
            </div>

            <div className="space-y-4">
              {recipes.map((recipe) => (
                <div key={recipe.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{recipe.name}</p>
                      <p className="text-sm text-slate-400">Sale price: {recipe.salePrice} MVR</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => useRecipe(recipe.id)}
                        className="rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
                      >
                        <Zap className="mr-2 inline h-4 w-4" /> Use recipe
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRecipeStatus(recipe.id)}
                        className="rounded-3xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        <RefreshCcw className="mr-2 inline h-4 w-4" /> {recipe.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-400">
                    {recipe.ingredients.map((ingredient) => (
                      <div key={`${recipe.id}-${ingredient.inventoryId}`} className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3">
                        <span>{ingredient.name}</span>
                        <span>{ingredient.quantity} {ingredient.unit}</span>
                      </div>
                    ))}
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
