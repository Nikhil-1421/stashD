# Development

## Prerequisites
- Node ≥ 22.22 (the project was built with Node 26 LTS). `node -v` to check.
- Docker Desktop (for the local Supabase stack).
- The Supabase CLI is installed as a dev dependency; use `npx supabase …` or the npm scripts.

## First run
```bash
npm install
cp .env.example .env.local
npm run db:start          # starts Postgres/Auth/Studio in Docker; prints API URL + anon key
# paste API URL and anon key into .env.local
npm run db:reset          # applies supabase/migrations + seed.sql
npm run dev               # http://localhost:5173, plus a Network URL for phones on the same Wi-Fi
```
Local auth emails (verification, password reset) are captured at http://localhost:54324.
Supabase Studio: http://localhost:54323.

## Scripts
| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server; `server.host = true` so it also listens on the LAN (macOS may ask to allow Node through the firewall) |
| `npm run typecheck` | `tsc -b` (strict) |
| `npm run lint` | oxlint |
| `npm run test` / `test:watch` | Vitest (jsdom) |
| `npm run build` | typecheck + production build to `dist/` |
| `npm run check` | all of the above in sequence |
| `npm run db:start` / `db:stop` | local Supabase stack |
| `npm run db:reset` | recreate the local DB from migrations + seed |
| `npm run db:test` | run pgTAP tests in `supabase/tests/database` |
| `npm run db:types` | regenerate `src/lib/supabase/database.types.ts` from the local schema |

## Conventions
- Strict TypeScript; no `any`, no non-null assertions in app code; discriminated unions for state.
- Feature folders own their API, pages and tests. Pure domain logic has no React/Supabase imports.
- Every user-facing async action has loading, error and empty states.
- Forms: zod schema → `fieldErrors()` → `FormField` with `aria-describedby`.
- Tokens only (`bg-surface-1`, `text-fg-muted`, …); never raw hex in components.
- Schema changes are migrations: `npx supabase migration new <name>`; then `db:reset`, `db:test`,
  `db:types`.
- Never commit `.env*` (except `.env.example`) or any service-role key.

## Testing
- Unit/component: Vitest + Testing Library; helpers in `src/test/render.tsx` provide auth and
  entitlement contexts and a memory router.
- Mocking data modules: use `vi.mock('@/features/x/api', ...)` that delegates to a plain `let impl`
  variable you reassign per test. Do **not** combine `vi.fn()` + `mockReset()` with a rejecting
  implementation: in Vitest 5 the reset spy's settled-result tracking surfaces the rejection as an
  unhandled error and fails the test (observed 2026-11-04, `CollectionsPage.test.tsx`).
- Database: pgTAP files under `supabase/tests/database`, run by `npm run db:test`.
- E2E: Playwright (phase 10 scaffold) against the local stack.

## Troubleshooting
- "Setup required" page: `.env.local` missing or invalid; the page lists the exact problem.
- Sign-up says "check your inbox" locally: open http://localhost:54324 and click the link.
- `supabase start` fails: Docker is not running.
