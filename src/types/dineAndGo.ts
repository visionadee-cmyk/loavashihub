// Payment record type
export type PaymentRecord = {
  id?: string;
  date: string; // ISO date string
  amount: number;
  paymentType: 'full' | 'partial'; // Whether customer paid full outstanding or partial
  notes?: string;
};

// Dine-and-Go customer record type
export type DineAndGoCustomer = {
  id?: string; // Firestore doc ID or local ID
  name?: string;
  table?: string;
  company?: string;
  runningTotal?: number;
  lastPaymentDate?: string; // ISO date string
  payments?: PaymentRecord[]; // Payment history
  createdAt?: string; // When customer record was created
};