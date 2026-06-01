# Loavashi Hub - Restaurant Management System

Loavashi Hub is a comprehensive, modern cafe and restaurant management system built with React, TypeScript, Vite, Tailwind CSS, Framer Motion, Firebase, and PWA support. Designed specifically for Maldivian restaurant workflows with MVR (Maldivian Rufiyaa) currency support.

## 🌟 Features

### Core Management
- **Admin and Cashier Login** - Role-based authentication with Firebase
- **Modern POS Billing System** - Tablet-friendly point of sale interface
- **Menu Management** - CRUD operations with image upload via Cloudinary
- **Table Management** - Floor plan setup with indoor, outdoor, and VIP sections
- **Staff Management** - Employee records with visa and work permit tracking
- **Inventory Management** - Real-time stock tracking with low-stock alerts
- **Expense Tracking** - Daily and monthly expense management
- **Reports & Analytics** - Comprehensive business analytics with Excel/PDF export

### Advanced Features
- **Recipe Management** - Create recipes with ingredient linking and automatic inventory deduction
- **Purchase Order Workflow** - RFQ system that automatically restocks inventory when orders are received
- **Direct Purchase** - Bypass RFQ for immediate purchases
- **Bill Management** - Save bills, mark as paid/complete, track open and completed invoices
- **Customer Database** - Customer information and order history
- **Asset Management** - Equipment tracking and maintenance status
- **Daily Revenue Tracking** - Cash counting and revenue reconciliation
- **Supplier Management** - Vendor information and contact details
- **Outsource Items** - Manage outsourced catering or party orders: select menu items, set cost per portion, record portions and party details; integrates into reports and daily revenue

### Technical Features
- **Role-based Protected Routes** - Role-aware navigation and access control
- **Installable PWA** - Progressive Web App with offline support
- **Service Worker** - Offline asset caching and background sync
- **Receipt Printing** - Auto-generated invoice numbers and cafe details
- **Real-time Sync** - Firebase Firestore for data persistence
- **Responsive Design** - Mobile-first approach with Tailwind CSS

## 🍽️ Maldivian Recipe Database

The system includes a comprehensive database of **144+ traditional Maldivian recipes**:

### Recipe Categories
- **Hedhikaa** (34 recipes) - Traditional Maldivian snacks like Bis Keemiya, Kulhi Boakibaa, Mas Roshi
- **Foni Hedhikaa** (30 recipes) - Sweet treats and desserts like Gabulhi Boakibaa, Dhonkeyo Kaju
- **Maldivian Curries** (30 recipes) - Traditional curries including Mas Riha, Kandu Kukulhu, Garudhiya
- **Chicken Recipes** (30 recipes) - Chicken dishes from classic curries to modern preparations
- **Beverages** (20 recipes) - Fresh juices, smoothies, and coffee drinks

### Ingredient Database
- **234+ ingredients** with detailed specifications
- Unit-based measurements (pcs, kg, g, ltr, ml, etc.)
- Automatic inventory tracking per recipe

## 🚀 Local Development

