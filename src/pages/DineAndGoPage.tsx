import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, DollarSign, Calendar } from 'lucide-react';
import AppShell from '../components/AppShell';
import { hasFirebaseConfig } from '../lib/firebase';
import { loadDineAndGoCustomers, saveDineAndGoCustomer, deleteDineAndGoCustomer } from '../lib/firestore';
import { formatMVR } from '../lib/mvr';
import type { DineAndGoCustomer } from '../types/dineAndGo';

export default function DineAndGoPage() {
  const [customers, setCustomers] = useState<DineAndGoCustomer[]>([]);
  const [form, setForm] = useState<Partial<DineAndGoCustomer>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [chargeAmount, setChargeAmount] = useState<number>(0);
  const [chargingCustomerId, setChargingCustomerId] = useState<string | null>(null);

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

  const processWeeklyPayment = async (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    const updated: DineAndGoCustomer = {
      ...customer,
      runningTotal: 0,
      lastPaymentDate: new Date().toISOString().split('T')[0],
    };

    setCustomers((cur) => cur.map((c) => (c.id === customerId ? updated : c)));
    if (hasFirebaseConfig) {
      try {
        await saveDineAndGoCustomer(customerId, updated);
      } catch (error) {
        console.error('Failed to process payment:', error);
      }
    }
  };

  const totalOutstanding = useMemo(
    () => customers.reduce((sum, c) => sum + (c.runningTotal ?? 0), 0),
    [customers],
  );

  return (
    <AppShell title="Dine-and-Go">
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Avg. Balance</p>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {formatMVR(customers.length > 0 ? totalOutstanding / customers.length : 0)}
            </p>
            <p className="mt-3 text-sm text-slate-500">Per customer average</p>
          </div>
        </div>

        {/* Main Section */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Dine-and-Go Customers</h3>
              <p className="text-sm text-slate-500">View and manage customer accounts. Add charges and process weekly payments.</p>
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
                      <div className="flex items-center gap-4">
                        <div className="bg-white rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-500">Running Total</p>
                          <p className="text-lg font-bold text-slate-900">
                            {formatMVR(customer.runningTotal ?? 0)}
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
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setChargingCustomerId(customer.id!)}
                            className="rounded-lg bg-[#05093f] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900"
                          >
                            <DollarSign className="h-4 w-4 inline mr-1" /> Add Charge
                          </button>
                          <button
                            type="button"
                            onClick={() => processWeeklyPayment(customer.id!)}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                          >
                            <Calendar className="h-4 w-4 inline mr-1" /> Weekly Payment
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
      </div>
    </AppShell>
  );
}
