import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, AlertCircle, ShoppingCart, Package, Zap } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection } from '../lib/firestore';
import type { Bill, DirectPurchase, InventoryItem, OrderItem } from '../types';

interface StockItem {
  id: string;
  name: string;
  totalPurchased: number;
  totalUsedInBills: number;
  currentStock: number;
  unit: string;
  lastPurchaseDate?: string;
  purchaseFrequency: number;
}

interface SmartSuggestion {
  type: 'low-stock' | 'high-demand' | 'unused' | 'reorder';
  message: string;
  itemName: string;
  priority: 'high' | 'medium' | 'low';
}

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

export default function StockOnHandPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<DirectPurchase[]>([]);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);

        // Load bills and purchases
        const [loadedBills, loadedPurchases] = await Promise.all([
          loadCollection<Bill>('bills', []),
          loadCollection<DirectPurchase>('directPurchases', []),
        ]);

        setBills(loadedBills);
        setPurchases(loadedPurchases);

        // Calculate stock on hand
        const stockMap = new Map<string, StockItem>();

        // Add purchases to stock
        loadedPurchases.forEach((purchase) => {
          purchase.items.forEach((item) => {
            const key = item.productName.toLowerCase();
            const existing = stockMap.get(key) || {
              id: `stock-${key}`,
              name: item.productName,
              totalPurchased: 0,
              totalUsedInBills: 0,
              currentStock: 0,
              unit: item.unit || 'units',
              purchaseFrequency: 0,
            };
            existing.totalPurchased += item.quantity;
            existing.currentStock += item.quantity;
            existing.lastPurchaseDate = purchase.date;
            existing.purchaseFrequency += 1;
            stockMap.set(key, existing);
          });
        });

        // Deduct from bills (items used in POS)
        loadedBills.forEach((bill) => {
          if (bill.status === 'Served' || bill.paymentStatus === 'Paid') {
            bill.items.forEach((billItem) => {
              const key = billItem.name.toLowerCase();
              const existing = stockMap.get(key);
              if (existing) {
                existing.totalUsedInBills += billItem.quantity;
                existing.currentStock = Math.max(0, existing.currentStock - billItem.quantity);
              }
            });
          }
        });

        const calculatedStock = Array.from(stockMap.values());
        setStockItems(calculatedStock);

        // Generate smart suggestions
        const smartSuggestions: SmartSuggestion[] = [];

        calculatedStock.forEach((item) => {
          const usageRate = item.totalUsedInBills / Math.max(item.purchaseFrequency, 1);

          // Low stock alert
          if (item.currentStock < 10 && item.totalUsedInBills > 0) {
            smartSuggestions.push({
              type: 'low-stock',
              message: `${item.name} is running low (${item.currentStock} ${item.unit} remaining)`,
              itemName: item.name,
              priority: item.currentStock === 0 ? 'high' : 'medium',
            });
          }

          // High demand detection
          if (usageRate > 5 && item.currentStock < 50) {
            smartSuggestions.push({
              type: 'high-demand',
              message: `${item.name} is in high demand. Consider increasing purchase quantity.`,
              itemName: item.name,
              priority: 'high',
            });
          }

          // Reorder suggestions
          if (item.totalUsedInBills > 50 && item.currentStock < 20) {
            smartSuggestions.push({
              type: 'reorder',
              message: `Reorder ${item.name} - frequently used but low stock`,
              itemName: item.name,
              priority: 'high',
            });
          }

          // Unused items
          if (item.totalPurchased > 0 && item.totalUsedInBills === 0 && item.purchaseFrequency > 2) {
            smartSuggestions.push({
              type: 'unused',
              message: `${item.name} has not been used despite multiple purchases`,
              itemName: item.name,
              priority: 'low',
            });
          }
        });

        setSuggestions(smartSuggestions.sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }));
      } catch (error) {
        console.error('Failed to load stock data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    const topPurchased = [...stockItems]
      .sort((a, b) => b.totalPurchased - a.totalPurchased)
      .slice(0, 3);

    const mostUsed = [...stockItems]
      .sort((a, b) => b.totalUsedInBills - a.totalUsedInBills)
      .slice(0, 3);

    const lowStockCount = stockItems.filter((item) => item.currentStock < 10).length;

    // Group by unit for proper totals
    const unitGroups = new Map<string, number>();
    stockItems.forEach((item) => {
      const current = unitGroups.get(item.unit) || 0;
      unitGroups.set(item.unit, current + item.currentStock);
    });

    // Create readable unit totals
    const unitTotals = Array.from(unitGroups.entries())
      .map(([unit, qty]) => `${qty} ${unit}`)
      .join(' | ');

    return { topPurchased, mostUsed, lowStockCount, unitTotals };
  }, [stockItems]);

  // Filter stock items
  const filteredStock = useMemo(() => {
    return stockItems.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stockItems, searchTerm]);

  const statCards: StatCard[] = [
    {
      label: 'Total Items in Stock',
      value: stockItems.length,
      icon: <Package className="h-6 w-6" />,
      color: 'blue',
    },
    {
      label: 'Low Stock Alerts',
      value: stats.lowStockCount,
      icon: <AlertCircle className="h-6 w-6" />,
      color: 'red',
    },
    {
      label: 'Total on Hand',
      value: stats.unitTotals || '0',
      icon: <ShoppingCart className="h-6 w-6" />,
      color: 'green',
    },
    {
      label: 'Pending Suggestions',
      value: suggestions.length,
      icon: <Zap className="h-6 w-6" />,
      color: 'amber',
    },
  ];

  return (
    <AppShell title="Stock on Hand">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, idx) => {
            const colorClasses = {
              blue: 'bg-blue-50 border-blue-200 text-blue-900',
              red: 'bg-red-50 border-red-200 text-red-900',
              green: 'bg-green-50 border-green-200 text-green-900',
              amber: 'bg-amber-50 border-amber-200 text-amber-900',
            };

            return (
              <div
                key={idx}
                className={`rounded-3xl border-2 p-4 ${colorClasses[card.color as keyof typeof colorClasses]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-widest opacity-75">
                      {card.label}
                    </p>
                    <p className={`font-bold mt-2 ${typeof card.value === 'string' ? 'text-lg break-words' : 'text-2xl'}`}>
                      {card.value}
                    </p>
                  </div>
                  <div className="opacity-50 flex-shrink-0">{card.icon}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Smart Suggestions */}
        {suggestions.length > 0 && (
          <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
            <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Smart Suggestions
            </h3>
            <div className="space-y-3">
              {suggestions.slice(0, 5).map((suggestion, idx) => {
                const bgColor = {
                  high: 'bg-red-50 border-red-200',
                  medium: 'bg-amber-50 border-amber-200',
                  low: 'bg-blue-50 border-blue-200',
                };
                const textColor = {
                  high: 'text-red-900',
                  medium: 'text-amber-900',
                  low: 'text-blue-900',
                };

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-4 flex items-start gap-3 ${bgColor[suggestion.priority]} ${textColor[suggestion.priority]}`}
                  >
                    <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">{suggestion.message}</p>
                      <p className="text-xs opacity-75 mt-1">Type: {suggestion.type.replace('-', ' ')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Top Items Overview */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Purchased Items */}
          <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top Purchased Items
            </h3>
            <div className="space-y-3">
              {stats.topPurchased.length > 0 ? (
                stats.topPurchased.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-100 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <span className="text-xs font-bold bg-green-200 text-green-900 px-2 py-1 rounded-full">
                        {item.totalPurchased} {item.unit}
                      </span>
                    </div>
                    <div className="w-full bg-slate-300 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (item.totalPurchased / Math.max(...stats.topPurchased.map(i => i.totalPurchased), 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No purchase data available</p>
              )}
            </div>
          </section>

          {/* Most Used Items */}
          <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Most Used in POS
            </h3>
            <div className="space-y-3">
              {stats.mostUsed.length > 0 ? (
                stats.mostUsed.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-100 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <span className="text-xs font-bold bg-blue-200 text-blue-900 px-2 py-1 rounded-full">
                        {item.totalUsedInBills} {item.unit}
                      </span>
                    </div>
                    <div className="w-full bg-slate-300 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (item.totalUsedInBills / Math.max(...stats.mostUsed.map(i => i.totalUsedInBills), 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No usage data available</p>
              )}
            </div>
          </section>
        </div>

        {/* All Stock Items */}
        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">All Stock Items</h3>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search items..."
                className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {loading ? (
              <p className="text-center text-slate-500 py-8">Loading stock data...</p>
            ) : filteredStock.length > 0 ? (
              filteredStock.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 ${
                    item.currentStock === 0
                      ? 'border-red-400 bg-red-50'
                      : item.currentStock < 10
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-slate-200 bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        Purchased: {item.totalPurchased} | Used: {item.totalUsedInBills} | Frequency: {item.purchaseFrequency}x
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900">{item.currentStock}</p>
                      <p className="text-xs text-slate-500">{item.unit}</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-300 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        item.currentStock === 0
                          ? 'bg-red-600'
                          : item.currentStock < 10
                          ? 'bg-amber-600'
                          : 'bg-green-600'
                      }`}
                      style={{
                        width: `${Math.min(100, (item.currentStock / Math.max(item.totalPurchased, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  {item.lastPurchaseDate && (
                    <p className="text-xs text-slate-400 mt-2">Last purchased: {item.lastPurchaseDate}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 py-8">No items match your search</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