### Prerequisites
- Node.js 18+ and npm
- Firebase account (for full functionality)
- Cloudinary account (for image uploads)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/visionadee-cmyk/loavashihub.git
   cd loavashihub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   copy .env.example .env
   ```

4. **Add Firebase configuration** to `.env`:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

5. **Add Cloudinary configuration** (optional, for image uploads):
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
   VITE_CLOUDINARY_FOLDER=menu_items
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   ```
   http://localhost:5173
   ```

### Demo Accounts

- **Admin**: `loavashihub@gmail.com` / `Loavashi123`
- **Cashier**: `cashier@loavashi.com` / `cashier123`

## 🔥 Firebase Integration

### Firestore Security Rules

The app requires authenticated Firestore access. Deploy the included rules:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Database Collections

The app uses the following Firestore collections:
- `menuItems` - Restaurant menu items
- `inventory` - Stock and consumables
- `recipes` - Recipe definitions
- `bills` - Customer orders and invoices
- `tables` - Table configurations
- `staff` - Employee records
- `customers` - Customer database
- `expenses` - Daily expenses
- `monthlyExpenses` - Monthly expense planning
- `purchaseOrders` - Purchase order tracking
- `rfqItems` - Request for quotation items
- `directPurchases` - Direct purchase records
- `suppliers` - Supplier information
- `dailyDirectRevenue` - Daily revenue tracking
- `outsourceItems` - Outsourced/party orders and third-party catering costs
- `inventoryAdjustments` - Stock adjustment history
- `assets` - Equipment and assets
- `appSettings` - Application configuration

## 📱 PWA Support

The application includes full Progressive Web App capabilities:

- **Manifest** - `/manifest.json` for installability
- **Service Worker** - `/service-worker.js` for offline caching
- **Offline Support** - Works without internet connection
- **App Icon** - Uses `public/logo.jpeg` as PWA icon
- **Install Prompt** - Automatic update notifications

## 🏗️ Build and Deploy

### Production Build

```bash
npm run build
npm run preview  # Preview production build locally
```

### Vercel Deployment

This repository is Vercel-ready with included `vercel.json` configuration.

1. **Connect to Vercel**
   - Go to [Vercel](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables from `.env.example`

2. **Deploy Settings**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Automatic Deployments**
   - Every push to the main branch triggers automatic deployment
   - Preview deployments for pull requests

### GitHub Actions CI/CD

The repository includes `.github/workflows/ci.yml` for continuous integration:
- Validates build on every push
- Runs on pull requests
- Ensures code quality before deployment

## 📁 Project Structure

```
loavashihub/
├── public/                    # Static assets
│   ├── logo.jpeg             # Main logo and PWA icon
│   ├── manifest.json         # PWA manifest
│   ├── service-worker.js     # PWA service worker
│   └── *.svg                 # Various logo formats
├── src/
│   ├── components/           # Reusable React components
│   │   ├── AppShell.tsx      # Main layout with navigation
│   │   ├── ProtectedRoute.tsx # Route protection
│   │   └── ServiceWorkerNotifier.tsx # PWA updates
│   ├── context/              # React Context providers
│   │   ├── AuthContext.tsx   # Authentication state
│   │   └── InventoryContext.tsx # Inventory state
│   ├── data/                 # Recipe and product data
│   │   ├── hedhikaa.json     # Traditional snacks (34 recipes)
│   │   ├── fonihedhikaa.json # Desserts (30 recipes)
│   │   ├── maldiviacurries.json # Curries (30 recipes)
│   │   ├── chickenrecipes.json # Chicken dishes (30 recipes)
│   │   ├── beverages.json    # Drinks (20 recipes)
│   │   ├── productslist.json # Ingredient database (234 items)
│   │   └── demo.ts           # Sample analytics data
│   ├── lib/                  # Utility functions
│   │   ├── firebase.ts       # Firebase configuration
│   │   ├── firestore.ts      # Firestore operations
│   │   ├── cloudinary.ts     # Image upload utilities
│   │   ├── ids.ts            # ID generation
│   │   └── mvr.ts            # Currency formatting
│   ├── pages/                # Application pages
│   │   ├── AdminDashboard.tsx
│   │   ├── POSPage.tsx
│   │   ├── MenuManagement.tsx
│   │   ├── TableManagement.tsx
│   │   ├── StaffManagement.tsx
│   │   ├── InventoryManagement.tsx
│   │   ├── RecipeManagement.tsx
│   │   ├── ExpensesPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── PurchaseProductsPage.tsx
│   │   ├── DirectPurchasePage.tsx
│   │   ├── SuppliersPage.tsx
│   │   ├── AssetManagement.tsx
│   │   ├── BillManagement.tsx
│   │   ├── PendingBillsPage.tsx
│   │   ├── CompletedBillsPage.tsx
│   │   ├── BillDetailsPage.tsx
│   │   ├── CustomersPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── DailyDirectRevenuePage.tsx
│   │   ├── InventoryUpdatePage.tsx
│   │   └── LoginPage.tsx
│   ├── assets/               # Images and media
│   ├── types.ts              # TypeScript interfaces
│   ├── App.tsx               # Main application component
│   ├── main.tsx              # Application entry point
│   └── index.css             # Global styles
├── scripts/                  # Utility scripts
│   ├── seedFirestore.js      # Database seeding
│   ├── createFirebaseAuthUsers.js
│   ├── migrateMenuIds.js
│   └── migrateInventoryIds.js
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI
├── .env.example              # Environment variables template
├── firebase.json             # Firebase configuration
├── firestore.rules           # Firestore security rules
├── package.json              # Dependencies and scripts
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite configuration
├── vercel.json               # Vercel deployment config
└── README.md                 # This file
```

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS
- **Framer Motion** - Animation library
- **React Router** - Client-side routing
- **Lucide React** - Icon library
- **Recharts** - Charting library

### Backend & Services
- **Firebase Authentication** - User authentication
- **Firestore** - NoSQL database
- **Cloudinary** - Image hosting and CDN

### Development Tools
- **ESLint** - Code linting
- **TypeScript** - Static type checking
- **Vite** - Fast build tooling
- **PostCSS** - CSS processing

## 🎨 Design System

### Color Palette
- **Primary Navy**: `#05093f`
- **Primary Brown**: `#7c4b2e`
- **Brand White**: `#ffffff`
- **Accent colors** for alerts and status

