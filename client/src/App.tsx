import { Routes, Route } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CatalogPage } from "@/pages/public/CatalogPage";
import { PublicBookDetailPage } from "@/pages/public/PublicBookDetailPage";
import { ToPurchaseCatalogPage } from "@/pages/public/ToPurchaseCatalogPage";
import { PublicToPurchaseBookDetailPage } from "@/pages/public/PublicToPurchaseBookDetailPage";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { DashboardPage } from "@/pages/admin/DashboardPage";
import { SettingsPage } from "@/pages/admin/SettingsPage";
import { BooksManagePage } from "@/pages/admin/BooksManagePage";
import { BookFormPage } from "@/pages/admin/BookFormPage";
import { ImportPage } from "@/pages/admin/ImportPage";
import { AuthorsPage } from "@/pages/admin/AuthorsPage";
import { PublishersPage } from "@/pages/admin/PublishersPage";
import { ToPurchasePage } from "@/pages/admin/ToPurchasePage";
import { MissingCoversPage } from "@/pages/admin/MissingCoversPage";
import { ReadingPage } from "@/pages/admin/ReadingPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<CatalogPage />} />
        <Route path="books/:id" element={<PublicBookDetailPage />} />
        <Route path="to-purchase" element={<ToPurchaseCatalogPage />} />
        <Route path="to-purchase/:id" element={<PublicToPurchaseBookDetailPage />} />
      </Route>

      <Route path="/admin/login" element={<AdminLoginPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="books" element={<BooksManagePage />} />
        <Route path="books/new" element={<BookFormPage />} />
        <Route path="books/:id/edit" element={<BookFormPage />} />
        <Route path="to-purchase" element={<ToPurchasePage />} />
        <Route path="to-purchase/new" element={<BookFormPage />} />
        <Route path="to-purchase/:id/edit" element={<BookFormPage />} />
        <Route path="authors" element={<AuthorsPage />} />
        <Route path="publishers" element={<PublishersPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="missing-covers" element={<MissingCoversPage />} />
        <Route path="reading" element={<ReadingPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
