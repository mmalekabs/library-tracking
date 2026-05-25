import { Link, Outlet } from "react-router-dom";
import { BookOpen } from "lucide-react";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-primary">
            <BookOpen className="h-7 w-7" aria-hidden />
            <span className="text-xl font-bold text-gray-900">My Library</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              to="/"
              className="text-sm font-medium text-gray-600 hover:text-primary"
            >
              Catalog
            </Link>
            <Link
              to="/to-purchase"
              className="text-sm font-medium text-gray-600 hover:text-primary"
            >
              To Purchase
            </Link>
            <Link
              to="/admin/login"
              className="text-sm font-medium text-gray-600 hover:text-primary"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 bg-white py-6 text-center text-sm text-gray-500">
        Personal Library Tracker
      </footer>
    </div>
  );
}
