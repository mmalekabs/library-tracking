# Personal Library Tracker — General documentation

## What this application is

A **personal library management system** with:

- A **public website** visitors can browse (owned books catalog + optional public wishlist)
- A **private admin area** where you manage books, authors, publishers, imports, and statistics

You are the only admin user (username/password in environment variables). The database is **PostgreSQL on Railway**; your PC runs the API and frontend locally during development.

**Scope (current):** library vs wishlist only. No reading-session tracker, no reading-status field, no bookshelf tags, no reading-date fields on books.

---

## High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│  ┌──────────────────────┐    ┌──────────────────────────────┐ │
│  │ Public site          │    │ Admin (/admin/*)              │ │
│  │ /  /books/:id        │    │ JWT in localStorage           │ │
│  │ /to-purchase         │    │ Dashboard, books, import…     │ │
│  └──────────┬───────────┘    └──────────────┬───────────────┘ │
└─────────────┼───────────────────────────────┼─────────────────┘
              │  HTTP /api/*                    │
              ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express API (server/) — port 3000                               │
│  Public routes (no login)  │  Admin routes (/api/admin/*)       │
└─────────────────────────────┼───────────────────────────────────┘
                              │ Prisma
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Railway)                                            │
└─────────────────────────────────────────────────────────────────┘
```

**Monorepo layout:**

| Folder | Role |
|--------|------|
| `client/` | React + Vite + TypeScript + Tailwind |
| `server/` | Express + Prisma + business logic |
| `docs/` | This documentation |
| `server/prisma/` | Database schema and migrations |

There is **no root `package.json`**. Install and run `client` and `server` separately.

---

## Main concepts

### Library vs wishlist vs to sell

**Owned vs wishlist** — boolean **`toPurchase`**:

| Collection | `toPurchase` | Admin page | Public page |
|------------|--------------|------------|-------------|
| **Library** (owned) | `false` | `/admin/books` | `/` (catalog) |
| **To purchase** (wishlist) | `true` | `/admin/to-purchase` | `/to-purchase` |

A book is in **one** of these at a time. **Add to library** on a wishlist item opens a modal (pages, author, publisher, market price required; purchase price optional), then sets `toPurchase: false`.

**To sell** — separate boolean **`toSell`** (orthogonal to library/wishlist):

| List | `toSell` | Admin page |
|------|----------|------------|
| **To sell** | `true` | `/admin/to-sell` |

A library book can also be marked for sale (`toSell: true`) and still appear under **Books**. Toggle from the table **To sell?** column, grid **Mark to sell** button, or the book form.

Wishlist books may be saved **without an author**; author is required when adding to the library or when saving a library book.

### Public visibility

**`isPubliclyVisible`** controls whether a book appears on the public site:

- Library books → public **catalog** (`/`)
- Wishlist books → public **wishlist** (`/to-purchase`)

Hidden books still appear in admin; they are not shown to visitors.

### Pricing (admin only)

`purchasePrice`, `marketPrice`, and computed **savings** (`purchasePrice − marketPrice`, **rounded to a whole number**) are stored and shown in admin — on the book form, grid cards, and dashboard KPIs. Public API responses **omit** prices.

### When a book was added

Use **`createdAt`** (record creation timestamp). There is no separate “date added” field.

---

## Public site (visitor-facing)

| URL | Content |
|-----|---------|
| `/` | Searchable grid of public **library** books — uniform card sizes (Arabic search ignores tashkeel and hamza variants) |
| `/books/:id` | One public library book |
| `/to-purchase` | Searchable grid of public **wishlist** books (same card layout as catalog) |
| `/to-purchase/:id` | One public wishlist book |
| `/admin/login` | Link from header; admin entry |

Header links: **Catalog**, **To Purchase**, **Admin**.

---

## Admin area (your dashboard)

Login at `/admin/login`. The sidebar uses **collapsible groups** (active group opens automatically):

| Group | Pages |
|-------|--------|
| **Main** | Dashboard |
| **Library** | Books, To Purchase, To Sell |
| **Catalog** | Authors, Publishers |
| **Import** | CSV import, From Bookmory, From Goodreads, Recent additions |
| **Tools** | Missing info |
| **Settings** | Change admin password |

**Search** (public catalog, admin books, authors, publishers, missing info) is **Arabic-insensitive**: tashkeel and hamza/alef variants are ignored so `رجلا` matches `رجلاً`.

| Section | Purpose |
|---------|---------|
| **Dashboard** | Charts and KPIs (library vs wishlist, spending, **total value**, formats, timeline by `createdAt`, etc.) |
| **Books** | Library collection — grid or **table** with inline edit, **sortable columns**, **column reorder** |
| **To Purchase** | Wishlist — same UI patterns as Books |
| **To Sell** | Books marked `toSell: true` — same grid/table UI; no separate “add” (mark from other lists) |
| **Authors** | **My library** / **To purchase** tabs; sortable columns; click name/count → books modal; **merge** duplicates |
| **Publishers** | Same as authors (including merge) |
| **Import CSV** | Bulk import (Goodreads-style CSV) |
| **From Bookmory** | Upload Bookmory Excel/CSV/JSON export → preview → merge into library or wishlist |
| **From Goodreads** | Enter Book Id or URL → fetch metadata → add to library or wishlist |
| **Missing info** | Books missing cover, ISBN-13, and/or market price; bulk fetch from Goodreads and عصير الكتب |
| **Recent additions** | Books sorted by `createdAt` |

**Books / To Purchase / To Sell UI:**

- **Grid view** (default): shared **`BookCard`** with **uniform height**; action buttons below each card (**Hide**, **Mark to sell** / **Remove from sell**, **Delete**; wishlist also has **Add to library**). **Sort** dropdown: date added, purchase price, page count (server-side).
- **Table view**: click column headers to **sort** (server-side); **Columns** button to **reorder** fields (saved in `localStorage`); includes **Goodreads Id**, **Gift?**, **To sell?**; click a cell to edit
- **Download Excel** — exports **all** books in the current collection (not just the visible page)
- Pagination: 10 / 25 / 50 / 75 / 100 rows per page

**Book form — Collection section:**

- **To purchase (wishlist)** — unchecked = in library
- **To sell** — appears on admin To Sell list when checked
- **Publicly visible** — catalog vs wishlist page depending on `toPurchase`

**Add to library (To Purchase):**

- Modal: **pages**, **author**, **publisher**, **market / actual price** (required); **purchase price** (optional)
- Sets `toPurchase: false`, `isPubliclyVisible: true`

**Add from Goodreads:**

- `/admin/from-goodreads` — paste numeric **Book Id** or full `goodreads.com/book/show/…` URL
- Preview then **Add to library** or **Add to purchase list**
- Description may appear in preview only — **not** saved to book notes

**Import from Bookmory:**

- Maps **`goodreadsID`** column → Goodreads Book Id
- Duplicate mode **Match existing — update Goodreads Id only** writes `externalId` only
- **`importAs`**: `library` or `to_purchase` (no reading-history import)

**Dashboard pricing KPIs:**

- **Total spent** — sum of purchase prices
- **Total value** — sum of **market / actual prices**
- **Total savings** — sum of per-book savings where both prices exist (rounded to whole SAR)
- **In library** / **To purchase** — counts from `toPurchase` flag

---

## Removed features

These existed in earlier experiments (including a short-lived `reading-tracking` git branch) but are **not** in the current app or schema:

| Removed | Notes |
|---------|-------|
| Reading tracker | Sessions, history, goals, reading-only books, `/admin/reading` |
| `ReadingStatus` | `TO_READ`, `READING`, `READ`, etc. |
| Bookshelves | `Bookshelf` model, shelf tags on books |
| Reading dates | `dateAdded`, `dateStartedReading`, `dateFinishedReading` |
| Public `/api/bookshelves` | Filter endpoint removed |

Migrations `20250602120000_remove_reading_tracker` and `20250603120000_simplify_book_collection` apply these removals. See DETAILED.md §3 and §18.

---

## Technology stack

| Layer | Technologies |
|-------|----------------|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS 3, React Router 7, TanStack Query, Recharts, Lucide icons |
| Backend | Express 5, TypeScript, Zod validation, JWT auth, bcrypt |
| Database | PostgreSQL, Prisma ORM |
| Hosting (intended) | Railway (Postgres + API service + optional static frontend) |

---

## Local development (summary)

1. Copy `server/.env.example` → `server/.env` and set **public** Railway `DATABASE_URL`, `JWT_SECRET`, admin credentials.
2. `cd server` → `npm install` → `npx prisma migrate deploy` → `npx prisma generate` → `npm run db:seed`
3. `npm run dev` (API on port **3000**)
4. `cd client` → `npm install` → `npm run dev` (UI on port **5173**, proxies `/api` to 3000)

Health check: `http://localhost:3000/api/health`

Full steps: [README.md](../README.md)

---

## Deployment (Railway)

Typical setup: **three services**

1. **PostgreSQL** plugin  
2. **Backend** — root directory `server`, uses `server/railway.toml` (migrate on pre-deploy, start Node)  
3. **Frontend** — root directory `client`; `npm run build` then `npm run start` (`serve -s dist`) via `client/railway.toml`  

Production must serve **`dist/`** (built `/assets/index-*.js`), not dev `index.html` with `/src/main.tsx`.

Secrets live in **Railway Variables**, not in git. See [SECURITY.md](../SECURITY.md).

---

## Implementation history (phases)

| Phase | Delivered |
|-------|-----------|
| 1 | Monorepo, Prisma schema, health endpoint |
| 2 | Railway Postgres, migrations, admin seed |
| 3 | JWT login, protected admin UI |
| 4 | Books CRUD, public catalog |
| 5 | Book form, CSV import |
| 6 | Statistics dashboard |
| 7 | Authors/publishers admin, mobile sidebar |
| 8 | To Purchase collection + public wishlist |
| 9 | Admin table view + inline edit + pagination |
| 10 | GitHub-ready secrets handling (`SECURITY.md`, `.gitignore`) |
| 11 | Goodreads cover fetch (form + Missing info with streaming bulk progress) |
| 12 | Merge authors/publishers; optional wishlist author; add-to-library modal |
| 13 | Books table: server-side sortable columns + client column reorder |
| 14 | Authors/Publishers: collection tabs, sortable columns, clickable book lists |
| 15 | Dashboard total value KPI; **Gift?** (`isGift`) on books |
| 16 | Add from Goodreads page (full metadata fetch by Id/URL) |
| 17 | Import from Bookmory (preview; goodreadsID column; Goodreads Id-only update mode) |
| 18 | Missing info (ISBN-13 + عصير الكتب market price); Goodreads Id books table column |
| 19 | Arabic-insensitive search; grouped collapsible admin sidebar |
| 20 | **Simplification** — removed reading tracker, reading status, bookshelves, reading dates; library vs wishlist only |
| 21 | **Rounded savings** (integer only, no decimals) + **uniform book cards** in public and admin grid views |
| 22 | **Excel export** — download library, to purchase, or to sell as `.xlsx` |
| 23 | **To Sell** list — `toSell` flag; table column + grid toggle + form checkbox |
| 24 | **Grid sort** dropdown — price, pages, date added (server-side) |

For file-level detail on any phase, see [DETAILED.md](./DETAILED.md).

---

## Security (important)

- **Never commit** `server/.env`
- Admin password is **not** the Postgres password; it is `ADMIN_PASSWORD` for web login only
- After changing `ADMIN_PASSWORD`, run `npm run db:seed` in `server/`
- **Known gap:** `/api/admin/*` routes do not enforce JWT on the server today; only the React app hides admin pages. For production hardening, add `requireAuth` to the admin router (described in DETAILED.md)

---

## Where to go next

- **Change a screen or button** → DETAILED.md → “Frontend pages” or “Components”  
- **Change API behavior** → DETAILED.md → “API reference” + “Services”  
- **Change database** → DETAILED.md → “Database” + “Migrations cookbook”  
- **Add a new admin page** → DETAILED.md → “Cookbook: add an admin page”  
