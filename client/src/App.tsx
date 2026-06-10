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
import { BookmoryImportPage } from "@/pages/admin/BookmoryImportPage";
import { AuthorsPage } from "@/pages/admin/AuthorsPage";
import { PublishersPage } from "@/pages/admin/PublishersPage";
import { ToPurchasePage } from "@/pages/admin/ToPurchasePage";
import { MissingInfoPage } from "@/pages/admin/MissingInfoPage";
import { FromGoodreadsPage } from "@/pages/admin/FromGoodreadsPage";
import { RecentAdditionsPage } from "@/pages/admin/RecentAdditionsPage";

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
        <Route path="import/bookmory" element={<BookmoryImportPage />} />
        <Route path="recent-additions" element={<RecentAdditionsPage />} />
        <Route path="from-goodreads" element={<FromGoodreadsPage />} />
        <Route path="missing-info" element={<MissingInfoPage />} />
        <Route path="missing-covers" element={<MissingInfoPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
