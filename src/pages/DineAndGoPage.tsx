import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, DollarSign, Calendar, X, History, TrendingUp } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadDineAndGoCustomers, saveDineAndGoCustomer, deleteDineAndGoCustomer } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { DineAndGoCustomer, PaymentRecord } from '../types/dineAndGo';

export default function DineAndGoPage() {
  const [customers, setCustomers] = useState<DineAndGoCustomer[]>([]);
  const [form, setForm] = useState<Partial<DineAndGoCustomer>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [chargeAmount, setChargeAmount] = useState<number>(0);
  const [chargingCustomerId, setChargingCustomerId] = useState<string | null>(null);
  
  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('partial');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  
  // History modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    if (!hasFirebaseConfig) {
      setCustomers([]);
      return;
    }
    try {
      const data = await loadDineAndGoCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to load dine-and-go customers:', error);
    }
  };

  const saveCustomer = async () => {
    const payload: DineAndGoCustomer = {
      id: editingId ?? `dineandgo-${Date.now()}`,
      name: form.name?.trim() || '',
      table: form.table?.trim() || '',
      company: form.company?.trim() || '',
      runningTotal: form.runningTotal ?? 0,
      lastPaymentDate: form.lastPaymentDate || '',
      payments: form.payments || [],
      createdAt: form.createdAt || new Date().toISOString(),
    };

    if (editingId) {
      setCustomers((cur) => cur.map((c) => (c.id === payload.id ? payload : c)));
      setEditingId(null);
    } else {
      setCustomers((cur) => [payload, ...cur]);
    }

    if (hasFirebaseConfig) {
      try {
        await saveDineAndGoCustomer(payload.id!, payload);
      } catch (error) {
        console.error('Failed to save customer:', error);
      }
    }

    setForm({});
    setShowForm(false);
  };

  const editCustomer = (customer: DineAndGoCustomer) => {
    setEditingId(customer.id ?? null);
    setForm(customer);
    setShowForm(true);
  };

  const removeCustomer = async (id: string) => {
    setCustomers((cur) => cur.filter((c) => c.id !== id));
    if (hasFirebaseConfig) {
      try {
        await deleteDineAndGoCustomer(id);
      } catch (error) {
        console.error('Failed to delete customer:', error);
      }
    }
  };

  const addCharge = async (customerId: string) => {
    if (chargeAmount <= 0) return;
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    const updated: DineAndGoCustomer = {
      ...customer,
      runningTotal: (customer.runningTotal ?? 0) + chargeAmount,
    };

    setCustomers((cur) => cur.map((c) => (c.id === customerId ? updated : c)));
    if (hasFirebaseConfig) {
      try {
        await saveDineAndGoCustomer(customerId, updated);
      } catch (error) {
        console.error('Failed to add charge:', error);
      }
    }

    setChargeAmount(0);
    setChargingCustomerId(null);
  };

  const processPayment = async (customerId: string, amount: number, pType: 'full' | 'partial', notes: string = '') => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    const newBalance = Math.max(0, (customer.runningTotal ?? 0) - amount);
    const paymentRecord: PaymentRecord = {
      id: `payment-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      amount: amount,
      paymentType: pType,
      notes: notes || undefined,
    };

    const updated: DineAndGoCustomer = {
      ...customer,
      runningTotal: newBalance,
      lastPaymentDate: new Date().toISOString().split('T')[0],
      payments: [...(customer.payments || []), paymentRecord],
    };

    setCustomers((cur) => cur.map((c) => (c.id === customerId ? updated : c)));
    if (hasFirebaseConfig) {
      try {
        await saveDineAndGoCustomer(customerId, updated);
      } catch (error) {
        console.error('Failed to process payment:', error);
      }
    }

    // Reset payment modal
    setShowPaymentModal(false);
    setPaymentCustomerId(null);
    setPaymentAmount(0);
    setPaymentType('partial');
    setPaymentNotes('');
  };

  const totalOutstanding = useMemo(
    () => customers.reduce((sum, c) => sum + (c.runningTotal ?? 0), 0),
    [customers],
  );

  // Calculate payment statistics
  const getWeeklyStats = useMemo(() => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStart = weekAgo.toISOString().split('T')[0];

    let totalPaid = 0;
    let paymentCount = 0;

    customers.forEach((c) => {
      c.payments?.forEach((p) => {
        if (p.date >= weekStart) {
          totalPaid += p.amount;
          paymentCount += 1;
        }
      });
    });

    return { totalPaid, paymentCount };
  }, [customers]);

  const getMonthlyStats = useMemo(() => {
    const today = new Date();
    const monthAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    const monthStart = monthAgo.toISOString().split('T')[0];

    let totalPaid = 0;
    let paymentCount = 0;

    customers.forEach((c) => {
      c.payments?.forEach((p) => {
        if (p.date >= monthStart) {
          totalPaid += p.amount;
          paymentCount += 1;
        }
      });
    });

    return { totalPaid, paymentCount };
  }, [customers]);

  return (
    <AppShell title="Dine-and-Go">
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Total Customers</p>
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{customers.length}</p>
            <p className="mt-3 text-sm text-slate-500">Active dine-and-go customers</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Outstanding</p>
              <DollarSign className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatMVR(totalOutstanding)}</p>
            <p className="mt-3 text-sm text-slate-500">Total amount due</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Weekly Payments</p>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatMVR(getWeeklyStats.totalPaid)}</p>
            <p className="mt-3 text-sm text-slate-500">{getWeeklyStats.paymentCount} transactions</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Monthly Payments</p>
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatMVR(getMonthlyStats.totalPaid)}</p>
            <p className="mt-3 text-sm text-slate-500">{getMonthlyStats.paymentCount} transactions</p>
          </div>
        </div>


        {/* Main Section */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Dine-and-Go Customers</h3>
              <p className="text-sm text-slate-500">View and manage customer accounts. Add charges and process payments with full history tracking.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm(!showForm);
                setEditingId(null);
                setForm({});
              }}
              className="inline-flex items-center gap-2 rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'Add Customer'}
            </button>
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <div className="grid gap-4 mb-6 p-6 rounded-2xl bg-slate-50">
              <label className="block text-sm text-slate-700">
                Name
                <input
                  value={form.name || ''}
                  onChange={(e) => setForm((cur) => ({ ...cur, name: e.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                  placeholder="Customer name (optional)"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Table
                  <input
                    value={form.table || ''}
                    onChange={(e) => setForm((cur) => ({ ...cur, table: e.target.value }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                    placeholder="Table (optional)"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Company
                  <input
                    value={form.company || ''}
                    onChange={(e) => setForm((cur) => ({ ...cur, company: e.target.value }))}
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
                    placeholder="Company (optional)"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={saveCustomer}
                className="rounded-3xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-500"
              >
                {editingId ? 'Update' : 'Add'} Customer
              </button>
            </div>
          )}

          {/* Customers List */}
          <div className="space-y-4">
            {customers.length > 0 ? (
              customers.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-slate-300 transition"
                >
                  <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
                    <div className="grid gap-2 flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <h4 className="font-semibold text-slate-900">{customer.name || 'N/A'}</h4>
                          <div className="flex gap-4 text-sm text-slate-600">
                            {customer.table && <span>Table: {customer.table}</span>}
                            {customer.company && <span>Company: {customer.company}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="bg-white rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-500">Outstanding</p>
                          <p className={`text-lg font-bold ${(customer.runningTotal ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatMVR(customer.runningTotal ?? 0)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-500">Total Paid</p>
                          <p className="text-lg font-bold text-slate-900">
                            {formatMVR((customer.payments ?? []).reduce((sum, p) => sum + p.amount, 0))}
                          </p>
                        </div>
                        {customer.lastPaymentDate && (
                          <div className="bg-white rounded-lg px-3 py-2">
                            <p className="text-xs text-slate-500">Last Payment</p>
                            <p className="text-sm font-semibold text-slate-900">{customer.lastPaymentDate}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 sm:gap-1 w-full lg:w-auto lg:min-w-fit">
                      {/* Add Charge Section */}
                      {chargingCustomerId === customer.id ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={chargeAmount}
                            onChange={(e) => setChargeAmount(Number(e.target.value))}
                            className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            placeholder="Amount"
                          />
                          <button
                            type="button"
                            onClick={() => addCharge(customer.id!)}
                            className="rounded-lg bg-green-600 px-3 py-1 text-sm font-semibold text-white hover:bg-green-500"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setChargingCustomerId(null);
                              setChargeAmount(0);
                            }}
                            className="rounded-lg bg-slate-400 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setChargingCustomerId(customer.id!)}
                              className="flex-1 rounded-lg bg-[#05093f] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900"
                            >
                              <DollarSign className="h-4 w-4 inline mr-1" /> Add Charge
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentCustomerId(customer.id!);
                                setShowPaymentModal(true);
                              }}
                              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                            >
                              <Calendar className="h-4 w-4 inline mr-1" /> Payment
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryCustomerId(customer.id!);
                              setShowHistoryModal(true);
                            }}
                            className="rounded-lg bg-slate-500 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
                          >
                            <History className="h-4 w-4 inline mr-1" /> History
                          </button>
                        </div>
                      )}
                      {/* Edit/Delete for Admin */}
                      <div className="flex gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => editCustomer(customer)}
                          className="flex-1 rounded-lg bg-slate-400 px-2 py-1 text-white hover:bg-slate-500"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => customer.id && removeCustomer(customer.id)}
                          className="flex-1 rounded-lg bg-red-600 px-2 py-1 text-white hover:bg-red-500"
                        >
                          <Trash2 className="h-3 w-3 inline" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <p className="text-sm font-medium">No dine-and-go customers yet</p>
                <p className="text-xs">Add customers to start tracking dine-and-go accounts</p>
              </div>
            )}
          </div>
        </section>

        {/* Payment Modal */}
        {showPaymentModal && paymentCustomerId && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-lg max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Record Payment</h2>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentCustomerId(null);
                    setPaymentAmount(0);
                    setPaymentType('partial');
                    setPaymentNotes('');
                  }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Customer</p>
                <p className="text-lg font-semibold text-slate-900">
                  {customers.find((c) => c.id === paymentCustomerId)?.name || 'N/A'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Outstanding Amount</p>
                <p className="text-lg font-semibold text-red-600">
                  {formatMVR(customers.find((c) => c.id === paymentCustomerId)?.runningTotal ?? 0)}
                </p>
              </div>

              <label className="block text-sm text-slate-700">
                Payment Amount
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Math.max(0, Number(e.target.value)))}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 outline-none"
                  placeholder="0"
                  min="0"
                />
              </label>

              <label className="block text-sm text-slate-700">
                Payment Type
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setPaymentType('partial')}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      paymentType === 'partial'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    Partial
                  </button>
                  <button
                    onClick={() => setPaymentType('full')}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      paymentType === 'full'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    Full
                  </button>
                </div>
              </label>

              <label className="block text-sm text-slate-700">
                Notes (Optional)
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 outline-none"
                  placeholder="e.g., Weekly payment, Monthly settlement..."
                  rows={2}
                />
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentCustomerId(null);
                    setPaymentAmount(0);
                    setPaymentType('partial');
                    setPaymentNotes('');
                  }}
                  className="flex-1 rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (paymentAmount > 0) {
                      processPayment(paymentCustomerId, paymentAmount, paymentType, paymentNotes);
                    }
                  }}
                  disabled={paymentAmount <= 0}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment History Modal */}
        {showHistoryModal && historyCustomerId && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-xl font-semibold text-slate-900">Payment History</h2>
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setHistoryCustomerId(null);
                  }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-sm text-slate-500">Customer</p>
                <p className="text-2xl font-bold text-slate-900">
                  {customers.find((c) => c.id === historyCustomerId)?.name || 'N/A'}
                </p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div>
                    <p className="text-xs text-slate-500">Total Paid</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatMVR((customers.find((c) => c.id === historyCustomerId)?.payments ?? []).reduce((sum, p) => sum + p.amount, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Outstanding</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatMVR(customers.find((c) => c.id === historyCustomerId)?.runningTotal ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Weekly Stats */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Weekly (Last 7 days)</h3>
                {(() => {
                  const customer = customers.find((c) => c.id === historyCustomerId);
                  const today = new Date();
                  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                  const weekStart = weekAgo.toISOString().split('T')[0];
                  const weekPayments = (customer?.payments ?? []).filter((p) => p.date >= weekStart);
                  const weekTotal = weekPayments.reduce((sum, p) => sum + p.amount, 0);
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-700">{weekPayments.length} payments</span>
                      <span className="font-semibold text-blue-900">{formatMVR(weekTotal)}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Monthly Stats */}
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                <h3 className="text-sm font-semibold text-emerald-900 mb-2">Monthly (Last 30 days)</h3>
                {(() => {
                  const customer = customers.find((c) => c.id === historyCustomerId);
                  const today = new Date();
                  const monthAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
                  const monthStart = monthAgo.toISOString().split('T')[0];
                  const monthPayments = (customer?.payments ?? []).filter((p) => p.date >= monthStart);
                  const monthTotal = monthPayments.reduce((sum, p) => sum + p.amount, 0);
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-700">{monthPayments.length} payments</span>
                      <span className="font-semibold text-emerald-900">{formatMVR(monthTotal)}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Payment Records Table */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">All Payments</h3>
                <div className="space-y-2">
                  {(() => {
                    const customer = customers.find((c) => c.id === historyCustomerId);
                    const payments = [...(customer?.payments ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    return payments.length > 0 ? (
                      payments.map((payment) => (
                        <div key={payment.id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{payment.date}</p>
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                payment.paymentType === 'full'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {payment.paymentType === 'full' ? 'Full' : 'Partial'}
                              </span>
                            </div>
                            {payment.notes && <p className="text-xs text-slate-600 mt-1">{payment.notes}</p>}
                          </div>
                          <p className="font-semibold text-slate-900">{formatMVR(payment.amount)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">No payments recorded yet</p>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
