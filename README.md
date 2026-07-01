# China Trip Packing

A Next.js + React checklist for the **Las Vegas + China trip** (6/11–7/30). Check
items off as you pack them; every change is synced instantly to a **SQLite/libSQL
database** — a local file (`data/packing.db`) in development, and **Turso** in
production (so it works on Vercel).

Built from Lionel's hand-written "carry items" packing list — two phases (shared
Las Vegas & China carry items, then China-only extras) and their sub-sections are
preserved in `lib/seed-data.ts`.

## Getting started

```bash
npm install      # already done if you see node_modules/
npm run dev      # start the dev server
```

Then open <http://localhost:3000>.

To build and run a production server:

```bash
npm run build
npm start
```

## How it works

| Piece | File | What it does |
| --- | --- | --- |
| Seed data | `lib/seed-data.ts` | The packing list transcribed from Lionel's carry-items list. Seeds the DB on first run. |
| Database | `lib/db.ts` | `@libsql/client` connection, schema, seeding, and queries (file locally, Turso in prod). |
| Read API | `app/api/items/route.ts` | `GET /api/items` → all items. |
| Update API | `app/api/items/[id]/route.ts` | `PATCH /api/items/:id` `{ "done": true }` → toggle one item. |
| Reset API | `app/api/reset/route.ts` | `POST /api/reset` → uncheck everything. |
| UI | `app/page.tsx`, `app/Checklist.tsx` | Server-rendered list + interactive client checklist with optimistic updates. |

The database lives at **`data/packing.db`** and is git-ignored — it's your personal
state, not source. Checking a box does an optimistic UI update and a `PATCH`; if the
write fails, the checkbox rolls back and an error is shown.

## Deploying to Vercel (with Turso)

Vercel runs serverless functions with a **read-only, ephemeral filesystem**, so a
local SQLite *file* can't work there. Instead, production uses **Turso** (hosted
libSQL — same SQL). The code already switches automatically: it uses the local
file unless `TURSO_DATABASE_URL` is set.

One-time setup:

```bash
# 1. Install the Turso CLI + log in (free)
brew install tursodatabase/tap/turso     # or: curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup

# 2. Create a database seeded from your current data (imports all your items + state)
turso db create china-packing --from-file data/packing.db

# 3. Grab the connection details
turso db show china-packing --url        # -> libsql://china-packing-<org>.turso.io
turso db tokens create china-packing     # -> a long auth token
```

Then in the **Vercel project → Settings → Environment Variables**, add (for all
environments):

| Name | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | the `libsql://…turso.io` URL from step 3 |
| `TURSO_AUTH_TOKEN` | the token from step 3 |

Redeploy. The deployed app now reads/writes Turso and persists across requests.

> The `--from-file` import is a **one-time snapshot** of your current data. After
> that, Turso is the source of truth for the deployed app; the local file is just
> for development. To use Turso locally too, put the same two vars in `.env.local`.

## Backing up your local data to GitHub

The database `data/packing.db` is **tracked in git** so your checklist data is
backed up to the repo. It's a snapshot, though — the app writes to the local DB
as you use it, and those changes only reach GitHub when committed.

To keep it pushed **automatically after every change**, run this in a second
terminal alongside `npm run dev`:

```bash
npm run sync:db
```

It watches `data/packing.db` and commits + pushes it a few seconds after each
change (only the database file, never your code). Leave it running; Ctrl+C to
stop. The transient `-wal` / `-shm` sidecar files stay git-ignored.

## Resetting the data

- **Uncheck everything (keep the app running):** the **Reset** button in the header,
  or `curl -X POST http://localhost:3000/api/reset`.
- **Rebuild the DB from the seed (e.g. after editing `seed-data.ts`):**
  ```bash
  npm run reseed   # deletes data/packing.db; it re-seeds on next `npm run dev`
  ```
