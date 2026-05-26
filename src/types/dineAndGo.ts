// Dine-and-Go customer record type
export type DineAndGoCustomer = {
  id?: string; // Firestore doc ID or local ID
  name?: string;
  table?: string;
  company?: string;
  runningTotal?: number;
  lastPaymentDate?: string; // ISO date string
};