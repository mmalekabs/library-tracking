# Personal Library Tracker — Detailed technical reference

This document is the **exhaustive** companion to [GENERAL.md](./GENERAL.md). It lists routes, files, data flows, and **exact places to edit** for future work.

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
21. [Goodreads covers and Missing covers page](#21-goodreads-covers-and-missing-covers-page)
22. [Author/publisher merge and add-to-library flow](#22-authorpublisher-merge-and-add-to-library-flow)

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
| `LIBRARY_APP_SPEC.pdf` | Original product specification (PDF) |
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
| `src/routes/bookshelves.ts` | Public bookshelf filter list |
| `src/routes/admin/index.ts` | Mounts all `/api/admin/*` sub-routers |
| `src/routes/admin/books.ts` | Admin book CRUD + bulk + visibility |
| `src/routes/admin/authors.ts` | Admin author CRUD |
| `src/routes/admin/publishers.ts` | Admin publisher CRUD |
| `src/routes/admin/lookup.ts` | Autocomplete for forms |
| `src/routes/admin/import.ts` | CSV preview + import |
| `src/routes/admin/stats.ts` | Dashboard stat endpoints |
| `src/routes/admin/goodreads.ts` | Fetch cover URL from Goodreads book page |
| `src/services/goodreadsService.ts` | Scrape `og:image` from Goodreads show page |
| `src/services/bookService.ts` | Core book logic, serialization, filters, missing covers |
| `src/services/authorService.ts` | Author CRUD |
| `src/services/publisherService.ts` | Publisher CRUD |
| `src/services/lookupService.ts` | Lightweight lists for pickers |
| `src/services/importService.ts` | CSV parsing + row import |
| `src/services/statsService.ts` | Aggregations for dashboard |
| `src/validators/book.ts` | Zod schemas for books |
| `src/validators/auth.ts` | Login / password schemas |
| `src/validators/entity.ts` | Author/publisher name schema |
| `src/validators/import.ts` | Import settings schema |
| `src/validators/validate.ts` | `validateBody` middleware factory |
| `src/validators/query.ts` | `validateQuery` middleware factory |
| `src/middleware/auth.ts` | `requireAuth` JWT check |
| `src/middleware/asyncHandler.ts` | Async error wrapper |
| `src/middleware/errorHandler.ts` | `AppError` + JSON errors |
| `src/middleware/rateLimiter.ts` | API + auth rate limits |
| `src/utils/jwt.ts` | Sign / verify JWT |
| `src/utils/book.ts` | `decimalToNumber`, `calculateSavings` |
| `src/utils/csvParse.ts` | Binding/format mapping from CSV text |
| `src/utils/response.ts` | `sendSuccess`, `sendPaginated` |
| `src/utils/params.ts` | `paramId` helper |
| `src/types/express.d.ts` | Express request typing extensions |
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
| `src/components/books/BookCard.tsx` | Catalog card |
| `src/components/admin/*` | Forms, tables, import UI, `MoveToLibraryModal.tsx` |
| `src/pages/public/*` | Catalog + wishlist pages |
| `src/pages/admin/*` | All admin screens (incl. `MissingCoversPage.tsx`) |
| `src/lib/*` | API wrappers (`books.ts`, `goodreads.ts`, …) |
| `src/utils/formatElapsed.ts` | Timer display for bulk cover fetch |
| `src/constants/*` | Enums labels, pagination, CSV fields |
| `src/types/index.ts` | Shared TS interfaces |
| `vite.config.ts` | `@/` alias, `/api` proxy |
| `tailwind.config.ts` | Theme (`primary` color, etc.) |

---

## 2. Environment variables

### Server (`server/.env`)

| Variable | Required | Used in | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | Prisma | **Local:** Railway **public** URL (`*.proxy.rlwy.net`). **Railway runtime:** `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | Yes | `index.ts` (startup check), `jwt.ts` | Long random string; rotate if leaked |
| `ADMIN_USERNAME` | Seed | `prisma/seed.ts` | Default `admin` |
| `ADMIN_PASSWORD` | Seed | `prisma/seed.ts` | Web login only; re-run seed after change |
| `NODE_ENV` | No | `prisma.ts` | `development` enables query logging |
| `PORT` | No | `index.ts` | Default `3000` |
| `CLIENT_URL` | No | CORS in `index.ts` | Default `http://localhost:5173`; set to production frontend URL |

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
| `ReadingStatus` | `TO_READ`, `READING`, `READ`, `DID_NOT_FINISH`, `ON_HOLD` | `Book.status` |
| `BindingType` | `PAPERBACK`, `HARDCOVER`, `MASS_MARKET_PAPERBACK`, `KINDLE_EDITION`, `UNKNOWN` | `Book.binding` |

### Models

#### `Admin`

| Field | Type | Notes |
|-------|------|-------|
| `id` | cuid | PK |
| `username` | string unique | Login name |
| `passwordHash` | string | bcrypt cost 12 |

#### `Author`

| Field | Notes |
|-------|-------|
| `name` | unique |
| Relations | `booksAsPrimary`, `booksAsAdditional` |

#### `Publisher`

| Field | Notes |
|-------|-------|
| `name` | unique |
| Relations | `books` |

#### `Bookshelf`

| Field | Notes |
|-------|-------|
| `name` | unique (shelf/tag label) |
| Relations | `books` via `BookBookshelf` |

#### `Book` (central entity)

| Field | Type | Notes |
|-------|------|-------|
| `externalId` | string? unique | Goodreads-style ID |
| `title` | string | Required |
| `isbn`, `isbn13` | string? | |
| `purchasePrice`, `marketPrice` | Decimal(10,2)? | Admin pricing |
| `currency` | string | Default `SAR` |
| `format`, `binding` | enums | |
| `numberOfPages`, `yearPublished`, `originalPublicationYear` | int? | |
| `edition` | string? | |
| `status` | ReadingStatus | Default `TO_READ` |
| `dateAdded` | DateTime | Default now |
| `dateStartedReading`, `dateFinishedReading` | DateTime? | |
| `isPubliclyVisible` | boolean | Default `true` |
| `toPurchase` | boolean | Default `false` — wishlist flag |
| `coverImageUrl`, `notes` | string? | `notes` admin-only in API |
| `authorId` | FK? → Author | Primary author; **nullable** for wishlist books (`toPurchase: true`) |
| `publisherId` | FK? → Publisher | |

**Indexes:** `title`, `status`, `format`, `isPubliclyVisible`, `toPurchase`, `authorId`, `publisherId`

#### Junction tables

- `BookAdditionalAuthor` — composite PK `(bookId, authorId)`
- `BookBookshelf` — composite PK `(bookId, bookshelfId)`

### Migrations (committed)

| Migration | Adds |
|-----------|------|
| `20250524120000_init` | Full initial schema |
| `20250525120000_add_to_purchase` | `Book.toPurchase` + index |
| `20250526120000_optional_author` | `Book.authorId` nullable (wishlist without author) |

**Apply locally:** `cd server && npx prisma migrate deploy`  
**Apply on Railway:** `preDeployCommand` in `server/railway.toml`

---

## 4. Authentication flow

### Login

1. User submits username/password on `AdminLoginPage`
2. `POST /api/auth/login` with `{ username, password }`
3. Server compares bcrypt hash on `Admin` row
4. Returns `{ token, user: { id, username } }`
5. Client stores token in `localStorage` key `auth_token` (`AUTH_TOKEN_KEY`)
6. `AuthContext` sets user state; navigates to `/admin`

### Authenticated requests

- `apiFetch` / `fetchBookList` / `executeCsvImport` attach `Authorization: Bearer <token>`
- `GET /api/auth/me` validates token (uses `requireAuth`)

### Logout

- Clears `localStorage` token and user state; redirect to `/admin/login`

### Change password

- `SettingsPage` → `POST /api/auth/change-password` with current + new password (min 8 chars)

### Protected UI only (today)

- `ProtectedRoute` wraps `/admin/*` (except login)
- **Server admin routes do not use `requireAuth`** — see [§20](#20-known-limitations-and-recommended-improvements)

---

## 5. Book collections and visibility rules

**Logic lives in:** `server/src/services/bookService.ts` → `buildWhereClause`, `getBookById`, `createBook`

### Admin list query param: `collection`

| `collection` | `toPurchase` filter | Default admin page |
|--------------|---------------------|-------------------|
| `library` (default) | `toPurchase = false` | `/admin/books` |
| `to_purchase` | `toPurchase = true` | `/admin/to-purchase` |

Optional `visibility`: `all` | `public` | `hidden` → filters `isPubliclyVisible`

### Public API modes: `publicCollection`

| Route | `publicOnly` | `publicCollection` | Result |
|-------|--------------|-------------------|--------|
| `GET /api/books` | true | `library` | Visible library books only |
| `GET /api/to-purchase` | true | `to_purchase` | Visible wishlist books only |

Public detail: book must be `isPubliclyVisible` **and** match collection (`toPurchase` true/false).

### Create book

- If `toPurchase: true` on create → sets `toPurchase` and respects `isPubliclyVisible` from input (no longer forced hidden)

### Wishlist author (optional)

- `createBookSchema`: primary author required **unless** `toPurchase: true`
- `Book.authorId` may be `null` on wishlist rows; API returns `author: null` (UI shows “—”)
- Library books must have an author (enforced on create and via add-to-library flow)

### Move to library

**UI:** `MoveToLibraryModal` on **To Purchase** grid/table → **Add to library**

**Client:** `moveBookToLibrary(id, data)` → `POST /api/admin/books/:id/move-to-library`

**Body** (`moveToLibrarySchema`): `numberOfPages`, `authorId` or `authorName`, `publisherId` or `publisherName`, `marketPrice` (required), `purchasePrice` (optional)

**Server:** `bookService.moveBookToLibrary` — verifies `toPurchase`, resolves author/publisher, sets `toPurchase: false`, `isPubliclyVisible: true`, saves pricing/pages

### Serialization (`serializeBook`)

| Option | Effect |
|--------|--------|
| `includePricing: false` | Omits prices (public) |
| `includePricing: true` | Includes `purchasePrice`, `marketPrice`, `savings` |
| `includeAdminFields: true` | Adds `isPubliclyVisible`, `toPurchase`, `notes` |

---

## 6. API reference

Base URL: `/api`. Responses use `{ success, data, ... }` or paginated `{ data, pagination }`.

### Health

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | No |

### Auth (`/api/auth`)

| Method | Path | Auth | Body / notes |
|--------|------|------|----------------|
| POST | `/login` | No | `{ username, password }` — rate limited |
| GET | `/me` | JWT | Current user |
| POST | `/change-password` | JWT | `{ currentPassword, newPassword }` |

### Public books

| Method | Path | Query | Notes |
|--------|------|-------|-------|
| GET | `/books` | `bookListQuerySchema` | Library, public visible only |
| GET | `/books/:id` | — | Single public library book |

### Public wishlist

| Method | Path | Query | Notes |
|--------|------|-------|-------|
| GET | `/to-purchase` | same as books list | Wishlist, public visible |
| GET | `/to-purchase/:id` | — | Single public wishlist book |

### Public filters

| Method | Path | Returns |
|--------|------|---------|
| GET | `/authors` | Authors with ≥1 public library book |
| GET | `/publishers` | Publishers with public books |
| GET | `/bookshelves` | Shelves on public books |

### Admin books (`/api/admin/books`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Paginated; `collection`, `visibility`, filters |
| POST | `/` | `createBookSchema` |
| GET | `/:id` | Full admin serialization |
| PUT | `/:id` | Partial update `updateBookSchema` |
| DELETE | `/:id` | Hard delete |
| PATCH | `/:id/visibility` | `{ isPubliclyVisible }` |
| PATCH | `/bulk-visibility` | `{ ids[], isPubliclyVisible }` |
| DELETE | `/bulk-delete` | `{ ids[] }` |
| GET | `/missing-covers/summary` | `?collection=all\|library\|to_purchase` — counts without cover |
| GET | `/missing-covers` | Paginated list of books missing `coverImageUrl` |
| POST | `/bulk-fetch-covers` | Server-side bulk fetch (optional; UI uses client-side loop) |
| POST | `/:id/move-to-library` | Wishlist → library with required metadata (`moveToLibrarySchema`) |

**List query highlights** (`bookListQuerySchema`):

- `page`, `limit` (max 100)
- `search`, `format`, `status`, `binding`
- `authorId`, `publisherId`, `bookshelfId`
- `minPrice`, `maxPrice`, `minPages`, `maxPages`, `yearFrom`, `yearTo`
- `sortBy`: `title` | `purchasePrice` | `numberOfPages` | `dateAdded` | `yearPublished`
- `sortOrder`: `asc` | `desc`
- `collection`: `library` | `to_purchase`
- `visibility`: `all` | `public` | `hidden`

### Admin authors / publishers

| Method | Path |
|--------|------|
| GET | `/api/admin/authors` |
| POST | `/api/admin/authors` — `{ name }` |
| PUT | `/api/admin/authors/:id` — `{ name }` |
| DELETE | `/api/admin/authors/:id` — blocked if books reference author |
| POST | `/api/admin/authors/merge` — `{ targetId, sourceIds[] }` reassign books, delete sources |

| Method | Path |
|--------|------|
| GET | `/api/admin/publishers` |
| POST | `/api/admin/publishers` |
| PUT | `/api/admin/publishers/:id` |
| DELETE | `/api/admin/publishers/:id` |
| POST | `/api/admin/publishers/merge` — `{ targetId, sourceIds[] }` |

### Admin lookup (forms)

| Method | Path |
|--------|------|
| GET | `/api/admin/lookup/authors` |
| GET | `/api/admin/lookup/publishers` |
| GET | `/api/admin/lookup/bookshelves` |

### Admin import

| Method | Path | Body |
|--------|------|------|
| POST | `/api/admin/import/preview` | multipart: `file` |
| POST | `/api/admin/import/csv` | multipart: `file`, `settings` (JSON string) |

**Import settings** (`importSettingsSchema`):

- `duplicateMode`: `skip` | `overwrite` | `allow`
- `defaultFormat`, `defaultStatus`
- `defaultToPurchase`: boolean
- `defaultVisibility`: boolean
- `columnMapping`: CSV header → field name

### Admin stats (`/api/admin/stats`)

| Path | Purpose |
|------|---------|
| `/overview` | Totals, public/hidden counts, read count, etc. |
| `/reading` | Status breakdown |
| `/spending` | Price aggregates |
| `/authors` | Top authors |
| `/publishers` | Top publishers |
| `/formats` | Format breakdown |
| `/timeline` | Books added over time |
| `/bookshelves` | Shelf usage |
| `/pages` | Page count stats |
| `/lists` | Misc list stats |

### Admin Goodreads (`/api/admin/goodreads`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/cover/:bookId` | Numeric Goodreads Book Id → `{ coverUrl, goodreadsBookId, goodreadsUrl }` |

**Implementation:** `goodreadsService.ts` fetches `https://www.goodreads.com/book/show/{id}`, parses Open Graph `og:image`. Validates ids with `isValidGoodreadsBookId` (digits only).

---

## 7. Server architecture

### Request lifecycle

```
HTTP Request
  → helmet, cors, express.json
  → apiRateLimiter (/api)
  → route handler
      → validateQuery / validateBody (Zod)
      → asyncHandler → service → prisma
  → sendSuccess / sendPaginated
  OR errorHandler (AppError or 500)
```

### `bookService.ts` key functions

| Function | Responsibility |
|----------|----------------|
| `serializeBook` | API-shaped JSON |
| `buildWhereClause` | Filters for list (public/admin/collection) |
| `listBooks` | Paginated findMany |
| `getBookById` | Single book + public guards |
| `createBook` | Resolve author/publisher/shelves by id or name (upsert) |
| `updateBook` | Partial update; replace additional authors / shelves if provided |
| `setBookVisibility` | Toggle `isPubliclyVisible` |
| `bulkSetVisibility` / `bulkDeleteBooks` | Batch ops |
| `getMissingCoversSummary` | Counts books without cover, with/without valid Goodreads Id |
| `listBooksMissingCovers` | Paginated missing-cover list; optional `withGoodreadsIdOnly` filter |
| `bulkFetchGoodreadsCovers` | Server loop with ~800ms delay (used by API; admin UI may fetch client-side) |
| `moveBookToLibrary` | Wishlist → library with validated metadata |
| `listPublicAuthors` etc. | Filter lists for public catalog |

### `authorService.ts` / `publisherService.ts`

| Function | Responsibility |
|----------|----------------|
| `listAuthorsAdmin` / `listPublishersAdmin` | Admin CRUD lists with `bookCount` |
| `createAuthor` / `createPublisher` | Unique name |
| `updateAuthor` / `updatePublisher` | Rename |
| `deleteAuthor` / `deletePublisher` | Blocked if books linked |
| `mergeAuthors` | Reassign primary + additional author links to target; remove duplicate additional rows; delete sources |
| `mergePublishers` | Reassign `publisherId` on all books; delete sources |

### Author/publisher resolution on create/update

- Primary author: `authorId` **or** `authorName` (upsert by unique name)
- Additional: `additionalAuthorIds` + `additionalAuthorNames`
- Publisher: `publisherId` **or** `publisherName` (nullable)
- Bookshelves: `bookshelfIds` + `bookshelfNames` (upsert by name)

### Error format

`AppError(status, code, message)` → JSON `{ success: false, error: { code, message } }`

---

## 8. Frontend architecture

### Entry and providers

`main.tsx`:

- `QueryClientProvider` (TanStack Query — server state cache)
- `BrowserRouter`
- `AuthProvider`
- `Toaster` (react-hot-toast)
- `App`

### Routing (`App.tsx`)

**Public** — wrapped in `PublicLayout`:

- `/`, `/books/:id`, `/to-purchase`, `/to-purchase/:id`

**Admin login** — standalone:

- `/admin/login`

**Admin app** — `ProtectedRoute` → `AdminLayout`:

- Dashboard, books, to-purchase, authors, publishers, import, missing-covers, settings
- Shared `BookFormPage` for `/admin/books/new`, `/admin/books/:id/edit`, `/admin/to-purchase/new`, `/admin/to-purchase/:id/edit`

### Path detection in `BookFormPage`

- `location.pathname.includes("/to-purchase")` → wishlist mode (`defaultToPurchase`, back link)

### API base URL

- Dev: Vite proxies `/api` → `http://localhost:3000`
- Prod: set `VITE_API_URL` on frontend build

### Styling

- Tailwind utility classes
- `primary` color in `tailwind.config.ts`
- Shared admin input class: `inputClass` in `FormSection.tsx`

---

## 9. Component responsibilities

### Layout

#### `PublicLayout.tsx`

- Header: logo, links to Catalog, To Purchase, Admin login
- `<Outlet />` for public pages
- Footer

**Edit public nav:** add `<Link>` in header nav block.

#### `AdminLayout.tsx`

- Desktop sidebar + mobile hamburger drawer
- `navItems` array drives menu (Dashboard, Books, To Purchase, Authors, Publishers, Import, Missing covers, Settings)
- `pageTitles` for header title; special cases for `/new` and `/edit` paths
- Logout clears auth and redirects to login
- “View public catalog” link to `/`

**Add admin menu item:** extend `navItems` + `pageTitles` + new route in `App.tsx`.

### Auth

#### `ProtectedRoute.tsx`

- If `useAuth().user` is null → `<Navigate to="/admin/login" />`
- Else render children

### Books (public)

#### `BookCard.tsx`

| Prop | Purpose |
|------|---------|
| `book` | Data |
| `admin` | Shows hidden styling when `!isPubliclyVisible` |
| `detailPath` | Override link (default `/books/:id` or admin edit) |

### Admin — books list

#### `AdminBooksList.tsx`

- Orchestrates search, visibility filter, view toggle (table/grid), pagination
- `collection` prop: `"library"` | `"to_purchase"`
- Uses `fetchAdminBooks` with `limit` from `pageSize` (10–100)
- Grid: cards + visibility / delete / **Add to library** (opens `MoveToLibraryModal`)
- Table: delegates to `AdminBooksTable`; same modal for add-to-library

**Change default page size:** `DEFAULT_PAGE_SIZE` in `constants/pagination.ts`.

**Change default view:** `useState<ViewMode>("grid")` in `AdminBooksList.tsx` (grid is default; table for inline edit).

#### `AdminBooksTable.tsx`

- Renders scrollable HTML table
- One active cell edit at a time
- `pointerdown` on `document` outside `tableRef` → finish edit → open `ConfirmChangeModal` if changed
- Save via `updateBook(id, payload)`
- Actions: link to full form, add to library (callback → modal), delete

**Add editable column:**

1. Add field to `BookTableField` and `BOOK_TABLE_COLUMNS` in `bookTableEdit.ts`
2. Implement `getBookFieldDisplay`, `getBookFieldRaw`, `buildBookFieldPayload`
3. Optionally `fieldUsesSelect` / `getSelectOptions`

#### `bookTableEdit.ts`

- Pure helpers for table editing (no React)

#### `TablePagination.tsx`

- Rows-per-page select + prev/next + “X–Y of Z”

#### `ConfirmChangeModal.tsx`

- Modal UI for confirm/cancel inline edits

### Admin — forms

#### `BookForm.tsx`

- Full create/edit form (all book fields)
- `defaultToPurchase`, `backPath` props
- `formToPayload` builds API body (author by id or name, etc.)
- Checkbox: **To purchase** + **Publicly visible** (label depends on `toPurchase`)
- **Primary author** optional when **To purchase** is checked; required for library books
- **Goodreads Book Id** (`externalId`) + **Fetch cover** button → `GET /api/admin/goodreads/cover/:id` → sets `coverImageUrl`
- Mutations: `createBook`, `updateBook`, `deleteBook`

**Add form field:**

1. Add to `FormState`, `bookToFormState`, `emptyForm`, `formToPayload`
2. Add UI in appropriate `FormSection`
3. Ensure `createBookSchema` / `updateBookSchema` on server include field

#### `FormSection.tsx` / `FormField.tsx`

- Layout helpers + `inputClass`

#### `EntityPicker.tsx`

- Single author/publisher autocomplete (admin lookup API)

#### `TagPicker.tsx`

- Multi entity tags (additional authors, bookshelves)

#### `EntityManageTable.tsx`

- Full CRUD table for authors or publishers (inline row edit, not book table)
- Row checkboxes + **Merge selected (N)** when `mergeItems` prop provided (`mergeAuthors` / `mergePublishers`)
- Merge modal: radio pick target name; sources deleted after book reassignment
- **Sticky** header block (title, description, search, add, merge) — `sticky top-14 md:top-16` below admin layout header

#### `MoveToLibraryModal.tsx`

- Shown from To Purchase **Add to library**
- Fields: pages, author (`EntityPicker`), publisher (`EntityPicker`), market price, optional purchase price
- Submits `POST .../move-to-library`

### Admin — stats

#### `StatCard.tsx`, `Section.tsx`, `ChartBox.tsx`

- Dashboard layout wrappers for Recharts

#### `MissingCoversPage.tsx`

- Route: `/admin/missing-covers`
- Summary cards: total missing, fetchable (valid Goodreads Id), no Id
- **Fetch all with Goodreads Id**: client-side sequential fetch (~800ms between books) so UI can update live
- Live **elapsed timer** (`formatElapsed`) and **Fetched X of Y** progress bar
- After each success: updates TanStack Query cache (summary + table row removed without full page reload)
- Per-row **Fetch** uses same Goodreads + `updateBook` flow as the book form

---

## 10. Page responsibilities

### Public pages

| Page | File | Data | User actions |
|------|------|------|--------------|
| Catalog | `CatalogPage.tsx` | `fetchPublicBooks` | Search, paginate (fixed 20/page) |
| Book detail | `PublicBookDetailPage.tsx` | `fetchPublicBook` | View metadata |
| Wishlist catalog | `ToPurchaseCatalogPage.tsx` | `fetchPublicToPurchase` | Search, paginate |
| Wishlist detail | `PublicToPurchaseBookDetailPage.tsx` | `fetchPublicToPurchaseBook` | View metadata |

### Admin pages

| Page | File | Notes |
|------|------|-------|
| Login | `AdminLoginPage.tsx` | Calls `AuthContext.login` |
| Dashboard | `DashboardPage.tsx` | Many `stats.ts` queries + Recharts |
| Books | `BooksManagePage.tsx` | `<AdminBooksList collection="library" />` |
| To Purchase | `ToPurchasePage.tsx` | `<AdminBooksList collection="to_purchase" />` |
| Book form | `BookFormPage.tsx` | Loads book for edit; wraps `BookForm` |
| Authors | `AuthorsPage.tsx` | `EntityManageTable` + author API |
| Publishers | `PublishersPage.tsx` | Same for publishers |
| Import | `ImportPage.tsx` | 4-step wizard: upload → preview → settings → report |
| Missing covers | `MissingCoversPage.tsx` | Books without `coverImageUrl`; Goodreads bulk/single fetch |
| Settings | `SettingsPage.tsx` | Change password |

### Import wizard steps (`ImportPage.tsx`)

1. **upload** — drag/drop CSV, PapaParse client-side
2. **preview** — column mapping auto-detect (`detectColumnMapping`), validation errors
3. **settings** — duplicate mode, format, status, **to purchase**, visibility
4. **report** — counts from server after `executeCsvImport`

---

## 11. Client libraries (`src/lib`)

| Module | Exports | Backend paths |
|--------|---------|---------------|
| `api.ts` | `apiFetch`, `ApiError`, `checkHealth` | Generic |
| `auth.ts` | `login`, `getMe`, `changePassword`, token helpers | `/auth/*` |
| `books.ts` | List, CRUD, visibility, `moveBookToLibrary(id, data)`, missing covers, `hasGoodreadsBookId` | `/books`, `/to-purchase`, `/admin/books` |
| `goodreads.ts` | `fetchGoodreadsCover(bookId)` | `/admin/goodreads/cover/:bookId` |
| `entities.ts` | Author/publisher CRUD + `mergeAuthors` / `mergePublishers` | `/admin/authors`, `/admin/publishers` |
| `lookup.ts` | `fetchAdminAuthors`, etc. | `/admin/lookup/*` |
| `stats.ts` | One function per stat endpoint | `/admin/stats/*` |
| `import.ts` | `executeCsvImport`, types | `/admin/import/csv` |
| `constants.ts` | `AUTH_TOKEN_KEY` | — |

**Query keys (TanStack Query):** convention `"books"`, `"books", "admin"`, `"books", "admin", collection`, etc. **Invalidate** `"books"` after mutations.

---

## 12. Constants and types

### `client/src/types/index.ts`

Mirrors API: `Book`, `Author`, `Publisher`, `Bookshelf`, enums.

### `client/src/constants/book.ts`

- `FORMAT_OPTIONS`, `BINDING_OPTIONS`, `STATUS_OPTIONS`, `CURRENCY_OPTIONS`
- `CSV_FIELD_OPTIONS` for import column mapping UI

### `client/src/constants/import.ts`

- `detectColumnMapping(headers)` — fuzzy header → field name

### `client/src/constants/pagination.ts`

- `PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100]`
- `DEFAULT_PAGE_SIZE = 10`

### `client/src/constants/stats.ts`

- Chart colors / labels if present

---

## 13. CSV import pipeline

### Client

1. Parse CSV with PapaParse (browser)
2. Map columns via `columnMapping`
3. POST file + `settings` JSON to server

### Server (`importService.ts`)

1. `parseCsvPreview` — headers + sample rows
2. `importBooksFromCsv`:
   - For each row → `rowToBookInput` (requires title + author column)
   - `findDuplicate` by `externalId` or title+author
   - Respect `duplicateMode`
   - `bookService.createBook` or update
   - Track created author/publisher names in report

**Defaults from settings:**

- `toPurchase: settings.defaultToPurchase`
- `isPubliclyVisible: settings.defaultVisibility`

**Add importable field:**

1. `CSV_FIELD_OPTIONS` + `detectColumnMapping` heuristics
2. `rowToBookInput` in `importService.ts`
3. Goodreads column alias in mapping UI if needed

---

## 14. Statistics dashboard

**Page:** `DashboardPage.tsx`  
**Service:** `statsService.ts` (raw Prisma aggregates)

Typical metrics: total books, pages sum, read counts, format/status pies, spending totals, timeline of `dateAdded`, bookshelf distribution.

**Note:** Stats currently count **all** books in DB (including `toPurchase` and hidden) unless filtered in service — verify `statsService.ts` before trusting KPIs for “library only”.

**Add a new chart:**

1. Add function in `statsService.ts`
2. Add route in `admin/stats.ts`
3. Add fetcher in `client/src/lib/stats.ts`
4. Add chart section in `DashboardPage.tsx`

---

## 15. Admin table inline editing

### Flow

```
Click cell → set editing { bookId, field } + editValue
Edit input/select
Click outside table (pointerdown)
  → compare editValue vs getBookFieldRaw(book, field)
  → if different: open ConfirmChangeModal
  → if same: clear editing
Confirm → updateBook(id, buildBookFieldPayload(field, value))
Cancel → discard
```

### Keyboard

- **Enter** — commit check (same as blur outside)
- **Escape** — cancel edit without modal

### Switching cells

- Clicking another cell while editing: if previous cell changed → modal first; if unchanged → switch immediately

### Editable fields (current)

`title`, `author`, `publisher`, `status`, `format`, `binding`, `purchasePrice`, `marketPrice`, `currency`, `numberOfPages`, `yearPublished`, `isbn`, `isPubliclyVisible`

Not in table (use full form): `isbn13`, `edition`, dates, shelves, cover, notes, `toPurchase` toggle.

---

## 16. Build, scripts, and tooling

### Server scripts

| Script | Command |
|--------|---------|
| `dev` | `tsx watch src/index.ts` |
| `build` | `tsc` → `dist/` |
| `start` | `node dist/index.js` |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` (local new migration) |
| `db:deploy` | `prisma migrate deploy` |
| `db:seed` | Upsert admin password |
| `db:studio` | Prisma GUI |

### Client scripts

| Script | Command |
|--------|---------|
| `dev` | `vite` port 5173 |
| `build` | `tsc -b && vite build` → `client/dist/` |
| `preview` | Preview production build |
| `lint` | ESLint |

### TypeScript paths

- Client `@/*` → `src/*` via `vite.config.ts` + `tsconfig`

---

## 17. Railway deployment

### `server/railway.toml`

| Phase | Command |
|-------|---------|
| Build | `npm install && npx prisma generate && npm run build` |
| Pre-deploy | `npx prisma migrate deploy` |
| Start | `npm run start` |
| Health | `GET /api/health` |

### Backend variables (dashboard)

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<random>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong>
CLIENT_URL=https://<your-frontend-domain>
```

### Frontend service

- Root: `client`
- Build: `npm install && npm run build` (see `client/railway.toml`)
- Start: `npm run start` → `serve -s dist` (serves production build; **not** dev `index.html`)
- Do not use `vite`, `npm run dev`, or `vite preview` as the Railway start command
- Variable: `VITE_API_URL=https://<backend>/api` (must include `https://` and `/api` path; set before build)
- **Verify deploy:** View Page Source — script should be `/assets/index-*.js`, not `/src/main.tsx`

### Root `railway.toml`

Documentation only — configure each service’s root directory in Railway UI.

---

## 18. Migrations cookbook

### Add a new column

1. Edit `server/prisma/schema.prisma`
2. `cd server && npx prisma migrate dev --name describe_change`
3. Commit `prisma/migrations/<timestamp>_describe_change/`
4. Deploy: Railway pre-deploy runs `migrate deploy`
5. Update Zod schemas, `bookService`, types, forms as needed

### Rename field

- Prefer multi-step: add new column → backfill → switch app → remove old (or single migration if empty DB)

### Reset local DB (destructive)

```powershell
cd server
npx prisma migrate reset
npm run db:seed
```

---

## 19. Cookbook: common future edits

### Add a new public page

1. Create `client/src/pages/public/MyPage.tsx`
2. Add route under `PublicLayout` in `App.tsx`
3. Add nav link in `PublicLayout.tsx` if needed
4. Add API + service if new data required

### Add a new admin page

1. Create `client/src/pages/admin/MyPage.tsx`
2. Add route under protected `AdminLayout` in `App.tsx`
3. Add `navItems` + `pageTitles` in `AdminLayout.tsx`
4. Add API routes under `server/src/routes/admin/`

### Add a field to books

| Layer | File(s) |
|-------|---------|
| DB | `schema.prisma` + migration |
| Validation | `validators/book.ts` |
| Service | `bookService.ts` (`bookDataFromInput`, `serializeBook`) |
| Types | `client/src/types/index.ts` |
| Form | `BookForm.tsx` |
| Table (optional) | `bookTableEdit.ts`, `BOOK_TABLE_COLUMNS` |
| Import (optional) | `importService.ts`, `CSV_FIELD_OPTIONS` |

### Change pagination defaults (admin books)

- `client/src/constants/pagination.ts` — `DEFAULT_PAGE_SIZE`, `PAGE_SIZE_OPTIONS`
- Public catalog still uses 20 in `CatalogPage.tsx` / `ToPurchaseCatalogPage.tsx` separately

### Change JWT expiry

- `server/src/utils/jwt.ts` — `expiresIn: "7d"`

### Protect admin API (recommended)

In `server/src/routes/admin/index.ts`:

```typescript
import { requireAuth } from "../../middleware/auth.js";
router.use(requireAuth);
```

Place **before** sub-routers. Then every `/api/admin/*` request needs Bearer token.

### Add CORS origin

- `server/src/index.ts` — `cors({ origin: process.env.CLIENT_URL })`

### Change primary brand color

- `client/tailwind.config.ts` — `theme.extend.colors.primary`

### Exclude wishlist books from statistics

- `server/src/services/statsService.ts` — add `where: { toPurchase: false }` to relevant `prisma.book` queries

### Add email / OAuth (not implemented)

Would need: new auth provider, user model changes, new routes — start from `auth.ts` and `AuthContext.tsx`

---

## 20. Known limitations and recommended improvements

| Item | Detail | Suggested fix |
|------|--------|---------------|
| Admin API auth | `/api/admin/*` has no `requireAuth` | Add middleware on admin router |
| Stats include wishlist | May count `toPurchase` books | Filter in `statsService` |
| Public catalog pagination | Fixed 20/page, not 10–100 | Reuse `TablePagination` or shared hook |
| Single admin user | One `Admin` row from seed | New table if multi-user needed |
| No image upload | Cover is URL only | Add storage (S3/R2) + upload route |
| Rate limits | 300 req/15min API | Tune in `rateLimiter.ts` |
| `externalId` duplicates | Import skip/overwrite logic | Document in import UI |
| Grid vs table feature parity | Grid has quick visibility; table edits Public column | Align or document |
| Goodreads rate limits | Scraping book pages; ~800ms delay in bulk | Respect Goodreads ToS; consider official API later |
| Bulk fetch on Missing covers | Runs in browser (one book per request) | Keeps UI live; long lists need tab left open |

---

## 21. Goodreads covers and Missing covers page

### Goodreads Book Id

Stored as `Book.externalId` (unique). CSV import maps column **Book Id** to this field. Must be **numeric** for fetch (`isValidGoodreadsBookId`).

### Where to fetch covers

| UI | Flow |
|----|------|
| Book form | Enter Id → **Fetch cover** → fills `coverImageUrl` (save form to persist) |
| Missing covers | Row **Fetch** or **Fetch all with Goodreads Id** |

### Missing covers API

| Endpoint | Purpose |
|----------|---------|
| `GET .../missing-covers/summary?collection=` | `{ totalMissing, withGoodreadsId, withoutGoodreadsId }` |
| `GET .../missing-covers?...` | Paginated books where `coverImageUrl` is null/empty |
| `POST .../bulk-fetch-covers` | Server-side bulk (optional; page uses client loop for live UI) |

Query params for list: `page`, `limit`, `search`, `collection`, `withGoodreadsIdOnly` (`true`/`false`).

### Client bulk fetch behavior

1. Paginate through all fetchable books (`withGoodreadsIdOnly: true`, `limit: 100`)
2. For each: `fetchGoodreadsCover` → `updateBook` with `coverImageUrl`
3. Update summary + remove row from list via `queryClient.setQueryData`
4. Show elapsed clock and **Fetched X of Y** until complete

**Edit delay:** `BULK_FETCH_DELAY_MS` in `MissingCoversPage.tsx` (800).

### Files to touch

| Change | Files |
|--------|-------|
| Goodreads scrape logic | `server/src/services/goodreadsService.ts` |
| Cover API route | `server/src/routes/admin/goodreads.ts` |
| Missing covers data | `server/src/services/bookService.ts`, `validators/book.ts`, `routes/admin/books.ts` |
| Admin UI | `MissingCoversPage.tsx`, `AdminLayout.tsx`, `App.tsx` |
| Form button | `BookForm.tsx`, `lib/goodreads.ts` |

---

## 22. Author/publisher merge and add-to-library flow

### Merge authors or publishers

**UI:** `/admin/authors` or `/admin/publishers` → check two or more rows → **Merge selected** → choose name to keep → **Merge**

**API:** `POST /api/admin/authors/merge` or `POST /api/admin/publishers/merge`

```json
{ "targetId": "cuid-to-keep", "sourceIds": ["cuid-a", "cuid-b"] }
```

**Authors:** updates `Book.authorId` and `BookAdditionalAuthor` rows; drops duplicate additional-author links when target is already on the book; deletes source author rows.

**Publishers:** updates `Book.publisherId`; deletes source publisher rows.

**Validation:** `mergeEntitiesSchema` in `validators/entity.ts` — `targetId` must not appear in `sourceIds`.

### Optional author on wishlist

| Context | Author rule |
|---------|-------------|
| Create/edit wishlist book (`toPurchase: true`) | Author optional (`authorId` may be null) |
| Create library book | Author required (`authorId` or `authorName`) |
| Add to library modal | Author required |
| Public catalog cards | Shows “—” when `author` is null |

### Add to library modal flow

```
To Purchase list → Add to library
  → MoveToLibraryModal (prefills existing pages/prices/author/publisher if any)
  → POST /api/admin/books/:id/move-to-library
  → bookService.moveBookToLibrary
  → Book in library with full metadata
```

### Files to touch

| Change | Files |
|--------|-------|
| Merge logic | `authorService.ts`, `publisherService.ts`, `validators/entity.ts`, admin author/publisher routes |
| Merge UI | `EntityManageTable.tsx`, `AuthorsPage.tsx`, `PublishersPage.tsx`, `lib/entities.ts` |
| Move to library | `moveToLibrarySchema`, `bookService.moveBookToLibrary`, `routes/admin/books.ts`, `MoveToLibraryModal.tsx`, `AdminBooksList.tsx` |
| Optional wishlist author | `schema.prisma`, migration `optional_author`, `createBookSchema`, `BookForm.tsx`, `types/index.ts` (`author: Author \| null`) |
| Sticky entity toolbar | `EntityManageTable.tsx` sticky wrapper classes |

---

## Appendix A — Client route → file map

| Route | Component file |
|-------|----------------|
| `/` | `pages/public/CatalogPage.tsx` |
| `/books/:id` | `pages/public/PublicBookDetailPage.tsx` |
| `/to-purchase` | `pages/public/ToPurchaseCatalogPage.tsx` |
| `/to-purchase/:id` | `pages/public/PublicToPurchaseBookDetailPage.tsx` |
| `/admin/login` | `pages/admin/AdminLoginPage.tsx` |
| `/admin` | `pages/admin/DashboardPage.tsx` |
| `/admin/books` | `pages/admin/BooksManagePage.tsx` |
| `/admin/books/new` | `pages/admin/BookFormPage.tsx` |
| `/admin/books/:id/edit` | `pages/admin/BookFormPage.tsx` |
| `/admin/to-purchase` | `pages/admin/ToPurchasePage.tsx` |
| `/admin/to-purchase/new` | `pages/admin/BookFormPage.tsx` |
| `/admin/to-purchase/:id/edit` | `pages/admin/BookFormPage.tsx` |
| `/admin/authors` | `pages/admin/AuthorsPage.tsx` |
| `/admin/publishers` | `pages/admin/PublishersPage.tsx` |
| `/admin/import` | `pages/admin/ImportPage.tsx` |
| `/admin/missing-covers` | `pages/admin/MissingCoversPage.tsx` |
| `/admin/settings` | `pages/admin/SettingsPage.tsx` |

---

## Appendix B — Server route → file map

| HTTP | Path | Handler file |
|------|------|--------------|
| GET | `/api/health` | `index.ts` |
| POST | `/api/auth/login` | `routes/auth.ts` |
| GET | `/api/auth/me` | `routes/auth.ts` |
| POST | `/api/auth/change-password` | `routes/auth.ts` |
| GET | `/api/books` | `routes/books.ts` |
| GET | `/api/books/:id` | `routes/books.ts` |
| GET | `/api/to-purchase` | `routes/toPurchase.ts` |
| GET | `/api/to-purchase/:id` | `routes/toPurchase.ts` |
| GET | `/api/authors` | `routes/authors.ts` |
| GET | `/api/publishers` | `routes/publishers.ts` |
| GET | `/api/bookshelves` | `routes/bookshelves.ts` |
| * | `/api/admin/books/*` | `routes/admin/books.ts` |
| * | `/api/admin/authors/*` | `routes/admin/authors.ts` |
| * | `/api/admin/publishers/*` | `routes/admin/publishers.ts` |
| * | `/api/admin/lookup/*` | `routes/admin/lookup.ts` |
| * | `/api/admin/import/*` | `routes/admin/import.ts` |
| * | `/api/admin/stats/*` | `routes/admin/stats.ts` |
| GET | `/api/admin/goodreads/cover/:bookId` | `routes/admin/goodreads.ts` |
| GET | `/api/admin/books/missing-covers/summary` | `routes/admin/books.ts` |
| GET | `/api/admin/books/missing-covers` | `routes/admin/books.ts` |
| POST | `/api/admin/books/bulk-fetch-covers` | `routes/admin/books.ts` |
| POST | `/api/admin/books/:id/move-to-library` | `routes/admin/books.ts` |
| POST | `/api/admin/authors/merge` | `routes/admin/authors.ts` |
| POST | `/api/admin/publishers/merge` | `routes/admin/publishers.ts` |

---

## Appendix C — Phase-by-phase file checklist (implementation order)

Use this when onboarding or auditing completeness.

**Phase 1 — Scaffold**

- `server/prisma/schema.prisma`, `migrations/20250524120000_init`
- `server/src/index.ts`, `middleware/*`, `utils/response.ts`
- `client/` Vite + Tailwind + `App.tsx` shell

**Phase 2 — Database**

- Railway Postgres, `server/.env`, `db:seed`, migrate deploy

**Phase 3 — Auth**

- `routes/auth.ts`, `middleware/auth.ts`, `utils/jwt.ts`
- `AuthContext.tsx`, `ProtectedRoute.tsx`, `AdminLoginPage.tsx`

**Phase 4 — Books API + catalog**

- `bookService.ts`, `routes/books.ts`, `routes/admin/books.ts`
- `CatalogPage.tsx`, `BookCard.tsx`, `lib/books.ts`

**Phase 5 — Form + import**

- `BookForm.tsx`, `BookFormPage.tsx`, `ImportPage.tsx`
- `importService.ts`, `routes/admin/import.ts`

**Phase 6 — Stats**

- `statsService.ts`, `routes/admin/stats.ts`, `DashboardPage.tsx`, `lib/stats.ts`

**Phase 7 — Entities + mobile nav**

- `authorService.ts`, `publisherService.ts`, admin routes
- `EntityManageTable.tsx`, `AuthorsPage.tsx`, `PublishersPage.tsx`
- `AdminLayout.tsx` mobile menu

**Phase 8 — To purchase**

- Migration `add_to_purchase`, collection filters in `bookService.ts`
- `routes/toPurchase.ts`, public wishlist pages
- `ToPurchasePage.tsx`, form checkbox, import `defaultToPurchase`

**Phase 9 — Admin table**

- `AdminBooksTable.tsx`, `bookTableEdit.ts`, `ConfirmChangeModal.tsx`, `TablePagination.tsx`

**Phase 10 — GitHub hygiene**

- `.gitignore`, `SECURITY.md`, `docs/`, env examples

**Phase 11 — Goodreads covers**

- `goodreadsService.ts`, `routes/admin/goodreads.ts`
- `bookService.ts` missing-cover helpers, `MissingCoversPage.tsx`
- `BookForm.tsx` Fetch cover, `lib/goodreads.ts`
- `AdminBooksList.tsx` default **grid** view

**Phase 12 — Merge entities + add to library**

- Migration `optional_author`, nullable `Book.authorId`
- `mergeAuthors`, `mergePublishers`, `moveBookToLibrary` services + routes
- `MoveToLibraryModal.tsx`, `EntityManageTable` merge + sticky toolbar
- `BookForm.tsx` optional author on wishlist

---

*End of detailed reference. For a shorter overview, see [GENERAL.md](./GENERAL.md).*
