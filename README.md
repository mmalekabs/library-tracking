# Personal Library Tracker

A personal library management web app with a public catalog and a private admin dashboard.

**Stack:** React (Vite + TypeScript) · Express · PostgreSQL (Railway) · Prisma

## What this app tracks

Each book is either **in your library** (`toPurchase: false`) or on your **wishlist** (`toPurchase: true`). You can also mark any book **to sell** (`toSell: true`) for a separate admin list. There is no reading-status workflow, bookshelf tags, or reading-session tracking — only owned vs wishlist vs for-sale, plus catalog metadata (authors, prices, format, Goodreads Id, etc.).

## Project structure

```
├── client/     # React frontend (runs locally)
├── server/     # Express API + Prisma (runs locally, talks to Railway DB)
├── docs/       # GENERAL.md + DETAILED.md reference
├── .env.example
└── railway.toml
```

## Prerequisites

- Node.js 20+
- A [Railway](https://railway.app) account with a **PostgreSQL** service (no local Postgres install required)

## Database: Railway only (no local Postgres)

PostgreSQL lives on **Railway**. Your local machine runs the API and frontend only; Prisma connects to Railway over the internet using `DATABASE_URL`.

```
┌─────────────┐     DATABASE_URL      ┌──────────────────┐
│  Your PC    │ ────────────────────► │ Railway Postgres │
│  (Node/API) │                       │  (cloud)         │
└─────────────┘                       └──────────────────┘
```

### 1. Create Railway Postgres

1. [railway.app](https://railway.app) → **New Project**
2. **Add service** → **Database** → **PostgreSQL**

### 2. Two URLs — use the right one

| URL type | Host example | Use when |
|----------|--------------|----------|
| **Public** | `*.proxy.rlwy.net` | Local dev on your PC (`server/.env`) |
| **Private** | `postgres.railway.internal` | Railway **pre-deploy** / runtime only |

**Do not** put `postgres.railway.internal` in `server/.env` on your laptop — it will fail with “Can't reach database server”.

**Local `server/.env`:** Postgres service → **Connect** → **Public Network** → copy that URL.

### 3. Configure local env

```powershell
cd server
copy .env.example .env
```

Paste the **public** URL into `DATABASE_URL`.

### 4. Railway backend service settings

Create a service from this repo with **Root Directory = `server`**.

`server/railway.toml` is already configured:

| Phase | Command | DB access |
|-------|---------|-----------|
| **Build** | `prisma generate` + `npm run build` | No migrations (private net unavailable) |
| **Pre-deploy** | `prisma migrate deploy` | Yes — private network available |
| **Start** | `npm run start` | Yes |

In the backend service **Variables**, set:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

(Railway resolves the correct URL for that environment.)

**Remove** `prisma migrate deploy` from any custom **Build** command in the Railway dashboard if you added it there.

> Prisma is the database client — it still needs Postgres on Railway. You do **not** need Postgres installed on Windows.

### 5. Apply schema & seed (from your PC, via public URL)

Stop any running dev server first (avoids Windows `EPERM` when Prisma replaces the query engine DLL).

```powershell
cd server
npm install
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

### 6. Run API locally

```powershell
npm run dev
```

Health: http://localhost:3000/api/health

### 7. Run frontend locally

```powershell
cd ../client
npm install
npm run dev
```

App: http://localhost:5173 (proxies `/api` to your local server, which uses Railway DB)

## Admin login credentials

Use **`ADMIN_USERNAME`** and **`ADMIN_PASSWORD`** from `server/.env` — **not** the Postgres password inside `DATABASE_URL`.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection (Railway) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Web admin login only |

After you change `ADMIN_PASSWORD` in `.env`, sync it to the database:

```powershell
cd server
npm run db:seed
```

The seed upserts the admin user and **updates the password hash** to match your current `.env`.

## UI-only work (no database yet)

You can run the client before Railway is ready — the catalog page will show **API offline** until the server is up and `DATABASE_URL` is set. Full book data requires the steps above.

## Features (current)

| Area | What you get |
|------|----------------|
| **Collections** | Library (`/admin/books`), wishlist (`/admin/to-purchase`), **to sell** (`/admin/to-sell`); public catalog + public wishlist |
| **Books** | Full CRUD, grid/table views, inline table edit, sortable/reorderable columns, **grid sort** (price, pages, date) |
| **Export** | Download all books as **Excel** per collection (library, to purchase, to sell) |
| **Authors / publishers** | Library vs wishlist tabs, merge duplicates, book drill-down |
| **Import** | Goodreads-style CSV, Bookmory Excel/CSV/JSON, Add from Goodreads |
| **Tools** | Missing info (cover, ISBN-13, market price bulk fetch) |
| **Dashboard** | KPIs, library vs wishlist chart, spending, formats, timeline (`createdAt`) |
| **Pricing** | Purchase price, market price, **rounded integer savings** (purchase − market), **Gift?** flag, **Total value** KPI |

### Removed (no longer in this app)

- Reading tracker (sessions, history, goals, reading-only books)
- Reading status (`TO_READ`, `READING`, `READ`, …)
- Bookshelves / shelf tags
- `dateAdded`, `dateStartedReading`, `dateFinishedReading` on books

See `docs/GENERAL.md` for a full feature tour and `docs/DETAILED.md` for file-level reference.

### Admin highlights

- **Grouped sidebar** — collapsible sections (Main, Library, Catalog, Import, Tools, Settings)
- **Arabic-insensitive search** — catalog and admin search ignore tashkeel and hamza variants
- **Books**, **To Purchase**, and **To Sell** — grid (default) with **uniform card sizes** and **sort dropdown** (price, pages, date), or table with inline edit, column headers sort, column reorder
- **To Sell** — mark books via table **To sell?** column, grid **Mark to sell** button, or book form checkbox; books stay in library/wishlist lists
- **Download Excel** — export full library, wishlist, or to-sell list from each admin page
- **Public catalog / wishlist** — same `BookCard` grid layout as admin (consistent card height per row)
- **Add from Goodreads** — fetch metadata by Id or URL; add to library or wishlist
- **Missing info** — bulk Goodreads cover/ISBN + عصير الكتب market price
- **Import from Bookmory** — preview before merge; optional Goodreads Id-only duplicate update
- **Add to library** — modal on wishlist items (pages, author, publisher, market price required)

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/GENERAL.md](./docs/GENERAL.md) | Overview — architecture, concepts, how to run |
| [docs/DETAILED.md](./docs/DETAILED.md) | Full reference — routes, components, schema, cookbooks |
| [docs/README.md](./docs/README.md) | Documentation index |

## Publishing to GitHub

This repo is set up so **secrets stay out of git**:

- `server/.env` and `client/.env` are in `.gitignore`
- Only `*.env.example` files are tracked (placeholders, no real passwords)
- See [SECURITY.md](./SECURITY.md) for the full checklist

### Railway / production secrets

Configure these in the **Railway dashboard** (Variables), not in the repository:

| Variable | Service |
|----------|---------|
| `DATABASE_URL` | Backend (reference Postgres plugin) |
| `JWT_SECRET` | Backend |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Backend |
| `CLIENT_URL` | Backend (your public frontend URL) |
| `VITE_API_URL` | Frontend (**build time**; full URL e.g. `https://your-api.up.railway.app/api`) |

Frontend service: set **Root Directory** to `client`. Nixpacks serves the Vite build with Caddy (`client/railway.toml`) — do not use `vite preview` in production.

After deploy, run `npm run db:seed` once (or via Railway shell) so the admin password hash matches `ADMIN_PASSWORD`.
