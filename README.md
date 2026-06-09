# Personal Library Tracker

A personal library management web app with a public catalog and a private admin dashboard.

**Stack:** React (Vite + TypeScript) · Express · PostgreSQL (Railway) · Prisma

## Branches

| Branch | Contents |
|--------|----------|
| **`main`** | **Library tracker** — books, wishlist, authors/publishers, CSV import, stats dashboard, Goodreads tools, table sorting/column order, etc. |
| **`reading-tracking`** | Everything on `main` **plus** a full **reading tracker** (sessions, history, re-reads, daily/weekly/monthly/annual stats). Use this branch if you want reading tracking alongside the library. |

Deploy and run migrations for the branch you are on (`npx prisma migrate deploy` in `server/`).

## Project structure

```
├── client/     # React frontend (runs locally)
├── server/     # Express API + Prisma (runs locally, talks to Railway DB)
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

```powershell
cd server
npm install
npx prisma migrate deploy
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

## Implementation progress

| Step | Feature | Status |
|------|---------|--------|
| 1 | Monorepo scaffold + Prisma schema + health check | ✅ Done |
| 2 | Railway DB + migrate + admin seed | ✅ Done |
| 3 | Auth API (JWT login) + protected admin routes | ✅ Done |
| 4 | Books CRUD API + catalog UI | ✅ Done |
| 5 | Book add/edit form + CSV import | ✅ Done |
| 6 | Statistics dashboard | ✅ Done |
| 7 | Authors / publishers management + mobile admin nav | ✅ Done |
| 8 | To Purchase collection + public wishlist | ✅ Done |
| 9 | Admin grid/table views, inline table edit, pagination | ✅ Done |
| 10 | Goodreads cover fetch + Missing covers admin page | ✅ Done |
| 11 | Merge authors/publishers, optional wishlist author, add-to-library modal | ✅ Done |
| 12 | Books table: sortable columns + reorderable column layout | ✅ Done |
| 13 | Authors/Publishers: library vs wishlist tabs, sortable columns, book drill-down | ✅ Done |
| 14 | Dashboard **Total value** (sum of market prices); **Gift?** on books | ✅ Done |
| 15 | **Add from Goodreads** — fetch full book metadata by Id or URL | ✅ Done |
| 16 | **Reading tracker** (sessions, history, stats) | ✅ On `reading-tracking` branch only |
| 17 | Reading-only books, Goodreads add-to-read, session edit/delete, auto current page | ✅ On `reading-tracking` branch only |

See `LIBRARY_APP_SPEC.pdf` for the full specification.

### Admin highlights

- **Books** and **To Purchase** default to **grid view** (switch to **table** for inline editing, **sortable headers**, and **Columns** to reorder fields)
- **Add from Goodreads** (`/admin/from-goodreads`) — enter Book Id or URL; preview metadata; add to library or wishlist (description not saved to notes)
- **Missing covers** (`/admin/missing-covers`) — fetch covers from Goodreads when **Book Id** is set; bulk run shows a live timer and fetched count
- **Fetch cover** on the book form uses the same Goodreads Book Id field
- **Authors / Publishers** — **My library** / **To purchase** tabs; click a name or book count to see linked books; merge duplicates
- **Dashboard** — **Total value** KPI (sum of market prices); **Gift?** checkbox on books (form + table)
- **Reading** (`/admin/reading`) — on **`reading-tracking`** branch: log/edit/delete sessions, history, re-reads, period stats; track books not in library; add from Goodreads (`/admin/reading/from-goodreads`); current page = sum of logged pages

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/GENERAL.md](./docs/GENERAL.md) | Overview — architecture, concepts, how to run |
| [docs/DETAILED.md](./docs/DETAILED.md) | Full reference — every route, component, file, and future-edit cookbook |
| [docs/README.md](./docs/README.md) | Documentation index |

## Publishing to GitHub

This repo is set up so **secrets stay out of git**:

- `server/.env` and `client/.env` are in `.gitignore`
- Only `*.env.example` files are tracked (placeholders, no real passwords)
- See [SECURITY.md](./SECURITY.md) for the full checklist

### First-time git setup

```powershell
cd my-library
git init
git add .
git status
```

Verify `server/.env` does **not** appear under “Changes to be committed”. Then:

```powershell
git commit -m "Initial commit: personal library tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USER/my-library.git
git push -u origin main
```

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
