import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import { formatMVR } from '../lib/mvr';
import { loadCollection, saveDocument, deleteDocument } from '../lib/firestore';
import type { Bill } from '../types';

export default function BillDetailsPage() {
  const { billId } = useParams();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<Bill['paymentMethod']>('Cash');
  const [cashTendered, setCashTendered] = useState(0);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!billId) {
      setLoading(false);
      return;
    }

    loadCollection<Bill>('bills', [])
      .then((items) => {
        const foundBill = items.find((item) => item.id === billId) ?? null;
        setBill(foundBill);
      })
      .catch((error) => {
        console.error('Failed to load bill details from Firestore:', error);
        setStatusMessage('Failed to load bill details.');
      })
      .finally(() => setLoading(false));
  }, [billId]);

  const subtotal = useMemo(
    () => bill?.items.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0,
    [bill],
  );

  const taxAmount = Math.round((subtotal * (bill?.tax ?? 0)) / 100);
  const discountAmount = Math.round((subtotal * (bill?.discount ?? 0)) / 100);
  const totalPayable = Math.max(0, subtotal + taxAmount - discountAmount);

  const printBill = () => {
    window.print();
  };

  const openPaymentDialog = () => {
    if (!bill) return;
    setSelectedPaymentMethod(bill.paymentMethod ?? 'Cash');
    setCashTendered(0);
    setPaymentError(null);
    setPaymentDialogOpen(true);
  };

  const completePayment = async () => {
    if (!bill) return;
    if (selectedPaymentMethod === 'Cash' && cashTendered < totalPayable) {
      setPaymentError('Cash tendered must cover the payable amount.');
      return;
    }

    const updatedBill: Bill = {
      ...bill,
      status: 'Served',
      paymentStatus: 'Paid',
      paymentMethod: selectedPaymentMethod,
    };

    setBill(updatedBill);
    setPaymentDialogOpen(false);
    setStatusMessage('Payment completed successfully.');

    try {
      await saveDocument('bills', updatedBill.id, updatedBill);
    } catch (error) {
      console.error('Failed to save paid bill:', error);
      setStatusMessage('Payment was recorded, but failed to save changes in Firestore.');
    }
  };

  const saveBillChanges = async () => {
    if (!bill) return;
    try {
      await saveDocument('bills', bill.id, bill);
      setStatusMessage('Bill changes saved.');
    } catch (error) {
      console.error('Failed to save bill changes:', error);
      setStatusMessage('Unable to save bill changes.');
    }
  };

  const markServed = async () => {
    if (!bill) return;
    const updatedBill = { ...bill, status: 'Served' as Bill['status'] };
    setBill(updatedBill);
    setStatusMessage('Bill marked as served.');
    try {
      await saveDocument('bills', updatedBill.id, updatedBill);
    } catch (error) {
      console.error('Failed to update bill status to served:', error);
      setStatusMessage('Unable to save served status.');
    }
  };

  const deleteBill = async () => {
    if (!bill) return;
    try {
      await deleteDocument('bills', bill.id);
      setStatusMessage('Bill deleted successfully.');
      navigate('/bills/pending');
    } catch (error) {
      console.error('Failed to delete bill:', error);
      setStatusMessage('Unable to delete bill.');
    }
  };

  return (
    <AppShell title={bill?.billNumber ? `Bill ${bill.billNumber}` : 'Bill details'}>
      <div className="mx-auto min-w-[1024px] max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <h1 className="text-2xl font-semibold text-slate-900">Bill details</h1>
              <p className="text-sm text-slate-500">Review the full invoice and print it from here.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={printBill}
                className="inline-flex items-center gap-2 rounded-[28px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-slate-700"
              >
                <Printer className="h-4 w-4" />
                Print bill
              </button>
              {bill ? (
                <button
                  type="button"
                  onClick={saveBillChanges}
                  className="inline-flex items-center gap-2 rounded-[28px] bg-[#7c4b2e] px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#6a4028]"
                >
                  Save changes
                </button>
              ) : null}
              {bill ? (
                <button
                  type="button"
                  onClick={deleteBill}
                  className="inline-flex items-center gap-2 rounded-[28px] bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-rose-500"
                >
                  Delete bill
                </button>
              ) : null}
              {bill && bill.status !== 'Served' && bill.paymentStatus !== 'Paid' ? (
                <button
                  type="button"
                  onClick={openPaymentDialog}
                  className="inline-flex items-center gap-2 rounded-[28px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-slate-700"
                >
                  Proceed to payment
                </button>
              ) : null}
              {bill && bill.status !== 'Served' && bill.paymentStatus === 'Paid' ? (
                <button
                  type="button"
                  onClick={markServed}
                  className="inline-flex items-center gap-2 rounded-[28px] bg-slate-200 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-slate-300"
                >
                  Mark served
                </button>
              ) : null}
            </div>
          </div>

          {statusMessage ? (
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              {statusMessage}
            </div>
          ) : null}

          {paymentDialogOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
              <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Complete payment</h2>
                    <p className="text-sm text-slate-500">Pay the bill and update its status.</p>
                  </div>
                  <button type="button" onClick={() => setPaymentDialogOpen(false)} className="rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <span className="text-sm font-semibold text-slate-700">Payment method</span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(['Cash', 'Card', 'Bank transfer'] as Bill['paymentMethod'][]).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            setSelectedPaymentMethod(method);
                            setPaymentError(null);
                          }}
                          className={`rounded-3xl border px-4 py-3 text-sm font-semibold transition ${
                            selectedPaymentMethod === method
                              ? 'border-slate-200 bg-slate-50 text-slate-900 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>Total payable</span>
                      <span className="font-semibold text-slate-900">{formatMVR(totalPayable)}</span>
                    </div>
                    {selectedPaymentMethod === 'Cash' ? (
                      <label className="block text-sm text-slate-500">
                        Cash received
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={cashTendered}
                          onChange={(event) => setCashTendered(Number(event.target.value))}
                          className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none"
                        />
                      </label>
                    ) : (
                      <p className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        The selected payment method will be recorded as {selectedPaymentMethod}.
                      </p>
                    )}
                    {paymentError ? <p className="text-sm text-slate-900">{paymentError}</p> : null}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setPaymentDialogOpen(false)}
                      className="rounded-[28px] border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={completePayment}
                      className="inline-flex items-center justify-center rounded-[28px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-slate-700"
                    >
                      Complete payment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
              {loading ? (
                <p className="text-slate-500">Loading bill details…</p>
              ) : !bill ? (
                <p className="text-slate-500">Bill not found. Please select another bill.</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Bill number</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{bill.billNumber ?? bill.title}</p>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Created</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{new Date(bill.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Table</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{bill.table}</p>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Order type</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{bill.orderType}</p>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Payment</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{bill.paymentMethod}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Payment status</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{bill.paymentStatus}</p>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{bill.status}</p>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Customer</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{bill.customerName ?? 'Walk-in'}</p>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Items</p>
                      <p className="text-sm text-slate-500">{bill.items.length} entries</p>
                    </div>
                    <div className="space-y-3">
                      {bill.items.map((item) => (
                        <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{item.name}</p>
                              <p className="text-sm text-slate-500">Qty {item.quantity} • {formatMVR(item.price)} each</p>
                            </div>
                            <p className="font-semibold text-slate-900">{formatMVR(item.price * item.quantity)}</p>
                          </div>
                          {item.notes ? <p className="mt-3 text-sm text-slate-500">Notes: {item.notes}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <aside className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Totals</p>
                <div className="mt-4 space-y-3 text-slate-700">
                  <div className="flex items-center justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatMVR(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Discount</span>
                    <span>{formatMVR(discountAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Tax</span>
                    <span>{formatMVR(taxAmount)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-4 text-lg font-semibold text-slate-900">
                    <span>Total due</span>
                    <span>{formatMVR(totalPayable)}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Notes</p>
                <p className="mt-2 text-slate-500">{bill?.notes || 'No additional notes.'}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">Edit bill details</h3>
                <div className="mt-4 space-y-4">
                  <label className="block text-sm text-slate-600">
                    Table
                    <input
                      value={bill?.table ?? ''}
                      onChange={(event) => bill && setBill({ ...bill, table: event.target.value })}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                    />
                  </label>
                  <label className="block text-sm text-slate-600">
                    Order type
                    <select
                      value={bill?.orderType ?? 'Dine-in'}
                      onChange={(event) => bill && setBill({ ...bill, orderType: event.target.value as Bill['orderType'] })}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                    >
                      <option value="Dine-in">Dine-in</option>
                      <option value="Takeaway">Takeaway</option>
                      <option value="Delivery">Delivery</option>
                    </select>
                  </label>
                  <label className="block text-sm text-slate-600">
                    Status
                    <select
                      value={bill?.status ?? 'Pending'}
                      onChange={(event) => bill && setBill({ ...bill, status: event.target.value as Bill['status'] })}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Preparing">Preparing</option>
                      <option value="Ready">Ready</option>
                      <option value="Served">Served</option>
                    </select>
                  </label>
                  <label className="block text-sm text-slate-600">
                    Payment status
                    <select
                      value={bill?.paymentStatus ?? 'Unpaid'}
                      onChange={(event) => bill && setBill({ ...bill, paymentStatus: event.target.value as Bill['paymentStatus'] })}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                    >
                      <option value="Unpaid">Unpaid</option>
                      <option value="Partial">Partial</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </label>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
