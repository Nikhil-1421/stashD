# stashD

A universal trading-card collection platform: track sets across games, define what "complete"
means for you, tap through sets with Bubble Check, and plan physical binders. Private per-user
data on Supabase; React + TypeScript frontend on Netlify.

**Status:** milestone 1 (foundation) — app shell, authentication, profiles, dashboard empty state.
Collection features are on the roadmap (`docs/ROADMAP.md`) and are not built yet.

## Setup

Requirements: Node ≥ 22.22, Docker Desktop (for the local database).

```bash
npm install
cp .env.example .env.local        # then fill in the two Supabase values
npm run db:start                  # local Supabase in Docker; prints API URL and anon key
npm run db:reset                  # apply migrations
npm run dev                       # http://localhost:5173 (also exposed on your LAN for phone testing)
```

- Put the printed **API URL** in `VITE_SUPABASE_URL` and the **anon key** in
  `VITE_SUPABASE_ANON_KEY`. Never use the service-role key in the app.
- Local sign-up/reset e-mails appear at http://localhost:54324.
- Using a hosted Supabase project instead? Use its URL/anon key, set Site URL and redirect URLs to
  `http://localhost:5173/**`, enable email confirmation, and apply migrations with
  `npx supabase db push` after `npx supabase link`.

## Commands

```bash
npm run check        # typecheck + lint + tests + build
npm run test:watch
npm run db:test      # pgTAP RLS tests against the local database
npm run db:types     # regenerate src/lib/supabase/database.types.ts
```

## Documentation
- `docs/ARCHITECTURE.md` — stack, layering, source layout
- `docs/DECISIONS.md` — why things are the way they are
- `docs/DATABASE_SCHEMA.md` — tables, RLS matrix, indexes, target ERD
- `docs/ROADMAP.md` — phases, status, blockers
- `docs/REFERENCE_APPLICATION_ANALYSIS.md` — what the original app does
- `docs/DEVELOPMENT.md`, `docs/DEPLOYMENT.md`, `docs/CARD_DATA_SOURCES.md`,
  `docs/BINDER_SYSTEM.md`, `docs/IMPORT_FORMATS.md`

## Security notes
Row Level Security guards every user table; the browser only ever holds the public anon key;
`.env*` files are git-ignored except `.env.example`.
