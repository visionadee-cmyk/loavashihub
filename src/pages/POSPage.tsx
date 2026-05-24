import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  RotateCcw,
  Wifi,
  Grid as GridIcon,
  Home,
  Users2,
  Table,
  CreditCard,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  X,
  ArrowRight,
  Pause,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { formatMVR } from '../lib/mvr';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadCollection, saveDocument } from '../lib/firestore';
import type { Bill, Customer, MenuItem, OrderItem, TableItem } from '../types';

const defaultCustomer: Partial<Customer> = {
  name: '',
  phone: '',
  email: '',
  notes: '',
};

const defaultCustomItem = { name: '', price: 0 };

const internalNav = [
  { path: '/pos', label: 'Home', icon: Home },
  { path: '/customers', label: 'Customers', icon: Users2 },
  { path: '/admin/tables', label: 'Tables', icon: Table },
  { path: '/pos', label: 'Cashier', icon: CreditCard },
  { path: '/bills/pending', label: 'Orders', icon: ShoppingCart },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

function generateBillNumber(tableName: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const prefix = tableName.trim() || 'Table';
  return `${prefix}-${year}${month}${day}-${hour}${minute}${second}`;
}

function buildOrderItem(item: MenuItem | { name: string; price: number }): OrderItem {
  return {
    id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    productId: 'id' in item ? item.id : `custom-${Date.now()}`,
    name: item.name,
    price: item.price,
    quantity: 1,
    notes: '',
  };
}

function createEmptyBill(tableName: string): Bill {
  const billNumber = generateBillNumber(tableName);
  return {
    id: `bill-${Date.now()}`,
    billNumber,
    title: billNumber,
    table: tableName,
    items: [],
    orderType: 'Dine-in',
    discount: 0,
    tax: 5,
    status: 'Pending',
    notes: '',
    paymentMethod: 'Cash',
    paymentStatus: 'Unpaid',
    createdAt: new Date().toISOString(),
  };
}

export default function POSPage() {
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [activeBillId, setActiveBillId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [discountPercent] = useState(0);
  const [customerPanelOpen, setCustomerPanelOpen] = useState(false);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [showCustomItemForm, setShowCustomItemForm] = useState(false);
  const [customItem, setCustomItem] = useState(defaultCustomItem);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>(defaultCustomer);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cartSidebarOpen, setCartSidebarOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(products.map((product) => product.category)))],
    [products],
  );

  const activeBill = useMemo(
    () => bills.find((bill) => bill.id === activeBillId) ?? bills[0] ?? null,
    [bills, activeBillId],
  );

  const loadData = async () => {
    if (!hasFirebaseConfig) {
      setStatusMessage('Firebase is not configured. POS cannot load real menu, tables, or bills.');
      return;
    }

    setStatusMessage(null);

    try {
      const [loadedProducts, loadedTables, loadedBills, loadedCustomers] = await Promise.all([
        loadCollection<MenuItem>('menuItems', []),
        loadCollection<TableItem>('tables', []),
        loadCollection<Bill>('bills', []),
        loadCollection<Customer>('customers', []),
      ]);

      setProducts(loadedProducts);
      setTables(loadedTables);
      setCustomers(loadedCustomers);

      let initialBill = loadedBills.find((bill) => bill.status !== 'Served') ?? null;
      let allBills = loadedBills;

      if (!initialBill && loadedTables.length) {
        initialBill = createEmptyBill(loadedTables[0].name);
        allBills = [...loadedBills, initialBill];
        await saveDocument('bills', initialBill.id, initialBill);
      }

      if (allBills.length) {
        setBills(allBills);
        setActiveBillId(initialBill?.id ?? allBills[0].id);
      } else {
        setBills([]);
        setActiveBillId('');
      }

      if (!loadedTables.length) {
        setStatusMessage('Add your tables first in Table Management before taking POS orders.');
      }
    } catch (error) {
      console.error('Failed to load POS data from Firestore:', error);
      setStatusMessage('Unable to load POS data from Firestore. Verify your Firebase connection.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateBill = (updatedBill: Bill) => {
    setBills((current) => current.map((bill) => (bill.id === updatedBill.id ? updatedBill : bill)));
    if (hasFirebaseConfig) {
      saveDocument('bills', updatedBill.id, updatedBill).catch((error) => {
        console.error('Failed to persist bill:', error);
        setStatusMessage('Unable to save bill to Firestore. Check your connection.');
      });
    }
  };

  const handleAddItem = (product: MenuItem) => {
    if (!activeBill) return;
    const updatedBill: Bill = {
      ...activeBill,
      items: activeBill.items.some((item) => item.productId === product.id)
        ? activeBill.items.map((item) =>
            item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...activeBill.items, buildOrderItem(product)],
    };
    updateBill(updatedBill);
  };

  const updateQuantity = (itemId: string, nextQuantity: number) => {
    if (!activeBill) return;
    const updatedBill: Bill = {
      ...activeBill,
      items: activeBill.items
        .map((item) => (item.id === itemId ? { ...item, quantity: Math.max(1, nextQuantity) } : item))
        .filter((item) => item.quantity > 0),
    };
    updateBill(updatedBill);
  };

  const removeItem = (itemId: string) => {
    if (!activeBill) return;
    const updatedBill: Bill = {
      ...activeBill,
      items: activeBill.items.filter((item) => item.id !== itemId),
    };
    updateBill(updatedBill);
  };

  const assignCustomer = (customerId: string) => {
    if (!activeBill) return;
    const customer = customers.find((entry) => entry.id === customerId);
    if (!customer) return;
    updateBill({ ...activeBill, customerId: customer.id, customerName: customer.name });
    setCustomerPanelOpen(false);
  };

  const addCustomer = async () => {
    if (!newCustomer.name?.trim()) {
      setStatusMessage('Customer name is required.');
      return;
    }

    const payload: Customer = {
      id: `customer-${Date.now()}`,
      name: newCustomer.name.trim(),
      phone: newCustomer.phone?.trim() || 'N/A',
      email: newCustomer.email?.trim() || 'N/A',
      notes: newCustomer.notes?.trim() || '',
    };

    setCustomers((current) => [payload, ...current]);
    setNewCustomer(defaultCustomer);
    setStatusMessage('Customer created. Select them for the bill in the panel.');
    if (hasFirebaseConfig) {
      await saveDocument('customers', payload.id, payload).catch((error) => {
        console.error('Failed to save customer in Firestore:', error);
        setStatusMessage('Customer was created locally but did not persist.');
      });
    }
  };

  const addCustomItem = () => {
    if (!activeBill) return;
    if (!customItem.name.trim() || customItem.price <= 0) {
      setStatusMessage('Enter a valid custom item name and price.');
      return;
    }

    const updatedBill: Bill = {
      ...activeBill,
      items: [...activeBill.items, buildOrderItem(customItem)],
    };
    updateBill(updatedBill);
    setCustomItem(defaultCustomItem);
    setShowCustomItemForm(false);
    setStatusMessage('Custom item added to the bill.');
  };

  const togglePaymentStatus = () => {
    if (!activeBill) return;
    const paid = activeBill.paymentStatus === 'Paid';
    updateBill({
      ...activeBill,
      paymentStatus: paid ? 'Unpaid' : 'Paid',
      status: paid ? 'Pending' : 'Served',
    });
  };

  const holdOrder = () => {
    if (!activeBill) return;
    updateBill({ ...activeBill, status: 'Pending' });
    setStatusMessage('Order is placed on hold.');
  };

  const saveCurrentBill = async () => {
    if (!activeBill) return;
    if (!activeBill.items.length) {
      setStatusMessage('Add at least one item before saving this order.');
      return;
    }

    const savedBill: Bill = {
      ...activeBill,
      status: 'Pending',
      paymentStatus: 'Unpaid',
      paymentMethod: activeBill.paymentMethod ?? 'Cash',
    };

    updateBill(savedBill);

    const newBill = createEmptyBill(activeBill.table || tables[0]?.name || 'Table 1');
    setBills((current) => [...current, newBill]);
    setActiveBillId(newBill.id);

    if (hasFirebaseConfig) {
      try {
        await saveDocument('bills', newBill.id, newBill);
      } catch (error) {
        console.error('Failed to create new bill after saving order:', error);
        setStatusMessage('Order saved, but failed to create the next bill in Firestore.');
      }
    }

    setStatusMessage('Order saved as an open bill. New POS bill is ready.');
    navigate('/bills/pending');
  };

  const payable = useMemo(() => {
    if (!activeBill) return 0;
    const subtotal = activeBill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxAmount = Math.round((subtotal * (activeBill.tax ?? 5)) / 100);
    const discountValue = Math.round((subtotal * discountPercent) / 100);
    return Math.max(0, subtotal + taxAmount - discountValue);
  }, [activeBill, discountPercent]);

  const selectTable = (tableId: string) => {
    if (!activeBill) return;
    const table = tables.find((entry) => entry.id === tableId);
    if (!table) return;
    updateBill({ ...activeBill, table: table.name });
    setTableMenuOpen(false);
  };

  const refreshData = () => {
    loadData();
    setStatusMessage('Refreshing POS data from Firestore...');
  };

  const focusSearch = () => {
    searchInputRef.current?.focus();
  };

  const subtotal = useMemo(
    () => activeBill?.items.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0,
    [activeBill],
  );

  const taxAmount = Math.round((subtotal * (activeBill?.tax ?? 5)) / 100);

  const filteredProducts = useMemo(
    () =>
      products
        .filter((product) => (activeCategory === 'All' ? true : product.category === activeCategory))
        .filter((product) => product.name.toLowerCase().includes(search.toLowerCase())),
    [activeCategory, products, search],
  );

  return (
    <AppShell title="Restro POS">

      <div className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8 pt-16 lg:pt-5">
        <div className="grid min-h-[calc(100vh-160px)] grid-cols-1 lg:grid-cols-[96px_minmax(0,1fr)_420px] gap-4 md:gap-6 bg-slate-50 px-3 md:px-4 py-3 md:py-4 rounded-[32px] shadow-[0_20px_80px_rgba(5,9,63,0.08)]">
          {/* Left Sidebar - Hidden on mobile/tablet, shown on lg screens */}
          <aside className="hidden lg:flex h-full flex-col justify-between rounded-[32px] border border-slate-200 bg-white px-4 py-6 shadow-sm">
            <div className="space-y-10">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Restro</p>
                <h1 className="mt-3 text-lg font-extrabold tracking-tight text-slate-900">POS control</h1>
              </div>
              <nav className="space-y-4">
                {internalNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.label}
                      to={item.path}
                      className={({ isActive }) =>
                        `group flex w-full flex-col items-center gap-2 rounded-[24px] px-3 py-4 text-center transition ${
                          isActive
                            ? 'border border-slate-200 bg-slate-50 text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-[11px] uppercase tracking-[0.32em] text-slate-500">{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
            <button type="button" className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </aside>

          {/* Mobile/Tablet Top Navigation */}
          <nav className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-around border-b border-slate-200 bg-white px-2 py-2 shadow-lg">
            {internalNav.slice(0, 5).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition ${
                      isActive
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] uppercase tracking-wide">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <main className="flex flex-col gap-4 md:gap-6 lg:col-span-1 pt-16 lg:pt-0 pb-0">
            <section className="rounded-[32px] bg-white p-4 md:p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <div className="flex-1 min-w-[150px]">
                    <div className="relative rounded-[28px] border border-slate-200 bg-slate-50 px-3 md:px-4 py-2 md:py-3">
                      <Search className="absolute left-3 md:left-4 top-1/2 h-4 w-4 md:h-5 md:w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        ref={searchInputRef}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search products..."
                        className="w-full bg-transparent pl-9 md:pl-12 text-xs md:text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={refreshData}
                      className="inline-flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                    >
                      <RotateCcw className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusMessage(isOnline ? 'Online and ready to sync with Firestore.' : 'Offline mode: local changes only.')}
                      className="inline-flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                    >
                      <Wifi className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableMenuOpen((current) => !current)}
                      className="hidden sm:inline-flex items-center gap-2 rounded-[28px] bg-slate-200 px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-semibold text-slate-900 shadow-lg shadow-slate-900/20 transition hover:bg-slate-300"
                    >
                      <GridIcon className="h-3 w-3 md:h-4 md:w-4" />
                      Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setCartSidebarOpen((current) => !current)}
                      className="md:hidden inline-flex items-center gap-2 rounded-[28px] bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
                    >
                      <ShoppingCart className="h-3 w-3" />
                      Cart ({activeBill?.items.length ?? 0})
                    </button>
                  </div>
                </div>

              {statusMessage ? (
                <div className="mt-2 md:mt-3 rounded-3xl border border-slate-200 bg-slate-50 px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-slate-900">
                  {statusMessage}
                </div>
              ) : null}

              {tableMenuOpen ? (
                <div className="mt-2 md:mt-3 grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-3 md:p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs md:text-sm text-slate-600">
                      Assign table
                      <select
                        value={tables.find((table) => table.name === activeBill?.table)?.id ?? ''}
                        onChange={(event) => selectTable(event.target.value)}
                        className="mt-1.5 w-full rounded-[20px] border border-slate-300 bg-white px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-slate-900 outline-none"
                      >
                        <option value="">Select a table</option>
                        {tables.map((table) => (
                          <option key={table.id} value={table.id}>
                            {table.name} • {table.section}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-[24px] border border-slate-300 bg-white p-3 md:p-4 text-xs md:text-sm text-slate-600">
                      <p className="font-semibold text-slate-900">Current table</p>
                      <p className="mt-1 md:mt-2">{activeBill?.table || 'Not assigned'}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              </div>
            </section>

            <section className="flex flex-wrap gap-1.5 md:gap-2">{categories.map((tab) => {
                const isActive = tab === activeCategory;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveCategory(tab)}
                    className={`rounded-full border px-2 md:px-3 py-1 md:py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'border-slate-200 bg-slate-50 text-slate-900 shadow-sm'
                        : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </section>

            <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {filteredProducts.length ? (
                filteredProducts.slice(0, 12).map((product) => (
                  <article key={product.id} className="rounded-[24px] border border-slate-200 bg-white p-2 sm:p-3 md:p-4 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                    <button type="button" onClick={() => handleAddItem(product)} className="flex h-full w-full flex-col items-center gap-1.5 sm:gap-2 md:gap-3 text-left">
                      <div className="flex h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 items-center justify-center rounded-full bg-slate-100 shadow-sm">
                        <img src={product.image} alt={product.name} className="h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-full object-cover" />
                      </div>
                      <div className="space-y-0.5 sm:space-y-1">
                        <p className="text-xs sm:text-sm md:text-sm font-semibold text-slate-900 line-clamp-2">{product.name}</p>
                        <p className="text-[10px] sm:text-xs text-slate-500">{product.category}</p>
                      </div>
                      <p className="mt-auto text-sm sm:text-base md:text-lg font-bold text-slate-900">{formatMVR(product.price)}</p>
                    </button>
                  </article>
                ))
              ) : (
                <div className="col-span-4 rounded-[32px] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
                  No menu items found. Add items in Menu Management to start taking orders.
                </div>
              )}
            </section>
          </main>

          {/* Right Cart Panel - Full width on mobile, side panel on lg, collapsible on md */}
          <aside className={`lg:col-span-1 flex flex-col gap-4 md:gap-6 rounded-[32px] border border-slate-200 bg-white p-4 md:p-5 shadow-sm fixed md:static top-16 lg:top-auto left-0 right-0 z-30 md:z-auto max-h-[calc(100vh-80px)] md:max-h-full overflow-y-auto md:overflow-visible transition-transform duration-300 ${
            cartSidebarOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'
          } lg:translate-y-0`}>
            <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-3 md:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={() => setCustomerPanelOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-[24px] border border-slate-200 bg-white px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Plus className="h-3 w-3 md:h-4 md:w-4 text-slate-900" />
                  Add Customer
                </button>
                <div className="flex items-center gap-1 md:gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomItemForm((current) => !current)}
                    className="inline-flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 text-xs md:text-sm"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={togglePaymentStatus}
                    className="inline-flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
                  </button>
                  <button
                    type="button"
                    onClick={focusSearch}
                    className="inline-flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <Search className="h-4 w-4 md:h-5 md:w-5" />
                  </button>
                </div>
              </div>

              {customerPanelOpen ? (
                <div className="mt-4 space-y-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="grid gap-3">
                    <label className="block text-sm text-slate-500">
                      Search customer
                      <select
                        value={activeBill?.customerId ?? ''}
                        onChange={(event) => assignCustomer(event.target.value)}
                        className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                      >
                        <option value="">Select or create customer</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name} • {customer.phone}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm text-slate-500">
                        Name
                        <input
                          value={newCustomer.name}
                          onChange={(event) => setNewCustomer((current) => ({ ...current, name: event.target.value }))}
                          className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                          placeholder="Customer name"
                        />
                      </label>
                      <label className="block text-sm text-slate-500">
                        Phone
                        <input
                          value={newCustomer.phone}
                          onChange={(event) => setNewCustomer((current) => ({ ...current, phone: event.target.value }))}
                          className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                          placeholder="+960 7XXXXXXX"
                        />
                      </label>
                    </div>
                    <label className="block text-sm text-slate-500">
                      Email
                      <input
                        value={newCustomer.email}
                        onChange={(event) => setNewCustomer((current) => ({ ...current, email: event.target.value }))}
                        className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                        placeholder="customer@example.com"
                      />
                    </label>
                    <label className="block text-sm text-slate-500">
                      Notes
                      <input
                        value={newCustomer.notes}
                        onChange={(event) => setNewCustomer((current) => ({ ...current, notes: event.target.value }))}
                        className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                        placeholder="Allergies or preferences"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={addCustomer}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[28px] bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-900/20 hover:bg-slate-300"
                    >
                      Add customer
                    </button>
                  </div>
                </div>
              ) : null}

              {showCustomItemForm ? (
                <div className="mt-4 space-y-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">Add custom item</h3>
                  <div className="grid gap-3">
                    <input
                      value={customItem.name}
                      onChange={(event) => setCustomItem((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Item name"
                      className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
                    />
                    <input
                      type="number"
                      min={0}
                      value={customItem.price}
                      onChange={(event) => setCustomItem((current) => ({ ...current, price: Number(event.target.value) }))}
                      placeholder="Price"
                      className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={addCustomItem}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[28px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-700"
                    >
                      Add custom item
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3 md:space-y-4 overflow-hidden rounded-[32px] border border-slate-200 bg-white p-3 md:p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 md:gap-3">
                <div>
                  <p className="text-xs md:text-sm font-semibold text-slate-900">Order summary</p>
                  <p className="text-xs md:text-sm text-slate-500">Review and manage items</p>
                </div>
                <span className="rounded-full bg-slate-50 px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{activeBill?.items.length ?? 0} items</span>
              </div>

              <div className="space-y-2 md:space-y-3 overflow-y-auto max-h-[200px] md:max-h-[320px] pr-1">
                {activeBill?.items.map((item, index) => {
                  const isActive = item.productId === activeBill.items[0]?.productId && item.id === activeBill.items[0]?.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setActiveBillId(activeBill.id)}
                      className={`cursor-pointer rounded-[28px] border p-2 md:p-4 ${isActive ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-center justify-between gap-2 md:gap-3">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-2xl bg-slate-100 text-xs md:text-sm font-semibold text-slate-700">{index + 1}</div>
                          <div className="min-w-0">
                            <p className="text-xs md:text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                            <p className="text-xs text-slate-500">{formatMVR(item.price * item.quantity)}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeItem(item.id)} className="rounded-full bg-slate-100 p-1.5 md:p-2 text-slate-600 hover:bg-slate-200 flex-shrink-0">
                          <X className="h-3 w-3 md:h-4 md:w-4" />
                        </button>
                      </div>

                      {isActive ? (
                        <div className="mt-3 md:mt-4 grid gap-2 md:gap-3 sm:grid-cols-2">
                          <label className="rounded-[24px] border border-slate-200 bg-white p-2 md:p-3 text-xs md:text-sm text-slate-500">
                            Quantity
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(event) => updateQuantity(item.id, Number(event.target.value))}
                              className="mt-1 md:mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-2 md:px-3 py-2 md:py-3 text-xs md:text-sm text-slate-900 outline-none"
                            />
                          </label>
                          <label className="rounded-[24px] border border-slate-200 bg-white p-2 md:p-3 text-xs md:text-sm text-slate-500">
                            Notes
                            <input
                              value={item.notes}
                              onChange={(event) => {
                                if (!activeBill) return;
                                updateBill({
                                  ...activeBill,
                                  items: activeBill.items.map((entry) =>
                                    entry.id === item.id ? { ...entry, notes: event.target.value } : entry,
                                  ),
                                });
                              }}
                              className="mt-1 md:mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-2 md:px-3 py-2 md:py-3 text-xs md:text-sm text-slate-900 outline-none"
                              placeholder="Item notes"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {!activeBill?.items.length ? (
                  <p className="text-xs md:text-sm text-slate-500">No items in this bill yet. Tap a menu item to add it to the order.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-3 md:p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-1.5 md:gap-3">
                {['Add', 'Discount', 'Coupon Code', 'Note'].map((action) => (
                  <button key={action} type="button" className="rounded-3xl border border-slate-200 bg-white px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100">
                    {action}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <div className="grid gap-2 md:gap-3">
                <div className="flex items-center justify-between text-xs md:text-sm text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatMVR(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs md:text-sm text-slate-500">
                  <span>Tax</span>
                  <span>{formatMVR(taxAmount)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 md:pt-4 text-lg md:text-xl font-semibold text-slate-900">
                  <span>Payable Amount</span>
                  <span>{formatMVR(payable)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-2 md:gap-3 sm:grid-cols-2">
              <button type="button" onClick={holdOrder} className="inline-flex items-center justify-center gap-2 rounded-[28px] bg-slate-200/10 px-4 md:px-5 py-3 md:py-4 text-xs md:text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-300/15">
                <Pause className="h-3 w-3 md:h-4 md:w-4" />
                Hold Order
              </button>
              <button type="button" onClick={saveCurrentBill} className="inline-flex items-center justify-center gap-2 rounded-[28px] bg-slate-900 px-4 md:px-5 py-3 md:py-4 text-xs md:text-sm font-semibold text-white shadow-lg hover:bg-slate-700">
                Save order
                <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
              </button>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
