import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { DirectPurchase } from '../types';

export default function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState<DirectPurchase[]>([]);
  const [searchType, setSearchType] = useState<'product' | 'shop'>('product');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setLoading(false);
      return;
    }

    loadCollection<DirectPurchase>('directPurchases', [])
      .then((data) => {
        // Sort by date in descending order
        const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPurchases(sorted);
      })
      .catch((error) => console.error('Failed to load purchase history:', error))
      .finally(() => setLoading(false));
  }, []);

  // Filter purchases based on search query
  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return purchases;

    const query = searchQuery.toLowerCase().trim();
    return purchases.filter((purchase) => {
      if (searchType === 'product') {
        return purchase.items.some((item) =>
          item.productName.toLowerCase().includes(query),
        );
      } else {
        return purchase.shopName.toLowerCase().includes(query);
      }
    });
  }, [purchases, searchQuery, searchType]);

  // Calculate shop/supplier totals
  const shopSummary = useMemo(() => {
    const summary: {
      [key: string]: { totalValue: number; purchaseCount: number; lastPurchase: string };
    } = {};

    filteredPurchases.forEach((purchase) => {
      if (!summary[purchase.shopName]) {
        summary[purchase.shopName] = {
          totalValue: 0,
          purchaseCount: 0,
          lastPurchase: purchase.date,
        };
      }
      summary[purchase.shopName].totalValue += purchase.total;
      summary[purchase.shopName].purchaseCount += 1;
      // Update last purchase if this one is more recent
      if (new Date(purchase.date) > new Date(summary[purchase.shopName].lastPurchase)) {
        summary[purchase.shopName].lastPurchase = purchase.date;
      }
    });

    return Object.entries(summary)
      .map(([shopName, data]) => ({
        shopName,
        ...data,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredPurchases]);

  // Get unique products from filtered purchases
  const uniqueProducts = useMemo(() => {
    const products: { [key: string]: { count: number; totalValue: number; shops: Set<string>; shopPrices: { [shop: string]: number[] } } } = {};

    filteredPurchases.forEach((purchase) => {
      purchase.items.forEach((item) => {
        const productName = item.productName.toLowerCase();
        if (!products[productName]) {
          products[productName] = {
            count: 0,
            totalValue: 0,
            shops: new Set(),
            shopPrices: {},
          };
        }
        products[productName].count += 1;
        products[productName].totalValue += item.totalCost;
        products[productName].shops.add(purchase.shopName);
        
        // Track prices by shop
        if (!products[productName].shopPrices[purchase.shopName]) {
          products[productName].shopPrices[purchase.shopName] = [];
        }
        products[productName].shopPrices[purchase.shopName].push(item.unitCost);
      });
    });

    return Object.entries(products)
      .map(([productName, data]) => {
        // Calculate average price per shop
        const shopAveragePrices = Object.entries(data.shopPrices).map(([shop, prices]) => ({
          shop,
          avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
          minPrice: Math.min(...prices),
          maxPrice: Math.max(...prices),
        }));
        
        // Find cheapest shop
        const cheapestShop = shopAveragePrices.reduce((prev, current) =>
          current.avgPrice < prev.avgPrice ? current : prev,
        );

        return {
          productName,
          ...data,
          shops: Array.from(data.shops),
          shopAveragePrices,
          cheapestShop,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredPurchases]);

  const totalPurchaseValue = useMemo(
    () => filteredPurchases.reduce((sum, p) => sum + p.total, 0),
    [filteredPurchases],
  );

  return (
    <AppShell title="Purchase History">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Search and Filters */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm h-fit lg:sticky lg:top-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Search & Filter</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-3">Search By</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSearchType('product')}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    searchType === 'product'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Product
                </button>
                <button
                  onClick={() => setSearchType('shop')}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    searchType === 'shop'
                      ? 'bg-green-600 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Shop/Supplier
                </button>
              </div>
            </div>

            <label className="block text-sm text-slate-500">
              Search {searchType === 'product' ? 'Product' : 'Shop/Supplier'}
              <div className="relative mt-2">
                <Search className="absolute left-4 top-3 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search by ${searchType}...`}
                  className="w-full pl-12 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
                />
              </div>
            </label>

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 w-full rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Clear Search
              </button>
            )}

            <div className="mt-6 rounded-3xl bg-blue-50 p-4 border border-blue-200">
              <p className="text-sm text-blue-600 font-semibold">Results</p>
              <p className="text-2xl font-bold text-blue-900 mt-2">{filteredPurchases.length}</p>
              <p className="text-xs text-blue-700 mt-1">
                {searchType === 'product' ? 'purchases' : 'purchases'}
              </p>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-sm text-blue-700">Total Value</p>
                <p className="text-xl font-bold text-blue-900">{formatMVR(totalPurchaseValue)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="space-y-6">
          {/* Shop Summary */}
          {searchType === 'shop' && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-slate-900">Shop/Supplier Summary</h3>
                <p className="text-sm text-slate-500 mt-1">Total purchased value by shop</p>
              </div>

              {shopSummary.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No shops found.</p>
              ) : (
                <div className="space-y-3">
                  {shopSummary.map((shop) => (
                    <div
                      key={shop.shopName}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-slate-300 hover:bg-slate-100 transition"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">{shop.shopName}</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Last purchase: {new Date(shop.lastPurchase).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Purchase Count</p>
                          <p className="text-lg font-bold text-slate-900">{shop.purchaseCount}</p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">Total Purchase Value</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{formatMVR(shop.totalValue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Product Summary */}
          {searchType === 'product' && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-slate-900">Product Summary</h3>
                <p className="text-sm text-slate-500 mt-1">Total purchased value by product with price comparisons</p>
              </div>

              {uniqueProducts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No products found.</p>
              ) : (
                <div className="space-y-4">
                  {uniqueProducts.map((product) => (
                    <div
                      key={product.productName}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-slate-300 hover:bg-slate-100 transition"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 capitalize">{product.productName}</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Purchased {product.count}× | Shops: {product.shops.join(', ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Total Value</p>
                          <p className="text-lg font-bold text-blue-600">{formatMVR(product.totalValue)}</p>
                        </div>
                      </div>

                      {/* Price Comparison by Shop */}
                      {product.shopAveragePrices.length > 1 && (
                        <div className="rounded-lg bg-white border border-slate-200 p-3 mb-3">
                          <p className="text-xs font-semibold text-slate-600 mb-2">💰 Price by Shop</p>
                          <div className="space-y-2">
                            {product.shopAveragePrices.map((shopPrice) => {
                              const isCheapest = shopPrice.shop === product.cheapestShop.shop;
                              return (
                                <div
                                  key={shopPrice.shop}
                                  className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg ${
                                    isCheapest ? 'bg-green-50 border border-green-200' : 'bg-slate-50'
                                  }`}
                                >
                                  <div>
                                    <span className="font-medium text-slate-900">{shopPrice.shop}</span>
                                    {isCheapest && <span className="text-green-600 ml-2">✓ Cheapest</span>}
                                  </div>
                                  <div className="text-right">
                                    <span className={`font-semibold ${isCheapest ? 'text-green-700' : 'text-slate-900'}`}>
                                      {formatMVR(shopPrice.avgPrice)}
                                    </span>
                                    {shopPrice.minPrice !== shopPrice.maxPrice && (
                                      <span className="text-slate-500 ml-1 text-xs">
                                        ({formatMVR(shopPrice.minPrice)}-{formatMVR(shopPrice.maxPrice)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {product.shopAveragePrices.length > 1 && (
                            <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
                              💡 This product is{' '}
                              <span className="font-semibold text-slate-900">
                                {formatMVR(
                                  Math.max(...product.shopAveragePrices.map((p) => p.avgPrice)) -
                                    product.cheapestShop.avgPrice,
                                )}
                              </span>{' '}
                              cheaper in <span className="font-semibold">{product.cheapestShop.shop}</span> vs other shops
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Detailed Purchase List */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-slate-900">Purchase Details</h3>
              <p className="text-sm text-slate-500 mt-1">Individual purchase records</p>
            </div>

            {loading ? (
              <p className="text-center text-slate-500 py-8">Loading purchase history...</p>
            ) : filteredPurchases.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No purchases found matching your search.</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {filteredPurchases.map((purchase) => (
                  <div key={purchase.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">{purchase.shopName}</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(purchase.date).toLocaleDateString()} at{' '}
                          {new Date(purchase.date).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-lg font-bold text-emerald-600">{formatMVR(purchase.total)}</p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="rounded-lg bg-white border border-slate-200 p-3">
                      <p className="text-xs font-semibold text-slate-600 mb-2">Items ({purchase.items.length})</p>
                      <div className="space-y-1 text-xs">
                        {purchase.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-slate-600">
                            <span>
                              {item.productName} × {item.quantity} {item.unit}
                            </span>
                            <span className="font-semibold text-slate-900">{formatMVR(item.totalCost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
