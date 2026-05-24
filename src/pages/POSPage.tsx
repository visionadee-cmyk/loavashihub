import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Grid as GridIcon,
  Home,
  Users2,
  Table,
  CreditCard,
  ShoppingCart,
  BarChart3,
  Settings,
  X,
  ArrowRight,
  Pause,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
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

const internalNav = [
  { path: '/pos', label: 'Home', icon: Home },
  { path: '/customers', label: 'Customers', icon: Users2 },
  { path: '/admin/tables', label: 'Tables', icon: Table },
  { path: '/bills/pending', label: 'Cashier', icon: CreditCard },
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
  const { user } = useAuth();
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
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>(defaultCustomer);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedTableForNewOrder, setSelectedTableForNewOrder] = useState<string>('');
  const [selectedPaxForNewOrder, setSelectedPaxForNewOrder] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Filter navigation based on user role
  const filteredInternalNav = useMemo(
    () => internalNav.filter((item) => {
      if (item.label === 'Tables' && user?.role !== 'admin') {
        return false;
      }
      return true;
    }),
    [user?.role]
  );

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

  const createNewOrder = async () => {
    if (!selectedTableForNewOrder) {
      setStatusMessage('Please select a table.');
      return;
    }

    if (selectedPaxForNewOrder < 1 || selectedPaxForNewOrder > 6) {
      setStatusMessage('Number of pax must be between 1 and 6.');
      return;
    }

    const selectedTable = tables.find((t) => t.id === selectedTableForNewOrder);
    if (!selectedTable) {
      setStatusMessage('Table not found.');
      return;
    }

    // Check if table is already occupied
    const tableOccupied = bills.some(
      (bill) => bill.table === selectedTable.name && bill.status !== 'Served'
    );

    if (tableOccupied) {
      setStatusMessage(`${selectedTable.name} is already occupied.`);
      return;
    }

    const newBill = createEmptyBill(selectedTable.name);
    newBill.notes = `Pax: ${selectedPaxForNewOrder}`;
    
    setBills((current) => [...current, newBill]);
    setActiveBillId(newBill.id);
    
    if (hasFirebaseConfig) {
      try {
        await saveDocument('bills', newBill.id, newBill);
      } catch (error) {
        console.error('Failed to create new bill in Firestore:', error);
        setStatusMessage('Order created locally but failed to persist to Firestore.');
      }
    }

    setShowNewOrderModal(false);
    setSelectedTableForNewOrder('');
    setSelectedPaxForNewOrder(1);
    setStatusMessage(`New order created for ${selectedTable.name} with ${selectedPaxForNewOrder} pax.`);
  };



  const subtotal = useMemo(
    () => activeBill?.items.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0,
    [activeBill],
  );

  const taxAmount = Math.round((subtotal * (activeBill?.tax ?? 5)) / 100);

  const availableTables = useMemo(
    () =>
      tables.filter(
        (table) =>
          !bills.some((bill) => bill.table === table.name && bill.status !== 'Served')
      ),
    [tables, bills]
  );

  const filteredProducts = useMemo(
    () =>
      products
        .filter((product) => (activeCategory === 'All' ? true : product.category === activeCategory))
        .filter((product) => product.name.toLowerCase().includes(search.toLowerCase())),
    [activeCategory, products, search],
  );

  return (
    <AppShell title="Restro POS">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 md:px-4 py-3 shadow-md">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-green-600">mPOS</h1>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 overflow-x-auto">
          {filteredInternalNav.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 rounded-2xl px-2 md:px-3 py-2 md:py-2 text-center whitespace-nowrap transition flex-shrink-0 border-2 ${
                    isActive
                      ? 'border-green-500 bg-green-50 text-green-900 font-semibold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                <Icon className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-[8px] md:text-[9px] uppercase tracking-widest font-semibold">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <div className="mx-auto w-full px-3 md:px-4 py-3 md:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-3 md:gap-4 min-h-[calc(100vh-280px)]">
          <main className="flex flex-col gap-3 md:gap-4">
            <section className="rounded-[28px] bg-white p-3 md:p-4 shadow-sm border border-slate-200">
              <div className="flex flex-col gap-2 md:gap-3">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <div className="flex-1 min-w-[150px]">
                    <div className="relative rounded-[24px] border border-slate-200 bg-slate-50 px-3 md:px-4 py-2 md:py-2">
                      <Search className="absolute left-3 md:left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        ref={searchInputRef}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Scan item..."
                        className="w-full bg-transparent pl-8 md:pl-10 text-xs md:text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewOrderModal(true)}
                    className="inline-flex items-center gap-2 rounded-[20px] bg-green-500 px-2 md:px-3 py-2 md:py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-green-600"
                  >
                    <GridIcon className="h-3 w-3 md:h-4 md:w-4" />
                    New Order
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableMenuOpen((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-[20px] bg-green-500 px-2 md:px-3 py-2 md:py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-green-600"
                  >
                    <GridIcon className="h-3 w-3 md:h-4 md:w-4" />
                    Scan
                  </button>
                </div>

                {statusMessage ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-3 md:px-4 py-2 md:py-2 text-xs text-slate-900">
                    {statusMessage}
                  </div>
                ) : null}

                {/* New Order Modal */}
                {showNewOrderModal ? (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="rounded-[28px] bg-white p-4 md:p-6 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h2 className="text-lg md:text-xl font-bold text-slate-900">Create New Order</h2>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewOrderModal(false);
                            setSelectedTableForNewOrder('');
                            setSelectedPaxForNewOrder(1);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-green-300 bg-green-500 text-white hover:bg-green-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Table Selection */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-900 mb-2">
                            Select Table ({availableTables.length} available)
                          </label>
                          {availableTables.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {availableTables.map((table) => (
                                <button
                                  key={table.id}
                                  type="button"
                                  onClick={() => setSelectedTableForNewOrder(table.id)}
                                  className={`rounded-[16px] border-2 p-3 text-center transition ${
                                    selectedTableForNewOrder === table.id
                                      ? 'border-green-500 bg-green-50'
                                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <p className="text-sm font-semibold text-slate-900">{table.name}</p>
                                  <p className="text-xs text-slate-500 mt-1">{table.section}</p>
                                  <p className="text-xs text-slate-500">Max: {table.seats} pax</p>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                              All tables are currently occupied.
                            </div>
                          )}
                        </div>

                        {/* Pax Selection */}
                        {selectedTableForNewOrder && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-900 mb-2">
                              Number of Pax (1-6)
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedPaxForNewOrder((p) => Math.max(1, p - 1))}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-green-300 bg-green-500 text-white hover:bg-green-600 font-semibold"
                              >
                                −
                              </button>
                              <div className="flex-1">
                                <select
                                  value={selectedPaxForNewOrder}
                                  onChange={(e) => setSelectedPaxForNewOrder(parseInt(e.target.value))}
                                  className="w-full rounded-[12px] border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-900 outline-none"
                                >
                                  {[1, 2, 3, 4, 5, 6].map((num) => (
                                    <option key={num} value={num}>
                                      {num} {num === 1 ? 'Person' : 'People'}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedPaxForNewOrder((p) => Math.min(6, p + 1))}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-green-300 bg-green-500 text-white hover:bg-green-600 font-semibold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Create Order Button */}
                        <button
                          type="button"
                          onClick={createNewOrder}
                          disabled={!selectedTableForNewOrder}
                          className={`w-full rounded-[16px] px-4 py-3 text-sm font-semibold text-white transition ${
                            selectedTableForNewOrder
                              ? 'bg-green-500 hover:bg-green-600 shadow-lg'
                              : 'bg-slate-300 cursor-not-allowed'
                          }`}
                        >
                          Create Order & Add Items
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {statusMessage ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-3 md:px-4 py-2 md:py-2 text-xs text-slate-900">
                    {statusMessage}
                  </div>
                ) : null}

                {tableMenuOpen ? (
                  <div className="grid gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2 md:p-3">
                    <label className="block text-xs text-slate-600">
                      Assign table
                      <select
                        value={tables.find((table) => table.name === activeBill?.table)?.id ?? ''}
                        onChange={(event) => selectTable(event.target.value)}
                        className="mt-1 w-full rounded-[18px] border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none"
                      >
                        <option value="">Select a table</option>
                        {tables.map((table) => (
                          <option key={table.id} value={table.id}>
                            {table.name} • {table.section}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-[20px] border border-slate-300 bg-white p-2 md:p-3 text-xs text-slate-600">
                      <p className="font-semibold text-slate-900">Current table</p>
                      <p className="mt-1">{activeBill?.table || 'Not assigned'}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            {/* Occupied Tables Section */}
            {bills.filter((bill) => bill.status !== 'Served').length > 0 && (
              <section className="rounded-[24px] border-2 border-red-400 bg-red-50 p-3 md:p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs md:text-sm font-bold text-red-600">🔴 OCCUPIED TABLES: {bills.filter((bill) => bill.status !== 'Served').length}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bills
                    .filter((bill) => bill.status !== 'Served')
                    .map((bill) => (
                      <button
                        key={bill.id}
                        type="button"
                        onClick={() => setActiveBillId(bill.id)}
                        className={`rounded-[16px] border-2 px-3 py-2 text-xs font-semibold transition ${
                          activeBillId === bill.id
                            ? 'border-green-700 bg-green-600 text-white shadow-md'
                            : 'border-red-400 bg-white text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {bill.table} {bill.items.length > 0 && `(${bill.items.length})`}
                      </button>
                    ))}
                </div>
              </section>
            )}

            <section className="flex flex-wrap gap-1.5 md:gap-2">{categories.map((tab) => {
                const isActive = tab === activeCategory;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveCategory(tab)}
                    className={`rounded-full border-2 px-3 py-2 text-xs font-bold transition ${
                      isActive
                        ? 'border-green-700 bg-green-600 text-white shadow-md'
                        : 'border-green-500 bg-green-500 text-white hover:bg-green-600 shadow-md'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </section>

            <section className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3 overflow-y-auto max-h-[calc(100vh-600px)]">
              {filteredProducts.length ? (
                filteredProducts.slice(0, 20).map((product) => (
                  <article key={product.id} className="rounded-[20px] border-2 border-green-400 bg-white p-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <button type="button" onClick={() => handleAddItem(product)} className="flex h-full w-full flex-col items-center gap-1 md:gap-2 text-center">
                      <div className="flex h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-slate-100">
                        <img src={product.image} alt={product.name} className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 rounded-full object-cover" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] md:text-xs font-semibold text-slate-900 line-clamp-1">{product.name}</p>
                        <p className="text-[8px] md:text-[10px] text-slate-500">{product.category}</p>
                      </div>
                      <p className="text-xs md:text-sm font-bold text-slate-900">{formatMVR(product.price)}</p>
                    </button>
                  </article>
                ))
              ) : (
                <div className="col-span-5 rounded-[24px] border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                  No menu items found.
                </div>
              )}
            </section>
          </main>

          {/* Right Order Panel */}
          <aside className="flex flex-col gap-3 md:gap-4 rounded-[24px] border border-slate-200 bg-white p-3 md:p-4 shadow-sm max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-2 md:p-3">
              <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomerPanelOpen((current) => !current)}
                    className="inline-flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg border-2 border-green-700 bg-green-600 text-white text-xs font-bold hover:bg-green-700 shadow-md"
                  >
                    +
                  </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={togglePaymentStatus}
                    className="inline-flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg border border-green-300 bg-green-500 text-white hover:bg-green-600"
                  >
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </button>
                </div>
              </div>

              {customerPanelOpen ? (
                <div className="mt-2 space-y-2 rounded-[16px] border border-slate-200 bg-white p-2">
                  <label className="block text-xs text-slate-500">
                    Customer
                    <select
                      value={activeBill?.customerId ?? ''}
                      onChange={(event) => assignCustomer(event.target.value)}
                      className="mt-1 w-full rounded-[12px] border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none"
                    >
                      <option value="">Select customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input
                    value={newCustomer.name}
                    onChange={(event) => setNewCustomer((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Name"
                    className="w-full rounded-[12px] border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={addCustomer}
                    className="w-full rounded-[12px] bg-green-500 px-2 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 rounded-[20px] border border-slate-200 bg-white p-2 md:p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-900">Order ({activeBill?.items.length ?? 0})</p>
              </div>
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {activeBill?.items.map((item) => (
                  <div key={item.id} className="rounded-[12px] border border-slate-200 bg-slate-50 p-1.5 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-500">{formatMVR(item.price * item.quantity)}</p>
                    </div>
                    <button type="button" onClick={() => removeItem(item.id)} className="ml-1 text-slate-400 hover:text-slate-600">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {!activeBill?.items.length && (
                  <p className="text-xs text-slate-500 py-4 text-center">No items</p>
                )}
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-2 md:p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold">{formatMVR(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Tax (5%)</span>
                <span className="font-semibold">{formatMVR(taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900">
                <span>Total</span>
                <span>{formatMVR(payable)}</span>
              </div>
            </div>

            <button type="button" onClick={saveCurrentBill} className="w-full rounded-[18px] bg-green-500 px-3 py-2 text-xs md:text-sm font-semibold text-white shadow-lg hover:bg-green-600">
              PAY {formatMVR(payable)}
            </button>
          </aside>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <nav className="sticky bottom-0 z-40 flex items-center gap-1 md:gap-2 border-t border-slate-200 bg-white px-2 md:px-3 py-2 md:py-3 shadow-lg overflow-x-auto">
        <button
          type="button"
          className="inline-flex h-10 md:h-12 min-w-fit items-center justify-center gap-1.5 rounded-[16px] bg-green-500 border-2 border-green-500 px-2 md:px-3 text-xs md:text-sm font-semibold text-white hover:bg-green-600 flex-shrink-0"
        >
          <GridIcon className="h-4 w-4" />
          Speed Key
        </button>
        <button
          type="button"
          className="inline-flex h-10 md:h-12 min-w-fit items-center justify-center gap-1.5 rounded-[16px] bg-green-500 border-2 border-green-500 px-2 md:px-3 text-xs md:text-sm font-semibold text-white hover:bg-green-600 flex-shrink-0"
        >
          Depts
        </button>
        <button
          type="button"
          className="inline-flex h-10 md:h-12 min-w-fit items-center justify-center gap-1.5 rounded-[16px] bg-green-500 border-2 border-green-500 px-2 md:px-3 text-xs md:text-sm font-semibold text-white hover:bg-green-600 flex-shrink-0"
        >
          <ShoppingCart className="h-4 w-4" />
          Orders
        </button>
        <button
          type="button"
          className="inline-flex h-10 md:h-12 min-w-fit items-center justify-center gap-1.5 rounded-[16px] bg-green-500 border-2 border-green-500 px-2 md:px-3 text-xs md:text-sm font-semibold text-white hover:bg-green-600 flex-shrink-0"
        >
          Table Orders
        </button>
        <button
          type="button"
          onClick={holdOrder}
          className="inline-flex h-10 md:h-12 min-w-fit items-center justify-center gap-1.5 rounded-[16px] bg-green-500 border-2 border-green-500 px-2 md:px-3 text-xs md:text-sm font-semibold text-white hover:bg-green-600 flex-shrink-0"
        >
          <Pause className="h-4 w-4" />
          Hold
        </button>
        <button
          type="button"
          className="inline-flex h-10 md:h-12 min-w-fit items-center justify-center gap-1.5 rounded-[16px] bg-green-500 border-2 border-green-500 px-2 md:px-3 text-xs md:text-sm font-semibold text-white hover:bg-green-600 flex-shrink-0"
        >
          Void
        </button>
        <button
          type="button"
          className="inline-flex h-10 md:h-12 min-w-fit items-center justify-center gap-1.5 rounded-[16px] bg-green-500 border-2 border-green-500 px-2 md:px-3 text-xs md:text-sm font-semibold text-white hover:bg-green-600 flex-shrink-0"
        >
          No Sales
        </button>
        <button
          type="button"
          className="inline-flex h-10 md:h-12 min-w-fit items-center justify-center gap-1.5 rounded-[16px] bg-green-500 border-2 border-green-500 px-2 md:px-3 text-xs md:text-sm font-semibold text-white hover:bg-green-600 flex-shrink-0"
        >
          Refund
        </button>
        <button
          type="button"
          className="inline-flex h-10 md:h-12 min-w-fit items-center justify-center gap-1.5 rounded-[16px] bg-green-500 border-2 border-green-500 px-2 md:px-3 text-xs md:text-sm font-semibold text-white hover:bg-green-600 flex-shrink-0"
        >
          Price Check
        </button>
        <button
          type="button"
          className="inline-flex h-10 md:h-12 min-w-fit items-center justify-center gap-1.5 rounded-[16px] bg-green-500 border-2 border-green-500 px-2 md:px-3 text-xs md:text-sm font-semibold text-white hover:bg-green-600 flex-shrink-0"
        >
          <ArrowRight className="h-4 w-4" />
          BACK
        </button>
      </nav>
    </AppShell>
  );
}
