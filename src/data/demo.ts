import type { AppUser, Category, MenuItem, TableItem, StaffMember, InventoryItem, Expense, MonthlyExpense, SalesSeries, PaymentSeries, PurchaseOrder, Recipe, Asset } from '../types';

export const demoUsers: Array<AppUser & { password: string }> = [
  { id: 'loavashihub@gmail.com', name: 'Loavashi Admin', role: 'admin', email: 'loavashihub@gmail.com', password: 'Loavashi123' },
  { id: 'admin@loavashi.com', name: 'Loavashi Admin', role: 'admin', email: 'admin@loavashi.com', password: 'admin123' },
  { id: 'cashier@loavashi.com', name: 'Cashier User', role: 'cashier', email: 'cashier@loavashi.com', password: 'cashier123' },
];

export const demoCategories: Category[] = [
  { id: 'coffee', title: 'Coffee' },
  { id: 'tea', title: 'Tea' },
  { id: 'burger', title: 'Burger' },
  { id: 'pizza', title: 'Pizza' },
  { id: 'dessert', title: 'Dessert' },
  { id: 'juice', title: 'Juice' },
  { id: 'others', title: 'Others' },
];

export const demoProducts: MenuItem[] = [
  { id: 'latte', name: 'Café Latte', category: 'Coffee', price: 45, description: 'Silky smooth espresso with steamed milk.', image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=700&q=80' },
  { id: 'espresso', name: 'Espresso Shot', category: 'Coffee', price: 35, description: 'Bold single shot of espresso.', image: 'https://images.unsplash.com/photo-1510626176961-4f0a7a159d69?auto=format&fit=crop&w=700&q=80' },
  { id: 'green-tea', name: 'Green Tea', category: 'Tea', price: 25, description: 'Fresh brewed green tea.', image: 'https://images.unsplash.com/photo-1521120098174-4d9d0d4ec3c8?auto=format&fit=crop&w=700&q=80' },
  { id: 'classic-burger', name: 'Classic Burger', category: 'Burger', price: 95, description: 'Grilled beef burger with cheese and greens.', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=700&q=80' },
  { id: 'margherita', name: 'Margherita Pizza', category: 'Pizza', price: 180, description: 'Tomato, mozzarella and basil.', image: 'https://images.unsplash.com/photo-1548365328-1c20eacaefa7?auto=format&fit=crop&w=700&q=80' },
  { id: 'chocolate-cake', name: 'Chocolate Cake', category: 'Dessert', price: 65, description: 'Rich mousse cake with ganache.', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=80' },
  { id: 'orange-juice', name: 'Fresh Orange Juice', category: 'Juice', price: 40, description: 'Cold pressed orange juice.', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80' },
  { id: 'iced-coffee', name: 'Iced Coffee', category: 'Coffee', price: 55, description: 'Chilled espresso with milk and ice.', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=80' },
  { id: 'mint-tea', name: 'Mint Tea', category: 'Tea', price: 30, description: 'Refreshing mint infusion.', image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=700&q=80' },
  { id: 'club-sandwich', name: 'Club Sandwich', category: 'Others', price: 85, description: 'Triple-stack sandwich with salad.', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=700&q=80' },
  { id: 'berry-smoothie', name: 'Berry Smoothie', category: 'Juice', price: 50, description: 'Mixed berry refreshment.', image: 'https://images.unsplash.com/photo-1504208434309-cb69f4fe52b0?auto=format&fit=crop&w=700&q=80' },
  { id: 'cheese-pizza', name: 'Cheese Burst Pizza', category: 'Pizza', price: 210, description: 'Extra cheese with crispy crust.', image: 'https://images.unsplash.com/photo-1601924582975-3f3fe6f2c094?auto=format&fit=crop&w=700&q=80' },
];

export const demoTables: TableItem[] = [
  { id: 'table-1', name: 'Table 1', seats: 4, section: 'Indoor' },
  { id: 'table-2', name: 'Table 2', seats: 2, section: 'Indoor' },
  { id: 'table-3', name: 'Table 3', seats: 6, section: 'Outdoor' },
  { id: 'table-4', name: 'Table 4', seats: 4, section: 'Outdoor' },
  { id: 'table-5', name: 'VIP 1', seats: 8, section: 'VIP' },
  { id: 'table-6', name: 'VIP 2', seats: 6, section: 'VIP' },
];

export const demoStaff: StaffMember[] = [
  { id: 'staff-1', name: 'Aaliya Rasheed', passport: 'A1234567', designation: 'Manager', doj: '2023-02-15', salary: 12000, workPermit: 'WP-001', visaExpiry: '2025-08-01', medicalExpiry: '2025-01-20' },
  { id: 'staff-2', name: 'Ibrahim Mohamed', passport: 'B9876543', designation: 'Cashier', doj: '2024-01-10', salary: 6800, workPermit: 'WP-002', visaExpiry: '2025-04-02', medicalExpiry: '2025-03-10' },
  { id: 'staff-3', name: 'Mariam Hassan', passport: 'C4567890', designation: 'Chef', doj: '2022-11-08', salary: 15000, workPermit: 'WP-003', visaExpiry: '2025-12-15', medicalExpiry: '2024-12-11' },
];

export const demoInventory: InventoryItem[] = [
  { id: 'stock-1', name: 'Coffee Beans', quantity: 24, unit: 'kg', lowStock: 10 },
  { id: 'stock-2', name: 'Cheese Blocks', quantity: 15, unit: 'kg', lowStock: 8 },
  { id: 'stock-3', name: 'Tomato Sauce', quantity: 32, unit: 'L', lowStock: 12 },
  { id: 'stock-4', name: 'Milk', quantity: 50, unit: 'L', lowStock: 20 },
  { id: 'stock-5', name: 'Bread Buns', quantity: 40, unit: 'pcs', lowStock: 15 },
];

export const demoExpenses: Expense[] = [
  { id: 'exp-1', title: 'Daily Staff Snacks', amount: 1200, category: 'Daily expenses', paidBy: 'Daily sales', date: '2026-05-20' },
  { id: 'exp-2', title: 'Kitchen supplies', amount: 2400, category: 'Purchases', paidBy: 'Bank', date: '2026-05-19' },
  { id: 'exp-3', title: 'Utility payment', amount: 1800, category: 'Daily expenses', paidBy: 'Bank', date: '2026-05-18' },
];

export const demoMonthlyExpenses: MonthlyExpense[] = [
  { id: 'me-1', title: 'Rent', amount: 35000, category: 'Rent', dueMonth: 'May 2026' },
  { id: 'me-2', title: 'Salaries', amount: 92000, category: 'Salary', dueMonth: 'May 2026' },
  { id: 'me-3', title: 'Electricity', amount: 13200, category: 'Utility bills', dueMonth: 'May 2026' },
  { id: 'me-4', title: 'Visa costs', amount: 8000, category: 'Visa costs', dueMonth: 'May 2026' },
];

export const demoDailySales: SalesSeries[] = [
  { day: 'Mon', amount: 15200 },
  { day: 'Tue', amount: 17600 },
  { day: 'Wed', amount: 14900 },
  { day: 'Thu', amount: 18900 },
  { day: 'Fri', amount: 21400 },
  { day: 'Sat', amount: 23800 },
  { day: 'Sun', amount: 19800 },
];

export const demoMonthlySales: SalesSeries[] = [
  { day: 'Jan', amount: 128000 },
  { day: 'Feb', amount: 134000 },
  { day: 'Mar', amount: 142500 },
  { day: 'Apr', amount: 156800 },
  { day: 'May', amount: 169200 },
];

export const demoPaymentTypeBreakdown: PaymentSeries[] = [
  { method: 'Cash', value: 54 },
  { method: 'Card', value: 30 },
  { method: 'Bank transfer', value: 16 },
];

export const demoPurchases: PurchaseOrder[] = [
  { id: 'po-1', productName: 'Coffee Beans', vendor: 'Island Suppliers', quantity: 10, unit: 'kg', unitCost: 120, totalCost: 1200, status: 'Ordered', date: '2026-05-18' },
  { id: 'po-2', productName: 'Fresh Milk', vendor: 'Ocean Dairy', quantity: 20, unit: 'L', unitCost: 45, totalCost: 900, status: 'Received', date: '2026-05-19' },
];

export const demoRecipes: Recipe[] = [
  {
    id: 'recipe-1',
    name: 'Café Latte',
    salePrice: 45,
    status: 'Active',
    ingredients: [
      { inventoryId: 'stock-1', name: 'Coffee Beans', quantity: 0.2, unit: 'kg' },
      { inventoryId: 'stock-4', name: 'Milk', quantity: 0.25, unit: 'L' },
    ],
  },
  {
    id: 'recipe-2',
    name: 'Cheese Burger',
    salePrice: 95,
    status: 'Active',
    ingredients: [
      { inventoryId: 'stock-4', name: 'Milk', quantity: 0.1, unit: 'L' },
      { inventoryId: 'stock-5', name: 'Bread Buns', quantity: 1, unit: 'pcs' },
      { inventoryId: 'stock-2', name: 'Cheese Blocks', quantity: 0.15, unit: 'kg' },
    ],
  },
];

export const demoAssets: Asset[] = [
  { id: 'asset-1', name: 'Espresso Machine', category: 'Kitchen', value: 85000, purchaseDate: '2025-06-15', location: 'Main kitchen', status: 'Operational' },
  { id: 'asset-2', name: 'POS Tablet', category: 'Front desk', value: 24000, purchaseDate: '2025-11-01', location: 'Cashier counter', status: 'Operational' },
  { id: 'asset-3', name: 'Refrigerator', category: 'Kitchen', value: 45000, purchaseDate: '2024-09-20', location: 'Cold storage', status: 'Needs repair' },
];
