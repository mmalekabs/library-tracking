# Project documentation

This folder contains two layers of documentation for **Personal Library Tracker**:

| Document | Audience | Purpose |
|----------|----------|---------|
| [GENERAL.md](./GENERAL.md) | You, collaborators, future you (quick orientation) | What the app does, how it is structured, how to run and deploy it |
| [DETAILED.md](./DETAILED.md) | Deep reference when changing code | Every route, component, service, env var, migration step, Goodreads/Missing covers, merge entities, add-to-library flow, books table sort/columns, Add from Goodreads, Gift/Total value, entity tabs, and (on `reading-tracking` branch) the reading tracker — reading-only books, Goodreads add-to-read, session edit/delete, auto current page |

**Git branches:** `main` = library tracker. `reading-tracking` = library tracker + reading tracker module — see [README.md](../README.md#branches).

**Also see (repo root):**

- [README.md](../README.md) — setup and Railway quick start  
- [SECURITY.md](../SECURITY.md) — secrets and GitHub safety  
- [LIBRARY_APP_SPEC.pdf](../LIBRARY_APP_SPEC.pdf) — original product specification  

**Suggested reading order**

1. GENERAL.md — first time or after a long break  
2. DETAILED.md — before any non-trivial code change  
3. Search DETAILED.md (`Ctrl+F`) for the file or feature you are touching  
