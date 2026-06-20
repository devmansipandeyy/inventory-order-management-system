import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { AppLayout } from "./components/AppLayout";
import { LoadingState } from "./components/ui";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { CustomersPage } from "./pages/CustomersPage";
import { PurchaseOrdersPage } from "./pages/PurchaseOrdersPage";
import { OrdersPage } from "./pages/OrdersPage";
import { AuditPage } from "./pages/AuditPage";
import { AssistantPage } from "./pages/AssistantPage";
import { ReorderPage } from "./pages/ReorderPage";
import { EvalsPage } from "./pages/EvalsPage";
import { PromptsPage } from "./pages/PromptsPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState label="Loading session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/reorder" element={<ReorderPage />} />
        <Route path="/evals" element={<EvalsPage />} />
        <Route path="/prompts" element={<PromptsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
