# Deployment

## Frontend — Netlify
`netlify.toml` builds with `npm run build`, publishes `dist/`, and rewrites all paths to
`index.html` for client-side routing. Security headers are set for every response.

Environment variables to configure in the Netlify site (never in the repo):
- `VITE_SUPABASE_URL` — project URL
- `VITE_SUPABASE_ANON_KEY` — anon (public) key only
- `VITE_APP_URL` — the site's public URL, used for auth e-mail redirects

Deploy previews work with the same variables; the app shows the setup page if they are missing.

## Backend — Supabase (hosted)
1. Create a project; note URL and anon key.
2. Authentication → URL configuration: set Site URL to the Netlify URL and add
   `https://<site>/**` to redirect URLs (needed for `/auth/callback` and `/reset-password`).
3. Enable "Confirm email" in Authentication → Providers → Email.
4. Apply migrations from CI or locally:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push --remote --yes   # after explicit approval; CLI 3 needs only the login token
   ```
   Production migrations are a human-approved step (see CLAUDE.md); never run them automatically
   from a dev machine without review.
5. Keep the service-role key in Supabase/CI secrets only.

## Checklist before going live
- `npm run check` green.
- RLS tests green against the target schema (`npm run db:test` locally, same migrations).
- Auth e-mails verified end-to-end on the deployed URL.
- Custom SMTP configured in Supabase for production e-mail deliverability.

## Bundle layout
Routes are lazy modules (`src/app/router.tsx`); `vite.config.ts` groups node_modules into `react`, `supabase`, `query`, `dnd` and `vendor` chunks so a deploy only invalidates the chunks whose contents changed. Netlify serves `dist/assets/*` with immutable caching by default (hashed names).
