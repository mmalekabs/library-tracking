import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  Book,
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
  Users,
  Building2,
  Menu,
  X,
  ShoppingCart,
  ImageOff,
  BookMarked,
  BookPlus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/books", label: "Books", icon: Book, end: false },
  { to: "/admin/reading", label: "Reading", icon: BookMarked, end: false },
  { to: "/admin/to-purchase", label: "To Purchase", icon: ShoppingCart, end: false },
  { to: "/admin/authors", label: "Authors", icon: Users, end: false },
  { to: "/admin/publishers", label: "Publishers", icon: Building2, end: false },
  { to: "/admin/import", label: "Import", icon: Upload, end: false },
  { to: "/admin/from-goodreads", label: "From Goodreads", icon: BookPlus, end: false },
  { to: "/admin/missing-covers", label: "Missing covers", icon: ImageOff, end: false },
  { to: "/admin/settings", label: "Settings", icon: Settings, end: false },
];

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/books": "Books",
  "/admin/reading": "Reading",
  "/admin/to-purchase": "To Purchase",
  "/admin/authors": "Authors",
  "/admin/publishers": "Publishers",
  "/admin/import": "Import CSV",
  "/admin/from-goodreads": "Add from Goodreads",
  "/admin/missing-covers": "Missing covers",
  "/admin/settings": "Settings",
};

function SidebarNav({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { logout } = useAuth();

  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-200 p-4">
        <Link
          to="/"
          onClick={onNavigate}
          className="mb-2 block text-sm text-gray-600 hover:text-primary"
        >
          View public catalog
        </Link>
        <button
          type="button"
          onClick={() => {
            logout();
            window.location.href = "/admin/login";
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600"
        >
          <LogOut className="h-5 w-5" aria-hidden />
          Log out
        </button>
      </div>
    </>
  );
}

export function AdminLayout() {
  const { admin } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const basePath =
    Object.keys(pageTitles)
      .filter((p) => location.pathname.startsWith(p))
      .sort((a, b) => b.length - a.length)[0] ?? "/admin";

  const headerTitle =
    location.pathname.includes("/to-purchase/new")
      ? "Add to purchase"
      : location.pathname.includes("/books/new")
        ? "Add book"
        : location.pathname.includes("/edit")
          ? "Edit book"
          : (pageTitles[basePath] ?? "Admin");

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-5">
          <BookOpen className="h-6 w-6 text-primary" aria-hidden />
          <span className="font-bold text-gray-900">Admin</span>
        </div>
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={closeMobile}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" aria-hidden />
            <span className="font-bold text-gray-900">Admin</span>
          </div>
          <button
            type="button"
            onClick={closeMobile}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarNav onNavigate={closeMobile} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">{headerTitle}</h1>
          </div>
          {admin && (
            <span className="hidden text-sm text-gray-500 sm:inline">
              {admin.username}
            </span>
          )}
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