### Typography
- **Font Family**: Inter, system-ui, sans-serif
- **Font Sizes**: Responsive scale with Tailwind
- **Line Heights**: Optimized for readability

### Components
- **Border Radius**: Rounded-3xl (2rem) for cards
- **Shadows**: Subtle shadows for depth
- **Spacing**: Consistent 4px grid system

## 📊 Key Metrics & Analytics

The Reports page provides comprehensive business intelligence:

- **Daily Revenue** - Today's sales total
- **Daily Expenses** - Today's costs
- **Transaction Count** - Number of orders
- **Average Transaction Value** - Revenue per order
- **POS Revenue** - Total point-of-sale income
- **Direct Revenue** - Income from direct sales
- **Total Expenses** - All costs combined
- **Profit Margin** - Net profit percentage
- **Monthly Trends** - Revenue over time
- **Payment Methods** - Cash vs card vs transfer
- **Top Products** - Best-selling items
- **Category Analysis** - Revenue by category

## 🔒 Security

- **Firebase Authentication** - Secure user management
- **Firestore Security Rules** - Database access control
- **Protected Routes** - Client-side route protection
- **Environment Variables** - Sensitive config protection
- **HTTPS** - Secure connections (via Vercel/Firebase)

## 📱 Mobile Support

- **Responsive Design** - Works on all screen sizes
- **PWA Installable** - Add to home screen
- **Touch Optimized** - Mobile-friendly interfaces
- **Offline Capable** - Works without internet

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary software developed for Loavashi Hub Cafe.

## 🆘 Support

For support and questions:
- Check the `USER_MANUAL.md` for user documentation
- Review the code comments for technical details
- Check Firebase and Vercel documentation for deployment issues

## 🗺️ Roadmap

- [ ] Multi-language support (Dhivehi/English)
- [ ] Advanced inventory forecasting
- [ ] Customer loyalty programs
- [ ] Kitchen display system
- [ ] Mobile app for managers
- [ ] Integration with delivery platforms
- [ ] Advanced reporting with AI insights

## 📝 Changelog

See `CHANGELOG.md` for version history and updates.

---

**Built with ❤️ for Maldivian restaurant workflows**