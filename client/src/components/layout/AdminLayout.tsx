import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ReadingTimerBar } from "@/components/reading/ReadingTimerBar";
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
  FileSpreadsheet,
  History,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    id: "main",
    label: "Main",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    ],
  },
  {
    id: "library",
    label: "Library",
    items: [
      { to: "/admin/books", label: "Books", icon: Book },
      { to: "/admin/reading", label: "Reading", icon: BookMarked, end: true },
      {
        to: "/admin/reading/from-goodreads",
        label: "Add to read",
        icon: BookPlus,
      },
      { to: "/admin/to-purchase", label: "To Purchase", icon: ShoppingCart },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    items: [
      { to: "/admin/authors", label: "Authors", icon: Users },
      { to: "/admin/publishers", label: "Publishers", icon: Building2 },
    ],
  },
  {
    id: "import",
    label: "Import",
    items: [
      { to: "/admin/import", label: "CSV import", icon: Upload },
      {
        to: "/admin/import/bookmory",
        label: "From Bookmory",
        icon: FileSpreadsheet,
      },
      {
        to: "/admin/from-goodreads",
        label: "From Goodreads",
        icon: BookPlus,
      },
      {
        to: "/admin/recent-additions",
        label: "Recent additions",
        icon: History,
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { to: "/admin/missing-info", label: "Missing info", icon: ImageOff },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [{ to: "/admin/settings", label: "Settings", icon: Settings }],
  },
];

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/books": "Books",
  "/admin/reading": "Reading",
  "/admin/reading/from-goodreads": "Add to read from Goodreads",
  "/admin/to-purchase": "To Purchase",
  "/admin/authors": "Authors",
  "/admin/publishers": "Publishers",
  "/admin/import": "Import CSV",
  "/admin/import/bookmory": "Import from Bookmory",
  "/admin/recent-additions": "Recent additions",
  "/admin/from-goodreads": "Add from Goodreads",
  "/admin/missing-info": "Missing info",
  "/admin/missing-covers": "Missing info",
  "/admin/settings": "Settings",
};

function groupContainsPath(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => {
    if (item.end) return pathname === item.to;
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  });
}

function SidebarNav({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { logout } = useAuth();
  const location = useLocation();
  const activeGroupId = useMemo(
    () =>
      navGroups.find((group) => groupContainsPath(group, location.pathname))
        ?.id ?? null,
    [location.pathname],
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeGroupId) return;
    setExpanded((prev) =>
      prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true },
    );
  }, [activeGroupId]);

  const toggleGroup = (groupId: string) => {
    setExpanded((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <>
      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        {navGroups.map((group) => {
          const isOpen = expanded[group.id] ?? group.id === activeGroupId;
          const groupActive = group.id === activeGroupId;

          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                  groupActive
                    ? "text-primary"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                aria-expanded={isOpen}
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isOpen ? "rotate-0" : "-rotate-90"
                  }`}
                  aria-hidden
                />
              </button>
              {isOpen && (
                <ul className="mt-1 space-y-0.5">
                  {group.items.map(({ to, label, icon: Icon, end }) => (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={end}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`
                        }
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden />
                        {label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
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
  const navigate = useNavigate();
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
        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-24">
          <Outlet />
        </main>
      </div>
      <ReadingTimerBar
        onStopAndLog={() => {
          navigate("/admin/reading");
        }}
      />
    </div>
  );
}
