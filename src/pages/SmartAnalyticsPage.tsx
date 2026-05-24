import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, AlertCircle, Zap, Package, ShoppingCart, Clock, Target, Brain } from 'lucide-react';
import AppShell from '../components/AppShell';
import { loadCollection } from '../lib/firestore';
import { useInventory } from '../context/InventoryContext';
import { formatMVR } from '../lib/mvr';
import type { DirectPurchase } from '../types';

interface ProductTrend {
  productName: string;
  avgDailyPurchase: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  purchaseFrequency: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  daysUntilStockout: number;
  currentStock: number;
}

interface SmartAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  action?: string;
  timestamp: string;
}

export default function SmartAnalyticsPage() {
  const { inventory } = useInventory();
  const [purchases, setPurchases] = useState<DirectPurchase[]>([]);
  const [timeRange, setTimeRange] = useState<30 | 60 | 90>(30);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);

  useEffect(() => {
    loadCollection<DirectPurchase>('directPurchases', [])
      .then((items) => setPurchases(items))
      .catch(() => undefined);
  }, []);

  // Calculate daily purchase analytics
  const purchaseAnalytics = useMemo(() => {
    const dailyMap = new Map<string, { quantity: number; cost: number; itemCount: number }>();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);

    purchases.forEach((purchase) => {
      const purchaseDate = purchase.date.slice(0, 10);
      const purchaseTime = new Date(purchase.date);
      if (purchaseTime >= cutoffDate) {
        const existing = dailyMap.get(purchaseDate) || { quantity: 0, cost: 0, itemCount: 0 };
        purchase.items.forEach((item) => {
          existing.quantity += item.quantity;
          existing.cost += item.totalCost;
        });
        existing.itemCount += purchase.items.length;
        dailyMap.set(purchaseDate, existing);
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        totalQuantity: data.quantity,
        totalCost: data.cost,
        itemCount: data.itemCount,
        avgCostPerItem: data.quantity > 0 ? data.cost / data.quantity : 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [purchases, timeRange]);

  // Calculate product trends and recommendations
  const productTrends = useMemo(() => {
    const productMap = new Map<string, { quantities: number[]; dates: string[]; totalQuantity: number; totalCost: number }>();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);

    purchases.forEach((purchase) => {
      const purchaseTime = new Date(purchase.date);
      if (purchaseTime >= cutoffDate) {
        purchase.items.forEach((item) => {
          const existing = productMap.get(item.productName) || { quantities: [], dates: [], totalQuantity: 0, totalCost: 0 };
          existing.quantities.push(item.quantity);
          existing.dates.push(purchase.date.slice(0, 10));
          existing.totalQuantity += item.quantity;
          existing.totalCost += item.totalCost;
          productMap.set(item.productName, existing);
        });
      }
    });

    const trends: ProductTrend[] = Array.from(productMap.entries()).map(([productName, data]) => {
      const avgDailyPurchase = data.totalQuantity / timeRange;
      const inventoryItem = inventory.find((inv) => inv.name === productName);
      const currentStock = inventoryItem?.quantity || 0;
      const daysUntilStockout = avgDailyPurchase > 0 ? Math.ceil(currentStock / avgDailyPurchase) : 999;
      
      // Calculate trend
      const recentQuantities = data.quantities.slice(-7);
      const oldQuantities = data.quantities.slice(-14, -7);
      const recentAvg = recentQuantities.length > 0 ? recentQuantities.reduce((a, b) => a + b, 0) / recentQuantities.length : 0;
      const oldAvg = oldQuantities.length > 0 ? oldQuantities.reduce((a, b) => a + b, 0) / oldQuantities.length : 0;
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (recentAvg > oldAvg * 1.2) trend = 'increasing';
      else if (recentAvg < oldAvg * 0.8) trend = 'decreasing';

      // Determine risk level
      let riskLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
      if (daysUntilStockout < 3) riskLevel = 'critical';
      else if (daysUntilStockout < 7) riskLevel = 'high';
      else if (daysUntilStockout < 14) riskLevel = 'medium';

      // Generate recommendation
      let recommendation = 'Monitor regularly';
      if (riskLevel === 'critical') recommendation = '🚨 Order immediately - stock critical';
      else if (riskLevel === 'high') recommendation = '⚠️ Order soon - stock running low';
      else if (trend === 'increasing') recommendation = '📈 Increasing demand - consider larger orders';
      else if (trend === 'decreasing') recommendation = '📉 Demand decreasing - adjust order quantities';

      return {
        productName,
        avgDailyPurchase,
        trend,
        purchaseFrequency: data.quantities.length,
        riskLevel,
        recommendation,
        daysUntilStockout,
        currentStock,
      };
    });

    return trends.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });
  }, [purchases, inventory, timeRange]);

  // Generate smart alerts
  useEffect(() => {
    const newAlerts: SmartAlert[] = [];

    productTrends.forEach((trend) => {
      if (trend.riskLevel === 'critical') {
        newAlerts.push({
          id: `critical-${trend.productName}`,
          type: 'critical',
          title: `${trend.productName} - Critical Stock Level`,
          message: `Only ${trend.currentStock} units remaining. At current purchase rate of ${trend.avgDailyPurchase.toFixed(1)}/day, stock will deplete in ${trend.daysUntilStockout} days.`,
          action: 'Order immediately',
          timestamp: new Date().toISOString(),
        });
      } else if (trend.riskLevel === 'high' && trend.trend === 'increasing') {
        newAlerts.push({
          id: `high-${trend.productName}`,
          type: 'warning',
          title: `${trend.productName} - High Demand Detected`,
          message: `Purchase demand is increasing. Average daily purchase: ${trend.avgDailyPurchase.toFixed(1)} units.`,
          action: 'Review purchase strategy',
          timestamp: new Date().toISOString(),
        });
      }
    });

    setAlerts(newAlerts.slice(0, 5)); // Keep top 5 alerts
  }, [productTrends]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalPurchases = purchaseAnalytics.reduce((sum, day) => sum + day.totalQuantity, 0);
    const totalCost = purchaseAnalytics.reduce((sum, day) => sum + day.totalCost, 0);
    const avgDaily = purchaseAnalytics.length > 0 ? totalPurchases / purchaseAnalytics.length : 0;
    const avgDailySpend = purchaseAnalytics.length > 0 ? totalCost / purchaseAnalytics.length : 0;

    return {
      totalPurchases,
      totalCost,
      avgDaily,
      avgDailySpend,
      peakDay: purchaseAnalytics.reduce((max, day) => (day.totalQuantity > max.totalQuantity ? day : max), purchaseAnalytics[0] || { date: 'N/A', totalQuantity: 0, totalCost: 0, itemCount: 0, avgCostPerItem: 0 }),
      criticalItems: productTrends.filter((t) => t.riskLevel === 'critical').length,
      highDemandItems: productTrends.filter((t) => t.trend === 'increasing').length,
    };
  }, [purchaseAnalytics, productTrends]);

  return (
    <AppShell title="Smart Analytics">
      <div className="space-y-6">
        {/* Header with Time Range Selector */}
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Brain className="h-6 w-6 text-blue-600" /> Smart Purchase Analytics
            </h2>
            <p className="text-sm text-slate-600 mt-1">AI-powered insights on purchase trends and inventory predictions</p>
          </div>
          <div className="flex gap-2">
            {[30, 60, 90].map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days as 30 | 60 | 90)}
                className={`px-4 py-2 rounded-2xl font-semibold transition ${
                  timeRange === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {/* Smart Alerts Section */}
        {alerts.length > 0 && (
          <div className="grid gap-3">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-600" /> Smart Alerts
            </h3>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-2xl border-l-4 p-4 ${
                  alert.type === 'critical'
                    ? 'border-red-600 bg-red-50'
                    : alert.type === 'warning'
                      ? 'border-orange-600 bg-orange-50'
                      : 'border-blue-600 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      className={`h-5 w-5 mt-0.5 ${
                        alert.type === 'critical' ? 'text-red-600' : alert.type === 'warning' ? 'text-orange-600' : 'text-blue-600'
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{alert.title}</p>
                      <p className="text-sm text-slate-600 mt-1">{alert.message}</p>
                    </div>
                  </div>
                  {alert.action && (
                    <button className="ml-4 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap">
                      {alert.action}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Avg Daily Purchase</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{summaryMetrics.avgDaily.toFixed(1)}</p>
                <p className="text-xs text-slate-500 mt-1">units / day</p>
              </div>
              <ShoppingCart className="h-12 w-12 text-blue-600/20" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-green-50 to-green-100/50 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Avg Daily Spend</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatMVR(summaryMetrics.avgDailySpend)}</p>
                <p className="text-xs text-slate-500 mt-1">per day</p>
              </div>
              <Package className="h-12 w-12 text-green-600/20" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-orange-50 to-orange-100/50 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Critical Items</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{summaryMetrics.criticalItems}</p>
                <p className="text-xs text-slate-500 mt-1">need urgent order</p>
              </div>
              <AlertCircle className="h-12 w-12 text-orange-600/20" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-purple-50 to-purple-100/50 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">High Demand Items</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{summaryMetrics.highDemandItems}</p>
                <p className="text-xs text-slate-500 mt-1">increasing trend</p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-600/20" />
            </div>
          </div>
        </div>

        {/* Purchase Trend Chart */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" /> Purchase Trend ({timeRange} days)
          </h3>
          {purchaseAnalytics.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={purchaseAnalytics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" style={{ fontSize: '0.75rem' }} />
                <YAxis style={{ fontSize: '0.75rem' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: 'none', borderRadius: '12px', color: '#fff' }}
                  formatter={(value: any) => (value as number).toFixed(1)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="totalQuantity"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  name="Daily Quantity"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-400">No data available</div>
          )}
        </div>

        {/* Cost Analysis Chart */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-green-600" /> Daily Purchase Cost
          </h3>
          {purchaseAnalytics.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={purchaseAnalytics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" style={{ fontSize: '0.75rem' }} />
                <YAxis style={{ fontSize: '0.75rem' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: 'none', borderRadius: '12px', color: '#fff' }}
                  formatter={(value: any) => formatMVR(value as number)}
                />
                <Bar dataKey="totalCost" fill="#10b981" name="Daily Cost" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-400">No data available</div>
          )}
        </div>

        {/* Product Recommendations */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-2xl shadow-slate-300/20">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-600" /> Smart Recommendations
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {productTrends.length > 0 ? (
              productTrends.map((trend) => (
                <div
                  key={trend.productName}
                  className={`rounded-2xl border-l-4 p-4 ${
                    trend.riskLevel === 'critical'
                      ? 'border-red-600 bg-red-50/50'
                      : trend.riskLevel === 'high'
                        ? 'border-orange-600 bg-orange-50/50'
                        : trend.riskLevel === 'medium'
                          ? 'border-yellow-600 bg-yellow-50/50'
                          : 'border-emerald-600 bg-emerald-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-slate-900">{trend.productName}</p>
                      <p className="text-xs text-slate-500">
                        Current Stock: <span className="font-bold">{trend.currentStock}</span> units
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${
                        trend.riskLevel === 'critical'
                          ? 'bg-red-600 text-white'
                          : trend.riskLevel === 'high'
                            ? 'bg-orange-600 text-white'
                            : trend.riskLevel === 'medium'
                              ? 'bg-yellow-600 text-white'
                              : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {trend.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div>
                      <span className="text-slate-500">Avg Daily Purchase:</span>
                      <span className="ml-1 font-semibold">{trend.avgDailyPurchase.toFixed(2)} units</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Days Until Stockout:</span>
                      <span className="ml-1 font-semibold">{trend.daysUntilStockout} days</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Trend:</span>
                      <span className="ml-1 font-semibold flex items-center gap-1">
                        {trend.trend === 'increasing' && '📈 Increasing'}
                        {trend.trend === 'decreasing' && '📉 Decreasing'}
                        {trend.trend === 'stable' && '➡️ Stable'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Purchase Frequency:</span>
                      <span className="ml-1 font-semibold">{trend.purchaseFrequency}x in {timeRange}d</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 bg-white/50 p-2 rounded-lg">{trend.recommendation}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">No product data available for analysis</div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
