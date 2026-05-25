# Security & secrets

This repository is intended to be **public on GitHub**. Do not commit credentials.

## Never commit

| Item | Where it belongs |
|------|----------------|
| `server/.env` | Local only; listed in `.gitignore` |
| `client/.env` | Local only (optional) |
| Railway / Postgres URLs with real passwords | Railway Variables or `server/.env` |
| `JWT_SECRET` | Railway Variables or `server/.env` |
| `ADMIN_PASSWORD` | Railway Variables or `server/.env` |
| API keys, private keys (`.pem`, `.key`) | Secret manager / env vars |

## Safe to commit

- `.env.example` and `server/.env.example` — placeholders only
- Prisma migrations and schema
- Application source code (reads config from `process.env` / `import.meta.env`)

## Before your first push

1. Confirm `.env` is ignored:
   ```bash
   git status
   ```
   You should **not** see `server/.env` or `client/.env`.

2. If `.env` was ever committed, remove it from history and rotate all secrets (database password, `JWT_SECRET`, admin password).

3. Set production secrets in **Railway → Service → Variables**, not in the repo.

## Reporting issues

If you discover a security problem, avoid opening a public issue with exploit details; contact the repository owner privately.
