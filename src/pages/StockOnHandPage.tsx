import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, AlertCircle, ShoppingCart, Package, Zap } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection } from '../lib/firestore';
import type { Bill, DirectPurchase } from '../types';

interface StockItem {
  id: string;
  name: string;
  totalPurchased: number;
  totalUsedInBills: number;
  currentStock: number;
  unit: string;
  lastPurchaseDate?: string;
  purchaseFrequency: number;
  totalCost?: number;
  estimatedValue?: number;
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

        // Load data for analysis

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
              totalCost: 0,
              estimatedValue: 0,
            };
            existing.totalPurchased += item.quantity;
            existing.currentStock += item.quantity;
            existing.lastPurchaseDate = purchase.date;
            existing.purchaseFrequency += 1;
            existing.totalCost = (existing.totalCost || 0) + (item.totalCost || 0);
            existing.estimatedValue = existing.currentStock * (existing.totalCost && existing.totalPurchased > 0 ? existing.totalCost / existing.totalPurchased : 0);
            stockMap.set(key, existing);
          });
        });

        // Deduct from bills (items used in POS)
        loadedBills.forEach((bill) => {
          if (bill.status === 'Served' || bill.paymentStatus === 'Paid') {
            bill.items.forEach((billItem: any) => {
              const key = billItem.name.toLowerCase();
              const existing = stockMap.get(key);
              if (existing) {
                existing.totalUsedInBills += billItem.quantity;
                existing.currentStock = Math.max(0, existing.currentStock - billItem.quantity);
                existing.estimatedValue = existing.currentStock * (existing.totalCost && existing.totalPurchased > 0 ? existing.totalCost / existing.totalPurchased : 0);
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
    // Filter items with actual data for top purchased
    const itemsWithPurchases = stockItems.filter(item => item.totalPurchased > 0);
    
    // Sort by purchase frequency (most ordered)
    const topByFrequency = [...itemsWithPurchases]
      .sort((a, b) => b.purchaseFrequency - a.purchaseFrequency)
      .slice(0, 3);

    // Sort by total quantity purchased (top volume)
    const topByVolume = [...itemsWithPurchases]
      .sort((a, b) => b.totalPurchased - a.totalPurchased)
      .slice(0, 3);

    // Filter items with actual usage for most used
    const itemsWithUsage = stockItems.filter(item => item.totalUsedInBills > 0);
    const mostUsed = [...itemsWithUsage]
      .sort((a, b) => b.totalUsedInBills - a.totalUsedInBills)
      .slice(0, 3);

    // Top items by estimated value
    const topByValue = [...stockItems]
      .filter(item => (item.estimatedValue || 0) > 0)
      .sort((a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0))
      .slice(0, 3);

    const lowStockCount = stockItems.filter((item) => item.currentStock < 10 && item.currentStock > 0).length;
    const totalInventoryValue = stockItems.reduce((sum, item) => sum + (item.estimatedValue || 0), 0);

    // Group by unit for proper totals - only count items with stock
    const unitGroups = new Map<string, number>();
    stockItems.forEach((item) => {
      if (item.currentStock > 0) {
        const current = unitGroups.get(item.unit) || 0;
        unitGroups.set(item.unit, current + item.currentStock);
      }
    });

    // Create readable unit totals
    const unitTotalsArray = Array.from(unitGroups.entries())
      .map(([unit, qty]) => {
        const roundedQty = Math.round(qty * 100) / 100;
        return `${roundedQty} ${unit}`;
      });
    
    const unitTotals = unitTotalsArray.length > 0 ? unitTotalsArray.join(' | ') : 'No stock';

    return { topByFrequency, topByVolume, mostUsed, topByValue, lowStockCount, unitTotals, totalInventoryValue };
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
      label: 'Inventory Value',
      value: `${Math.round(stats.totalInventoryValue)} MVR`,
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
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Top Purchased Items - By Frequency */}
          <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Most Frequently Ordered
            </h3>
            <div className="space-y-3">
              {stats.topByFrequency.length > 0 ? (
                stats.topByFrequency.map((item) => {
                  const maxFreq = Math.max(...stats.topByFrequency.map(i => i.purchaseFrequency), 1);
                  const percentage = (item.purchaseFrequency / maxFreq) * 100;
                  
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-100 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">Total: {item.totalPurchased} {item.unit} | Stock: {item.currentStock} {item.unit}</p>
                        </div>
                        <span className="text-xs font-bold bg-green-200 text-green-900 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                          {item.purchaseFrequency}x orders
                        </span>
                      </div>
                      <div className="w-full bg-slate-300 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
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
                stats.mostUsed.map((item) => {
                  const maxUsed = Math.max(...stats.mostUsed.map(i => i.totalUsedInBills), 1);
                  const percentage = (item.totalUsedInBills / maxUsed) * 100;
                  
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-100 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">Stock: {item.currentStock} {item.unit}</p>
                        </div>
                        <span className="text-xs font-bold bg-blue-200 text-blue-900 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                          {item.totalUsedInBills} {item.unit}
                        </span>
                      </div>
                      <div className="w-full bg-slate-300 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No usage data available yet</p>
              )}
            </div>
          </section>

          {/* Top by Inventory Value */}
          <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Top by Stock Value
            </h3>
            <div className="space-y-3">
              {stats.topByValue.length > 0 ? (
                stats.topByValue.map((item) => {
                  const maxValue = Math.max(...stats.topByValue.map(i => i.estimatedValue || 0), 1);
                  const percentage = ((item.estimatedValue || 0) / maxValue) * 100;
                  
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-100 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">Qty: {item.currentStock} {item.unit}</p>
                        </div>
                        <span className="text-xs font-bold bg-purple-200 text-purple-900 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                          {Math.round(item.estimatedValue || 0)} MVR
                        </span>
                      </div>
                      <div className="w-full bg-slate-300 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No value data available</p>
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
