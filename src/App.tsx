import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { InventoryProvider } from './context/InventoryContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import POSPage from './pages/POSPage';
import MenuManagement from './pages/MenuManagement';
import TableManagement from './pages/TableManagement';
import StaffManagement from './pages/StaffManagement';
import InventoryManagement from './pages/InventoryManagement';
import ExpensesPage from './pages/ExpensesPage';
import ReportsPage from './pages/ReportsPage';
import SmartAnalyticsPage from './pages/SmartAnalyticsPage';
import PurchaseProductsPage from './pages/PurchaseProductsPage';
import DirectPurchasePage from './pages/DirectPurchasePage';
import DailyDirectRevenuePage from './pages/DailyDirectRevenuePage';
import OutsourceItemsPage from './pages/OutsourceItemsPage';
import PurchaseHistoryPage from './pages/PurchaseHistoryPage';
import SuppliersPage from './pages/SuppliersPage';
import InventoryUpdatePage from './pages/InventoryUpdatePage';
import RecipeManagement from './pages/RecipeManagement';
import AssetManagement from './pages/AssetManagement';
import BillManagement from './pages/BillManagement';
import PendingBillsPage from './pages/PendingBillsPage';
import CompletedBillsPage from './pages/CompletedBillsPage';
import BillDetailsPage from './pages/BillDetailsPage';
import CustomersPage from './pages/CustomersPage';
import SettingsPage from './pages/SettingsPage';
import StockOnHandPage from './pages/StockOnHandPage';
import DineAndGoPage from './pages/DineAndGoPage';
import ProtectedRoute from './components/ProtectedRoute';
import ServiceWorkerNotifier from './components/ServiceWorkerNotifier';

function App() {
  return (
    <AuthProvider>
      <InventoryProvider>
        <BrowserRouter>
          <ServiceWorkerNotifier />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/menu"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <MenuManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tables"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <TableManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/staff"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StaffManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/inventory"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <InventoryManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/bills"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <BillManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bills/pending"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <PendingBillsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bills/completed"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <CompletedBillsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bills/:billId"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <BillDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/expenses"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ExpensesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/smart-analytics"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <SmartAnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/purchases"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PurchaseProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/direct-purchase"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DirectPurchasePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/outsource"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <OutsourceItemsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/suppliers"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <SuppliersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/daily-direct-revenue"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DailyDirectRevenuePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/purchase-history"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PurchaseHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/inventory-update"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <InventoryUpdatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/recipes"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <RecipeManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/assets"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AssetManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <POSPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <CustomersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock-on-hand"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <StockOnHandPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dine-and-go"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <DineAndGoPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </InventoryProvider>
    </AuthProvider>
  );
}

export default App;
