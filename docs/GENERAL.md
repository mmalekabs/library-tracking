# Personal Library Tracker — General documentation

## What this application is

A **personal library management system** with:

- A **public website** visitors can browse (owned books catalog + optional public wishlist)
- A **private admin area** where you manage books, authors, publishers, CSV imports, and statistics

You are the only admin user (username/password in environment variables). The database is **PostgreSQL on Railway**; your PC runs the API and frontend locally during development.

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

### Two book collections

Every book row has a boolean **`toPurchase`**:

| Collection | `toPurchase` | Admin page | Public page |
|------------|--------------|------------|-------------|
| **Library** (owned / reading list) | `false` | `/admin/books` | `/` (catalog) |
| **To purchase** (wishlist) | `true` | `/admin/to-purchase` | `/to-purchase` |
| **Reading-only** *(reading branch)* | `false` + `readingOnly: true` | Reading tracker only | *(not public)* |

A book is in **one** collection at a time (library vs wishlist). **Reading-only** books are a separate flag for titles tracked outside your owned library. **Add to library** on a wishlist item opens a modal (pages, author, publisher, market price required; purchase price optional), then moves the book to your library.

Wishlist books may be saved **without an author**; author is required when adding to the library or when saving a library book.

### Public visibility

**`isPubliclyVisible`** controls whether a book appears on the public site:

- Library books → public **catalog** (`/`)
- Wishlist books → public **wishlist** (`/to-purchase`)

Hidden books still appear in admin; they are not shown to visitors.

### Pricing (admin only)

`purchasePrice`, `marketPrice`, and computed **savings** are stored and shown in admin. Public API responses **omit** prices.

---

## Public site (visitor-facing)

| URL | Content |
|-----|---------|
| `/` | Searchable grid of public **library** books |
| `/books/:id` | One public library book |
| `/to-purchase` | Searchable grid of public **wishlist** books |
| `/to-purchase/:id` | One public wishlist book |
| `/admin/login` | Link from header; admin entry |

Header links: **Catalog**, **To Purchase**, **Admin**.

---

## Admin area (your dashboard)

Login at `/admin/login`. After login:

| Section | Purpose |
|---------|---------|
| **Dashboard** | Charts and KPIs (reading status, spending, **total value**, formats, etc.) |
| **Books** | Library collection — grid or **table** with inline edit, **sortable columns**, **column reorder** |
| **To Purchase** | Wishlist — same UI patterns as Books |
| **Authors** | **My library** / **To purchase** tabs; sortable columns; click name/count → books modal; **merge** duplicates; sticky toolbar |
| **Publishers** | Same as authors (including merge) |
| **Import CSV** | Bulk import (Goodreads-style CSV) |
| **From Bookmory** | Upload Bookmory Excel/CSV/JSON export → preview → merge |
| **From Goodreads** | Enter Book Id or URL → fetch metadata → add to library or wishlist (alternative to manual add / CSV) |
| **Missing info** | Books missing cover, ISBN-13, and/or market price; bulk fetch from Goodreads and عصير الكتب with live progress |
| **Reading** | *( **`reading-tracking` branch only** )* Sessions, history, re-reads, period stats; books not in library; Goodreads import |
| **Settings** | Change admin password |

**Books / To Purchase UI:**

- **Grid view** (default): cards with visibility / delete / **Add to library** (wishlist only)
- **Table view**: click column headers to **sort** (server-side); **Columns** button to **reorder** fields (saved in browser localStorage); includes **Goodreads Id**; click a cell to edit; click outside the table → confirmation modal if changed
- **Gift?** column — mark books received as gifts (also on book form under Pricing)
- Pagination: 10 / 25 / 50 / 75 / 100 rows per page

**Add to library (To Purchase):**

- Opens a modal: **pages**, **author**, **publisher**, and **market / actual price** (required); **purchase price** (optional)
- Saves metadata and sets `toPurchase: false`, `isPubliclyVisible: true`

**Authors / Publishers:**

