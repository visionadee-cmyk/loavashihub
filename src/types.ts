export type UserRole = 'admin' | 'cashier';

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface Category {
  id: string;
  title: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice?: number;
  description: string;
  image: string;
}

export interface TableItem {
  id: string;
  name: string;
  seats: number;
  section: 'Indoor' | 'Outdoor' | 'VIP';
}

export interface StaffMember {
  id: string;
  name: string;
  passport: string;
  designation: string;
  doj: string;
  salary: number;
  workPermit: string;
  visaExpiry: string;
  medicalExpiry: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  lowStock: number;
}

export interface PurchaseOrder {
  id: string;
  productName: string;
  menuItemId?: string;
  vendor: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  status: 'Ordered' | 'Received' | 'Pending';
  date: string;
}

export interface RecipeIngredient {
  inventoryId: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  salePrice: number;
  status: 'Active' | 'Inactive';
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  value: number;
  purchaseDate: string;
  location: string;
  status: 'Operational' | 'Needs repair' | 'Disposed';
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  paidBy: string;
  receiptUrl?: string;
  date: string;
}

export interface MonthlyExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  dueMonth: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
}

export interface Bill {
  id: string;
  billNumber?: string;
  title: string;
  table: string;
  items: OrderItem[];
  orderType: 'Dine-in' | 'Takeaway' | 'Delivery';
  discount: number;
  tax: number;
  status: 'Pending' | 'Preparing' | 'Ready' | 'Served';
  notes: string;
  paymentMethod: 'Cash' | 'Card' | 'Bank transfer';
  paymentStatus: 'Unpaid' | 'Partial' | 'Paid';
  createdAt: string;
}

export interface SalesSeries {
  day: string;
  amount: number;
}

export interface PaymentSeries {
  method: string;
  value: number;
}
