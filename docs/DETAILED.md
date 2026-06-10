# Personal Library Tracker — Detailed technical reference

This document is the **exhaustive** companion to [GENERAL.md](./GENERAL.md). It lists routes, files, data flows, and **exact places to edit** for future work.

**Current scope:** library vs wishlist (`toPurchase`) only. No reading tracker, `ReadingStatus`, bookshelves, or reading-date columns.

---

## Table of contents

1. [Repository file map](#1-repository-file-map)
2. [Environment variables](#2-environment-variables)
3. [Database schema](#3-database-schema)
4. [Authentication flow](#4-authentication-flow)
5. [Book collections and visibility rules](#5-book-collections-and-visibility-rules)
6. [API reference](#6-api-reference)
7. [Server architecture](#7-server-architecture)
8. [Frontend architecture](#8-frontend-architecture)
9. [Component responsibilities](#9-component-responsibilities)
10. [Page responsibilities](#10-page-responsibilities)
11. [Client libraries (`src/lib`)](#11-client-libraries-srclib)
12. [Constants and types](#12-constants-and-types)
13. [CSV import pipeline](#13-csv-import-pipeline)
14. [Statistics dashboard](#14-statistics-dashboard)
15. [Admin table inline editing](#15-admin-table-inline-editing)
16. [Build, scripts, and tooling](#16-build-scripts-and-tooling)
17. [Railway deployment](#17-railway-deployment)
18. [Migrations cookbook](#18-migrations-cookbook)
19. [Cookbook: common future edits](#19-cookbook-common-future-edits)
20. [Known limitations and recommended improvements](#20-known-limitations-and-recommended-improvements)
21. [Goodreads metadata and Missing info page](#21-goodreads-metadata-and-missing-info-page)
22. [Author/publisher merge and add-to-library flow](#22-authorpublisher-merge-and-add-to-library-flow)
23. [Books table sorting and column order](#23-books-table-sorting-and-column-order)
24. [Authors/publishers tabs and book drill-down](#24-authorspublishers-tabs-and-book-drill-down)
25. [Add from Goodreads](#25-add-from-goodreads)
26. [Gift field and Total value KPI](#26-gift-field-and-total-value-kpi)
27. [Import from Bookmory](#27-import-from-bookmory)
28. [Arabic-insensitive search](#28-arabic-insensitive-search)

---

## 1. Repository file map

### Root

| Path | Purpose |
|------|---------|
| `README.md` | Quick start, Railway DB, local dev commands |
| `SECURITY.md` | Secrets policy for public GitHub |
| `.env.example` | Points to `server/.env.example` |
| `.gitignore` | Excludes `.env`, `node_modules`, `dist/` |
| `.gitattributes` | LF line endings |
| `railway.toml` | Monorepo note for Railway service roots |
| `LIBRARY_APP_SPEC.pdf` | Original product specification (partially superseded) |
| `docs/` | This documentation |

### Server (`server/`)

| Path | Purpose |
|------|---------|
| `src/index.ts` | Express app bootstrap, middleware, route mounts |
| `src/lib/prisma.ts` | Singleton `PrismaClient` |
| `src/routes/auth.ts` | Login, me, change password |
| `src/routes/books.ts` | Public library catalog |
| `src/routes/toPurchase.ts` | Public wishlist catalog |
| `src/routes/authors.ts` | Public author filter list |
| `src/routes/publishers.ts` | Public publisher filter list |
| `src/routes/admin/index.ts` | Mounts all `/api/admin/*` sub-routers |
| `src/routes/admin/books.ts` | Admin book CRUD + bulk + visibility + missing info |
| `src/routes/admin/authors.ts` | Admin author CRUD + merge |
| `src/routes/admin/publishers.ts` | Admin publisher CRUD + merge |
| `src/routes/admin/lookup.ts` | Autocomplete for forms (authors, publishers) |
| `src/routes/admin/import.ts` | CSV preview + import |
| `src/routes/admin/stats.ts` | Dashboard stat endpoints |
| `src/routes/admin/goodreads.ts` | Goodreads cover + full book metadata fetch |
| `src/routes/admin/bookmoryImport.ts` | Bookmory preview + import |
| `src/routes/admin/aseeralkotb.ts` | عصير الكتب price lookup |
| `src/services/goodreadsService.ts` | Scrape Goodreads show page |
| `src/services/aseeralkotbService.ts` | Scrape عصير الكتب for market price |
| `src/services/entityListUtils.ts` | Shared entity list filters/sort |
| `src/services/bookService.ts` | Core book logic, serialization, filters |
| `src/services/authorService.ts` | Author CRUD + merge |
| `src/services/publisherService.ts` | Publisher CRUD + merge |
| `src/services/lookupService.ts` | Lightweight lists for pickers |
| `src/services/importService.ts` | CSV parsing + row import |
| `src/services/bookmoryImportService.ts` | Bookmory parse + import |
| `src/services/statsService.ts` | Aggregations for dashboard |
| `src/utils/bookmoryParse.ts` | Bookmory file parsing (preview fields only; no reading history stored) |
| `src/validators/book.ts` | Zod schemas for books |
| `src/validators/auth.ts` | Login / password schemas |
| `src/validators/entity.ts` | Author/publisher name schema |
| `src/validators/import.ts` | Import settings schema |
| `src/validators/bookmoryImport.ts` | Bookmory import settings |
| `src/validators/goodreads.ts` | Goodreads fetch query schema |
| `src/validators/validate.ts` | `validateBody` middleware factory |
| `src/validators/query.ts` | `validateQuery` middleware factory |
| `src/middleware/auth.ts` | `requireAuth` JWT check |
| `src/middleware/asyncHandler.ts` | Async error wrapper |
| `src/middleware/errorHandler.ts` | `AppError` + JSON errors |
| `src/middleware/rateLimiter.ts` | API + auth rate limits |
| `src/utils/jwt.ts` | Sign / verify JWT |
| `src/utils/book.ts` | `decimalToNumber`, `calculateSavings` (rounded integer savings) |
| `src/utils/arabicSearch.ts` | Arabic-insensitive search helpers |
| `src/utils/csvParse.ts` | CSV field keys + column auto-map |
| `src/utils/response.ts` | `sendSuccess`, `sendPaginated` |
| `src/utils/params.ts` | `paramId` helper |
| `prisma/schema.prisma` | Models and enums |
| `prisma/seed.ts` | Upsert admin user from env |
| `prisma/migrations/*` | SQL migrations (committed) |
| `railway.toml` | Build / pre-deploy migrate / healthcheck |
| `.env.example` | Documented env template |

### Client (`client/`)

| Path | Purpose |
|------|---------|
| `src/main.tsx` | React root, `QueryClientProvider`, `BrowserRouter` |
| `src/App.tsx` | All route definitions |
| `src/index.css` | Tailwind imports, CSS variables |
| `src/contexts/AuthContext.tsx` | Auth state, login/logout |
| `src/components/layout/PublicLayout.tsx` | Public header/footer |
| `src/components/layout/AdminLayout.tsx` | Admin sidebar + mobile drawer |
| `src/components/auth/ProtectedRoute.tsx` | Redirect if not logged in |
| `src/components/books/BookCard.tsx` | Shared catalog/admin grid card (uniform height, fixed cover ratio) |
| `src/components/admin/*` | Forms, tables, modals, pickers |
| `src/components/admin/bookTableColumns.ts` | Column order persistence (`localStorage`) |
| `src/components/admin/bookTableEdit.ts` | Inline table edit field mapping |
| `src/pages/public/*` | Catalog + wishlist pages |
| `src/pages/admin/*` | Admin screens |
| `src/lib/*` | API wrappers |
| `src/utils/formatElapsed.ts` | Timer display for bulk fetch progress |
| `src/utils/arabicSearch.ts` | Client-side Arabic normalize for pickers |
| `src/constants/*` | Enum labels, pagination, CSV fields |
| `src/types/index.ts` | Shared TS interfaces |
| `vite.config.ts` | `@/` alias, `/api` proxy |
| `tailwind.config.ts` | Theme (`primary` color, etc.) |

---

## 2. Environment variables

### Server (`server/.env`)

| Variable | Required | Used in | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | Prisma | **Local:** Railway **public** URL (`*.proxy.rlwy.net`). **Railway runtime:** `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | Yes | `index.ts`, `jwt.ts` | Long random string |
| `ADMIN_USERNAME` | Seed | `prisma/seed.ts` | Default `admin` |
| `ADMIN_PASSWORD` | Seed | `prisma/seed.ts` | Web login only; re-run seed after change |
| `NODE_ENV` | No | `prisma.ts` | `development` enables query logging |
| `PORT` | No | `index.ts` | Default `3000` |
| `CLIENT_URL` | No | CORS in `index.ts` | Default `http://localhost:5173` |

### Client (`client/.env` — optional)

| Variable | Required | Used in | Notes |
|----------|----------|---------|-------|
| `VITE_API_URL` | No | `api.ts`, `books.ts`, `import.ts` | e.g. `https://api.example.com/api`. If unset, uses `/api` (Vite proxy in dev) |

---

## 3. Database schema

**File:** `server/prisma/schema.prisma`

### Enums

| Enum | Values | Used for |
|------|--------|----------|
| `BookFormat` | `PHYSICAL`, `DIGITAL`, `AUDIO` | `Book.format` |
| `BindingType` | `PAPERBACK`, `HARDCOVER`, `MASS_MARKET_PAPERBACK`, `KINDLE_EDITION`, `UNKNOWN` | `Book.binding` |

### Models

#### `Admin`

| Field | Type | Notes |
|-------|------|-------|
| `id` | cuid | PK |
| `username` | string unique | Login name |
| `passwordHash` | string | bcrypt cost 12 |

#### `Author` / `Publisher`

| Field | Notes |
|-------|-------|
| `name` | unique |
| Relations | Books as primary/additional (authors) or publisher (publishers) |

#### `Book` (central entity)

| Field | Type | Notes |
|-------|------|-------|
| `externalId` | string? unique | Goodreads Book Id |
| `title` | string | Required |
| `isbn`, `isbn13` | string? | |
| `purchasePrice`, `marketPrice` | Decimal(10,2)? | Admin pricing |
| `currency` | string | Default `SAR` |
| `format`, `binding` | enums | |
| `numberOfPages`, `yearPublished`, `originalPublicationYear` | int? | |
| `edition` | string? | |
| `isPubliclyVisible` | boolean | Default `true` |
| `isGift` | boolean | Default `false` |
| `toPurchase` | boolean | Default `false` — **`true` = wishlist** |
| `coverImageUrl`, `notes` | string? | `notes` admin-only in API |
| `authorId` | FK? → Author | Nullable for wishlist books |
| `publisherId` | FK? → Publisher | |
| `createdAt`, `updatedAt` | DateTime | Use `createdAt` for “when added” |

**Indexes:** `title`, `format`, `isPubliclyVisible`, `toPurchase`, `authorId`, `publisherId`

#### Junction

- `BookAdditionalAuthor` — composite PK `(bookId, authorId)`

### Migrations (committed)

| Migration | Purpose |
|-----------|---------|
| `20250524120000_init` | Initial schema (included since-removed reading status + bookshelves) |
| `20250525120000_add_to_purchase` | `Book.toPurchase` + index |
| `20250526120000_optional_author` | Nullable `authorId` for wishlist |
| `20250528120000_book_is_gift` | `Book.isGift` |
| `20250527120000_reading_tracker` | *(historical)* Reading tables — removed later |
| `20250529120000_book_reading_only` | *(historical)* `readingOnly` — removed later |
| `20250530120000_reading_goals` | *(historical)* — removed later |
| `20250531120000_reading_book_management` | *(historical)* — removed later |
| `20250601120000_book_progress_modes` | *(historical)* — removed later |
| `20250602120000_remove_reading_tracker` | Drops reading tables/columns; deletes `readingOnly` books |
| `20250603120000_simplify_book_collection` | Drops bookshelves, `ReadingStatus`, status/date columns |

**Apply locally:** `cd server && npx prisma migrate deploy` (stop dev server first on Windows)  
**Apply on Railway:** `preDeployCommand` in `server/railway.toml`

---

## 4. Authentication flow

1. `POST /api/auth/login` → JWT + user
2. Token stored in `localStorage` key `auth_token`
3. `apiFetch` attaches `Authorization: Bearer <token>`
4. `ProtectedRoute` guards `/admin/*` UI
5. **Server admin routes do not use `requireAuth` today** — see §20

---

## 5. Book collections and visibility rules

**Logic:** `server/src/services/bookService.ts` → `buildWhereClause`, `getBookById`, `createBook`

### Admin list: `collection` query param

| `collection` | Filter | Admin page |
|--------------|--------|------------|
| `library` (default) | `toPurchase = false` | `/admin/books` |
| `to_purchase` | `toPurchase = true` | `/admin/to-purchase` |
| `all` | no `toPurchase` filter | — |

Optional `visibility`: `all` | `public` | `hidden`

Optional `createdFrom` / `createdTo` (YYYY-MM-DD) filter on `createdAt`.

### Public API

| Route | Visible books |
|-------|---------------|
| `GET /api/books` | `isPubliclyVisible: true`, `toPurchase: false` |
| `GET /api/to-purchase` | `isPubliclyVisible: true`, `toPurchase: true` |

### Move to library

`POST /api/admin/books/:id/move-to-library` with `moveToLibrarySchema` — sets `toPurchase: false`, requires author/pages/market price.

### Serialization (`serializeBook`)

| Option | Effect |
|--------|--------|
| `includePricing: false` | Omits prices (public) |
| `includePricing: true` | Includes prices + `savings` (integer: `Math.round(purchase − market)`) |
| `includeAdminFields: true` | Adds `isPubliclyVisible`, `toPurchase`, `notes` |

---

## 6. API reference

Base URL: `/api`. Responses: `{ success, data }` or paginated `{ data, pagination }`.

### Health & auth

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | No |
| POST | `/auth/login` | No |
| GET | `/auth/me` | JWT |
| POST | `/auth/change-password` | JWT |

### Public catalog

| Method | Path | Notes |
|--------|------|-------|
| GET | `/books` | Library, public visible |
| GET | `/books/:id` | Single library book |
| GET | `/to-purchase` | Wishlist, public visible |
| GET | `/to-purchase/:id` | Single wishlist book |
| GET | `/authors` | Authors with public library books |
| GET | `/publishers` | Publishers with public books |

### Admin books (`/api/admin/books`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Paginated list |
| POST | `/` | Create |
| GET | `/:id` | Detail |
| PUT | `/:id` | Update |
| DELETE | `/:id` | Hard delete |
| PATCH | `/:id/visibility` | Toggle public |
| PATCH | `/bulk-visibility` | Batch visibility |
| DELETE | `/bulk-delete` | Batch delete |
| GET | `/missing-info/summary` | Missing cover/ISBN/market counts |
| GET | `/missing-info` | Paginated missing-info list |
| POST | `/bulk-fetch-covers` | NDJSON stream |
| POST | `/bulk-fetch-isbn` | NDJSON stream |
| POST | `/bulk-fetch-market-price` | NDJSON stream |
| POST | `/:id/move-to-library` | Wishlist → library |

**List query** (`bookListQuerySchema`):

- `page`, `limit` (max 100)
- `search` — Arabic-insensitive
- `format`, `binding`, `authorId`, `publisherId`
- `minPrice`, `maxPrice`, `minPages`, `maxPages`, `yearFrom`, `yearTo`
- `sortBy`: `title`, `author`, `publisher`, `format`, `binding`, `purchasePrice`, `marketPrice`, `currency`, `numberOfPages`, `yearPublished`, `isbn`, `externalId`, `isPubliclyVisible`, `isGift`, **`createdAt`** (default)
- `sortOrder`: `asc` | `desc`
- `collection`: `library` | `to_purchase` | `all`
- `visibility`: `all` | `public` | `hidden`
- `createdFrom`, `createdTo`

### Admin lookup

| Method | Path |
|--------|------|
| GET | `/api/admin/lookup/authors` |
| GET | `/api/admin/lookup/publishers` |

### Admin import

| Method | Path |
|--------|------|
| POST | `/api/admin/import/preview` |
| POST | `/api/admin/import/csv` |

**Settings** (`importSettingsSchema`): `duplicateMode`, `defaultFormat`, `defaultToPurchase`, `defaultVisibility`, `columnMapping` — no `defaultStatus`.

### Admin stats (`/api/admin/stats`)

| Path | Purpose |
|------|---------|
| `/overview` | Totals, `libraryBooks`, `wishlistBooks`, **totalValue**, spending, formats |
| `/reading` | **Library vs wishlist** breakdown (name kept for URL stability) |
| `/spending` | Price aggregates over time |
| `/authors` | Author tables |
| `/publishers` | Publisher tables |
| `/formats` | Format distribution |
| `/timeline` | Books added per month (`createdAt`) |
| `/pages` | Page histogram, binding breakdown |
| `/lists` | Recently added, wishlist sample, incomplete metadata lists |

### Admin Goodreads

| Method | Path |
|--------|------|
| GET | `/api/admin/goodreads/cover/:bookId` |
| GET | `/api/admin/goodreads/book?input=` |

### Admin Bookmory

| Method | Path |
|--------|------|
| POST | `/api/admin/bookmory/preview` |
| POST | `/api/admin/bookmory/import` |

### Admin عصير الكتب

| Method | Path |
|--------|------|
| GET | `/api/admin/aseeralkotb/price/:isbn13` |

---

## 7. Server architecture

### Request lifecycle

```
HTTP → helmet, cors, json → rate limit → validate (Zod) → service → prisma → JSON
```

### `bookService.ts` key functions

| Function | Responsibility |
|----------|----------------|
| `serializeBook` | API-shaped JSON |
| `buildWhereClause` | Filters (collection, visibility, search, dates) |
| `listBooks` | Paginated findMany |
| `createBook` / `updateBook` | Resolve author/publisher by id or name |
| `moveBookToLibrary` | Wishlist → library |
| `bulkFetch*` | Goodreads / عصير الكتب bulk with NDJSON progress |

### Author/publisher resolution

- Primary author: `authorId` or `authorName` (upsert)
- Additional: `additionalAuthorIds` + `additionalAuthorNames`
- Publisher: `publisherId` or `publisherName` (nullable)

---

## 8. Frontend architecture

### Routing (`App.tsx`)

**Public:** `/`, `/books/:id`, `/to-purchase`, `/to-purchase/:id`

**Admin:** `ProtectedRoute` → `AdminLayout` → dashboard, books, to-purchase, authors, publishers, import, bookmory, from-goodreads, recent-additions, missing-info, settings

**No reading routes** — `/admin/reading` and related pages were removed.

### `BookFormPage` path detection

`location.pathname.includes("/to-purchase")` → wishlist mode (`defaultToPurchase`, back link).

### Book form — Collection section

Only **`toPurchase`** checkbox + **`isPubliclyVisible`**. No status, dates, or bookshelf picker.

---

## 9. Component responsibilities

### `AdminLayout.tsx` — `navGroups`

| Group | Items |
|-------|-------|
| Main | Dashboard |
| Library | Books, To Purchase |
| Catalog | Authors, Publishers |
| Import | CSV, Bookmory, Goodreads, Recent additions |
| Tools | Missing info |
| Settings | Settings |

### Key admin components

| Component | Role |
|-----------|------|
| `BookForm.tsx` | Create/edit; Collection = wishlist checkbox |
| `AdminBooksList.tsx` | Grid/table toggle, sort, pagination |
| `AdminBooksTable.tsx` | Inline edit table |
| `MoveToLibraryModal.tsx` | Wishlist → library |
| `EntityPicker` / `TagPicker` | Author, publisher, additional authors |
| `EntityManageTable.tsx` | Authors/publishers with merge |
| `EntityBooksModal.tsx` | Books for one author/publisher |

#### `BookCard.tsx` (public + admin grids)

Shared by `CatalogPage`, `ToPurchaseCatalogPage`, and `AdminBooksList` (grid mode).

| Behavior | Detail |
|----------|--------|
| Layout | `h-full` in a CSS grid with `items-stretch`; `min-h` on article; `aspect-[2/3]` cover |
| Text slots | `line-clamp` on title (2 lines) and author; reserved metadata footer so rows align |
| Admin extras | Purchase price + rounded savings badge; **Hidden** badge when not public |
| Savings display | `Math.round(book.savings)` — never shown with decimals |
| Admin list wrapper | `AdminBooksList` wraps card in `flex-1`; visibility/delete buttons below (`shrink-0`) |

**Edit card layout:** `client/src/components/books/BookCard.tsx` and grid classes on catalog/admin list pages.

---

## 10. Page responsibilities

| Page | Role |
|------|------|
| `DashboardPage.tsx` | Stats charts; library vs wishlist pie; KPIs |
| `BooksManagePage.tsx` | Library collection |
| `ToPurchasePage.tsx` | Wishlist collection |
| `BookFormPage.tsx` | Shared form for library + wishlist routes |
| `ImportPage.tsx` | CSV import (no default reading status) |
| `BookmoryImportPage.tsx` | Bookmory preview/import |
| `FromGoodreadsPage.tsx` | Goodreads metadata → library or wishlist |
| `MissingInfoPage.tsx` | Bulk metadata repair |
| `RecentAdditionsPage.tsx` | Sorted by `createdAt` |
| `AuthorsPage.tsx` / `PublishersPage.tsx` | Entity management |

---

## 11. Client libraries (`src/lib`)

| Module | Purpose |
|--------|---------|
| `api.ts` | `apiFetch`, `ApiError` |
| `books.ts` | Book CRUD, list params, bulk fetch streams |
| `stats.ts` | Dashboard fetchers + TS types |
| `import.ts` | CSV import |
| `bookmoryImport.ts` | Bookmory preview/import |
| `goodreads.ts` | Cover + book fetch |
| `lookup.ts` | Admin author/publisher autocomplete |
| `entities.ts` | Author/publisher admin lists |

**Removed:** `reading.ts`, `goodreadsDraft.ts`, `readingTimer.ts`

---

## 12. Constants and types

### `client/src/types/index.ts`

`Book` includes `toPurchase`, `isGift`, `createdAt` — **no** `status`, dates, `bookshelves`, `readingOnly`.

### `client/src/constants/book.ts`

`FORMAT_OPTIONS`, `BINDING_OPTIONS`, `CURRENCY_OPTIONS`, `CSV_FIELD_OPTIONS` — **no** `STATUS_OPTIONS`, `dateAdded`, `bookshelves`.

### `client/src/constants/stats.ts`

`FORMAT_COLORS`, `FORMAT_LABELS`, `CHART_COLORS` — `STATUS_*` constants unused by dashboard (library/wishlist uses inline colors in `DashboardPage.tsx`).

---

## 13. CSV import pipeline

1. Client maps columns via `columnMapping`
2. `POST /api/admin/import/csv` with file + settings JSON
3. `importService.importBooksFromCsv` → `bookService.createBook` per row

**Defaults:** `defaultToPurchase`, `defaultVisibility`, `defaultFormat`

**CSV fields:** title, author, prices, ISBN, publisher, binding, pages, years, externalId — see `CSV_FIELD_KEYS` in `csvParse.ts`.

---

## 14. Statistics dashboard

**Page:** `DashboardPage.tsx`  
**Service:** `statsService.ts`

| KPI / chart | Source |
|-------------|--------|
| Library / wishlist counts | `toPurchase` flag |
| Library vs wishlist pie | `GET /stats/reading` → `breakdown[]` with `key` `library` \| `wishlist` |
| Books added timeline | `createdAt` grouped by month |
| Total value | Sum of `marketPrice` |
| Total savings | Sum of rounded per-book savings (`Math.round` in `statsService.getOverview`) |
| Recently added list | `createdAt` |
| Wishlist quick list | `toPurchase: true` |

---

## 15. Admin table inline editing

**Editable fields:** `title`, `author`, `publisher`, `format`, `binding`, `purchasePrice`, `marketPrice`, `currency`, `numberOfPages`, `yearPublished`, `isbn`, `goodreadsId`, `isPubliclyVisible`, `isGift`

**Not in table:** `toPurchase` (use wishlist page or form), `notes`, `coverImageUrl`, `edition`, `isbn13`

**Removed from table:** `status`

---

## 16. Build, scripts, and tooling

### Server

| Script | Command |
|--------|---------|
| `dev` | `tsx watch src/index.ts` |
| `build` | `tsc` |
| `start` | `node dist/index.js` |
| `db:deploy` | `prisma migrate deploy` |
| `db:seed` | Upsert admin |

### Client

| Script | Command |
|--------|---------|
| `dev` | `vite` :5173 |
| `build` | `tsc -b && vite build` |

---

## 17. Railway deployment

See [README.md](../README.md) and `server/railway.toml`, `client/railway.toml`.

**Windows note:** Stop local `npm run dev` before `npx prisma generate` to avoid `EPERM` on `query_engine-windows.dll.node`.

---

## 18. Migrations cookbook

### After pulling schema changes

```powershell
cd server
# stop dev server first on Windows
npx prisma migrate deploy
npx prisma generate
```

### Add a new column

1. Edit `schema.prisma`
2. `npx prisma migrate dev --name describe_change`
3. Update validators, `bookService`, types, forms

---

## 19. Cookbook: common future edits

### Add a field to books

| Layer | File(s) |
|-------|---------|
| DB | `schema.prisma` + migration |
| Validation | `validators/book.ts` |
| Service | `bookService.ts` |
| Types | `client/src/types/index.ts` |
| Form | `BookForm.tsx` |
| Table | `bookTableEdit.ts`, `BOOK_TABLE_COLUMNS` |

### Add a new admin page

1. Page in `client/src/pages/admin/`
2. Route in `App.tsx`
3. Nav in `AdminLayout.tsx` (`navGroups`, `pageTitles`)
4. API under `server/src/routes/admin/`

---

## 20. Known limitations and recommended improvements

1. **Admin API not JWT-protected on server** — add `requireAuth` to `routes/admin/index.ts`
2. **Stats include all books** (library + wishlist + hidden) unless you add filters in `statsService.ts`
3. **Goodreads scraping** — brittle; may break if Goodreads changes HTML

---

## 21. Goodreads metadata and Missing info page

- `goodreadsService.ts` — fetch show page by Id or URL
- `MissingInfoPage.tsx` — bulk cover, ISBN-13, market price with NDJSON progress
- `aseeralkotbService.ts` — market price = list price × 0.9

---

## 22. Author/publisher merge and add-to-library flow

- `POST /api/admin/authors/merge`, `POST /api/admin/publishers/merge`
- `MoveToLibraryModal` → `moveBookToLibrary` API

---

## 23. Books table sorting and column order

- Server `sortBy` from `bookListQuerySchema`
- Client `BOOK_TABLE_SORT_BY` maps columns to API fields
- Column order in `localStorage` via `bookTableColumns.ts`

---

## 24. Authors/publishers tabs and book drill-down

`EntityManageTable` — `collection` tab filters book counts; `EntityBooksModal` lists books.

---

## 25. Add from Goodreads

`FromGoodreadsPage.tsx` → `GET /api/admin/goodreads/book` → create with `toPurchase: false` or `true`.

---

## 26. Gift field, savings rounding, and Total value KPI

- `Book.isGift` — form + table
- `statsService.getOverview().totalValue` — sum of `marketPrice`
- **Savings** — `server/src/utils/book.ts` → `calculateSavings()` returns `Math.round(purchasePrice − marketPrice)` or `null` if either price is missing
- **Book form** — live savings preview uses the same rounding (`BookForm.tsx`)
- **Dashboard** — `totalSavings` KPI displays as a whole number (no fractional SAR)

---

## 27. Import from Bookmory

**Settings** (`bookmoryImportSettingsSchema`):

- `duplicateMode`: `skip` | `overwrite` | `update_goodreads_id`
- `importAs`: `library` | `to_purchase`
- `isPubliclyVisible`, `allowMissingAuthor`

**Not imported:** reading sessions, reading status persistence, bookshelf tags.

**Preview** may still parse Bookmory status/dates for display context; only book metadata is stored.

**Route:** `/admin/import/bookmory`

---

## 28. Arabic-insensitive search

`server/src/utils/arabicSearch.ts` — used by book, author, publisher search.

`client/src/utils/arabicSearch.ts` — picker duplicate checks.

---

## Appendix A — Client route → file map

| Route | Component |
|-------|-----------|
| `/` | `CatalogPage.tsx` |
| `/books/:id` | `PublicBookDetailPage.tsx` |
| `/to-purchase` | `ToPurchaseCatalogPage.tsx` |
| `/to-purchase/:id` | `PublicToPurchaseBookDetailPage.tsx` |
| `/admin` | `DashboardPage.tsx` |
| `/admin/books` | `BooksManagePage.tsx` |
| `/admin/books/new`, `.../edit` | `BookFormPage.tsx` |
| `/admin/to-purchase` | `ToPurchasePage.tsx` |
| `/admin/to-purchase/new`, `.../edit` | `BookFormPage.tsx` |
| `/admin/authors` | `AuthorsPage.tsx` |
| `/admin/publishers` | `PublishersPage.tsx` |
| `/admin/import` | `ImportPage.tsx` |
| `/admin/import/bookmory` | `BookmoryImportPage.tsx` |
| `/admin/from-goodreads` | `FromGoodreadsPage.tsx` |
| `/admin/missing-info` | `MissingInfoPage.tsx` |
| `/admin/recent-additions` | `RecentAdditionsPage.tsx` |
| `/admin/settings` | `SettingsPage.tsx` |
| `/admin/login` | `AdminLoginPage.tsx` |

---

## Appendix B — Server route → file map

| Path prefix | File |
|-------------|------|
| `/api/health` | `index.ts` |
| `/api/auth/*` | `routes/auth.ts` |
| `/api/books` | `routes/books.ts` |
| `/api/to-purchase` | `routes/toPurchase.ts` |
| `/api/authors`, `/api/publishers` | `routes/authors.ts`, `publishers.ts` |
| `/api/admin/books/*` | `routes/admin/books.ts` |
| `/api/admin/authors/*` | `routes/admin/authors.ts` |
| `/api/admin/publishers/*` | `routes/admin/publishers.ts` |
| `/api/admin/lookup/*` | `routes/admin/lookup.ts` |
| `/api/admin/import/*` | `routes/admin/import.ts` |
| `/api/admin/stats/*` | `routes/admin/stats.ts` |
| `/api/admin/goodreads/*` | `routes/admin/goodreads.ts` |
| `/api/admin/bookmory/*` | `routes/admin/bookmoryImport.ts` |
| `/api/admin/aseeralkotb/*` | `routes/admin/aseeralkotb.ts` |

**Removed:** `/api/bookshelves`, `/api/admin/reading/*`, `/api/admin/lookup/bookshelves`, `/api/admin/stats/bookshelves`

---

*End of detailed reference. For a shorter overview, see [GENERAL.md](./GENERAL.md).*
