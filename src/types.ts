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
  productId?: string;
  productNumber?: string;
  name: string;
  quantity: number;
  unit: string;
  lowStock: number;
}

export interface MenuItem {
  id: string;
  menuItemId?: string;
  name: string;
  category: string;
  price: number;
  costPrice?: number;
  description: string;
  image: string;
  isSignature?: boolean;
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

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export interface RFQItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  vendor?: string;
  unitCost?: number;
}

export interface DirectPurchaseItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface DirectPurchase {
  id: string;
  shopName: string;
  items: DirectPurchaseItem[];
  gst: number;
  subtotal: number;
  total: number;
  date: string;
}

export interface CardPayment {
  id: string;
  type: string;
  amount: number;
}

export interface DailyDirectRevenue {
  id: string;
  date: string;
  closedBy: string;
  openingPettyCash?: number;
  closingPettyCash?: number;
  cashCounts: {
    fiftyLari: number;
    oneRf: number;
    twoRf: number;
    note5: number;
    note10: number;
    note20: number;
    note50: number;
    note100: number;
    note500: number;
    note1000: number;
  };
  cardPayments: CardPayment[];
  vikuraAmount?: number;
  purchasedFromCashDrawer?: number;
  cashTotal: number;
  cardTotal: number;
  totalDirectRevenue: number;
  createdAt: string;
}

export interface InventoryAdjustment {
  id: string;
  inventoryId: string;
  productName: string;
  previousQuantity: number;
  adjustedQuantity: number;
  newQuantity: number;
  reason: 'daily-count' | 'month-end' | 'physical-count' | 'damaged' | 'other';
  date: string;
  notes?: string;
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

export interface OutsourceItem {
  id: string;
  date: string;
  partyName: string;
  menuItemId: string;
  menuItemName: string;
  sellingPrice: number;
  costPerPortion: number;
  portions: number;
  totalCost: number;
  totalRevenue: number;
  profit: number;
  notes?: string;
  createdAt: string;
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
  customerId?: string;
  customerName?: string;
  orderType: 'Dine-in' | 'Takeaway' | 'Delivery';
  discount: number;
  tax: number;
  status: 'Pending' | 'Preparing' | 'Ready' | 'Served';
  notes: string;
  paymentMethod: 'Cash' | 'Card' | 'Bank transfer';
  paymentStatus: 'Unpaid' | 'Partial' | 'Paid';
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export interface AppSettings {
  id: string;
  restaurantName: string;
  currency: string;
  taxRate: number;
  receiptFooter: string;
  supportEmail: string;
}

export interface SalesSeries {
  day: string;
  amount: number;
}

export interface PaymentSeries {
  method: string;
  value: number;
}
