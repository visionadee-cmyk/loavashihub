import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, hasFirebaseConfig } from '../lib/firebase';
import type { InventoryItem, Recipe } from '../types';

interface InventoryContextState {
  inventory: InventoryItem[];
  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryItem: (item: InventoryItem) => void;
  deleteInventoryItem: (id: string) => void;
  adjustInventoryByRecipe: (recipe: Recipe) => boolean;
  hasSufficientInventory: (recipe: Recipe) => boolean;
}

const InventoryContext = createContext<InventoryContextState | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    const firestore = db;
    if (!hasFirebaseConfig || !firestore) {
      setInventory([]);
      return;
    }

    const loadInventory = async () => {
      const snapshot = await getDocs(collection(firestore, 'inventory'));
      setInventory(
        snapshot.docs.map((record) => {
          const data = record.data() as Omit<InventoryItem, 'id'>;
          return { ...data, id: record.id };
        }),
      );
    };

    loadInventory().catch((error) => {
      console.error('Failed to load inventory from Firestore:', error);
      setInventory([]);
    });
  }, []);

  const persistInventoryItem = async (item: InventoryItem) => {
    const firestore = db;
    if (!hasFirebaseConfig || !firestore) {
      return;
    }
    await setDoc(doc(firestore, 'inventory', item.id), item);
  };

  const addInventoryItem = (item: InventoryItem) => {
    setInventory((current) => [item, ...current]);
    persistInventoryItem(item).catch((error) => console.error('Failed to save inventory item:', error));
  };

  const updateInventoryItem = (item: InventoryItem) => {
    setInventory((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
    persistInventoryItem(item).catch((error) => console.error('Failed to update inventory item:', error));
  };

  const deleteInventoryItem = (id: string) => {
    setInventory((current) => current.filter((entry) => entry.id !== id));
    const firestore = db;
    if (hasFirebaseConfig && firestore) {
      deleteDoc(doc(firestore, 'inventory', id)).catch((error) => console.error('Failed to delete inventory item:', error));
    }
  };

  const hasSufficientInventory = useMemo(
    () =>
      (recipe: Recipe) =>
        recipe.ingredients.every((ingredient) => {
          const stock = inventory.find((item) => item.id === ingredient.inventoryId);
          return stock ? stock.quantity >= ingredient.quantity : false;
        }),
    [inventory],
  );

  const adjustInventoryByRecipe = (recipe: Recipe) => {
    if (!hasSufficientInventory(recipe)) return false;

    const updatedInventory = inventory.map((item) => {
      const ingredient = recipe.ingredients.find((entry) => entry.inventoryId === item.id);
      if (!ingredient) return item;
      return { ...item, quantity: Math.max(0, item.quantity - ingredient.quantity) };
    });

    setInventory(updatedInventory);
    const firestore = db;
    if (hasFirebaseConfig && firestore) {
      updatedInventory.forEach((item) => {
        setDoc(doc(firestore, 'inventory', item.id), item).catch((error) => {
          console.error('Failed to persist inventory adjustment:', error);
        });
      });
    }

    return true;
  };

  return (
    <InventoryContext.Provider
      value={{
        inventory,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        adjustInventoryByRecipe,
        hasSufficientInventory,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within InventoryProvider');
  }
  return context;
}
