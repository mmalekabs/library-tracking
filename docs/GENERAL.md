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

A book is in **one** collection at a time. **Add to library** on a wishlist item sets `toPurchase: false` and moves it to Books.

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
| **Dashboard** | Charts and KPIs (reading, spending, formats, etc.) |
| **Books** | Library collection — grid or **table** with inline edit |
| **To Purchase** | Wishlist — same UI patterns as Books |
| **Authors** | Create/rename/delete authors |
| **Publishers** | Create/rename/delete publishers |
| **Import CSV** | Bulk import (Goodreads-style CSV) |
| **Settings** | Change admin password |

**Books / To Purchase UI:**

- **Table view** (default): click a cell to edit; click outside the table → confirmation modal if changed
- **Grid view**: cards with visibility / delete / add-to-library actions
- Pagination: 10 / 25 / 50 / 75 / 100 rows per page

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
3. **Frontend** — root directory `client`, static build  

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