- **My library** / **To purchase** tabs — lists and book counts reflect that collection only
- Click an **author/publisher name** or **book count** → modal listing their books in the current tab
- Sortable **Name** and **Books** column headers
- Select two or more rows → **Merge selected** → pick which name to keep; all linked books are reassigned
- Title, search, add, and merge controls stay **sticky** below the admin header while you scroll the list

**Add from Goodreads (library / wishlist):**

- `/admin/from-goodreads` — paste numeric **Book Id** or full `goodreads.com/book/show/…` URL
- Fetches title, author(s), cover, ISBN, pages, year, format/binding
- Description may appear in the preview only — it is **not** saved to book notes
- Preview then **Add to library** or **Add to purchase list**; warns if that Goodreads Id already exists (library or reading-only book)
- Third way to add books alongside manual form and CSV import

**Reading tracker** *( **`reading-tracking` branch only** )*:

- `/admin/reading` — tabs: **Reading now**, **History**, **Statistics**, **Time per book**
- Track books you **don’t own** (PDF, ebook, borrowed) via **`readingOnly`** books — excluded from **Books** catalog and public site
- **Start reading** — pick from library + reading-only books, add manually, or use **From Goodreads**
- `/admin/reading/from-goodreads` — fetch Goodreads metadata → **Continue to edit** → save (no description in notes)
- `/admin/reading/books/new` and `/admin/reading/books/:id/edit` — form for reading-only book metadata
- **Log session** — date, pages read, minutes, optional note; **current page** = sum of **pages read** across all sessions (capped at book length)
- **Sessions** — view, **edit**, or **delete** any logged session (Reading now + History)

**Missing info & Goodreads metadata:**

- On the book form, set **Goodreads Book Id** (`externalId`, same as CSV “Book Id”) and use **Fetch cover**
- **Missing info** (`/admin/missing-info`) lists books missing **cover**, **ISBN-13** (empty or invalid), and/or **market price**
  - **Fetch cover** / **Fetch ISBN-13** from Goodreads when Book Id is set
  - **Fetch price** from عصير الكتب by ISBN-13 (site list price × 0.9)
  - Bulk runs on the server with **streaming progress** (timer, count, current title)
- **Add from Goodreads** uses the same scraper stack but returns full metadata, not only the cover

**Import from Bookmory:**

- Map **`goodreadsID`** column → Goodreads Book Id
- Duplicate mode **Match existing — update Goodreads Id only** writes `externalId` only (no other fields or reading history)

**Dashboard pricing KPIs:**

- **Total spent** — sum of purchase prices
- **Total value** — sum of **market / actual prices** (books with a market price set)
- **Total savings** — where both prices exist

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
2. `cd server` → `npm install` → `npx prisma migrate deploy` → `npm run db:seed`
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

The project was built incrementally:

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
| 11 | Goodreads cover fetch (form + Missing info page with streaming bulk progress) |
| 12 | Merge authors/publishers; optional wishlist author; add-to-library modal; sticky entity toolbar |
| 13 | Books table: server-side sortable columns + client column reorder (Columns modal) |
| 14 | Authors/Publishers: collection tabs, sortable columns, clickable book lists |
| 15 | Dashboard total value KPI; **Gift?** (`isGift`) on books |
| 16 | Add from Goodreads page (full metadata fetch by Id/URL) |
| 17 | Reading tracker (sessions, history, re-reads, stats) — **`reading-tracking` branch** |
| 18 | Reading-only books (`readingOnly`), Goodreads add-to-read, session edit/delete, auto current page — **`reading-tracking` branch** |
| 19 | Import from Bookmory (preview before merge; goodreadsID column; Goodreads Id-only update mode) |
| 20 | Missing info (ISBN-13 + عصير الكتب market price); Goodreads Id books table column; admin rate-limit fix |

For file-level detail on any phase, see [DETAILED.md](./DETAILED.md).

### Branch note

- **`main`** — library management features (through phase 16 above).
- **`reading-tracking`** — same app plus the **Reading** admin section, `ReadingEntry` / `ReadingSession` tables, and `Book.readingOnly`. Merge or cherry-pick between branches as needed; run migrations after switching (including `20250529120000_book_reading_only` on the reading branch).

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
