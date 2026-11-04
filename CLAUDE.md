# CLAUDE.md — Collector Platform Engineering Rules

## Mission
Build a polished, secure, responsive universal trading-card collection platform. The reference application is https://timely-souffle-0c4e55.netlify.app. Preserve and improve its observable functionality, especially Bubble Check, while expanding into multi-user collections, flexible checklists, variants, binder planning, sharing, and catalog integrations.

## Operating rules
- Inspect the repository and existing app before changing architecture. Do not overwrite working code blindly.
- Use browser tools available in the environment to inspect the reference. If access is blocked, document the limitation and proceed from observable behavior; never fabricate a feature inventory.
- Work in small, verifiable vertical slices. Do not stop after writing a plan; implement the next useful milestone.
- Before a significant change: state the goal, inspect affected files, identify risks, and choose the smallest coherent implementation.
- After changes: run relevant tests, type checks, lint, and build; fix failures you introduced. Report commands and outcomes honestly.
- Never claim a feature, test, deployment, migration, or integration works unless you verified it.
- Avoid placeholder buttons and fake functionality. Clearly label demo/seed data.
- Ask for human approval before destructive database actions, production migrations, deleting user data, changing auth/security behavior, or introducing paid services.
- Do not expose secrets. Never commit `.env`, service-role keys, tokens, credentials, or private user data. Use `.env.example` with placeholders.
- Prefer accessible semantic HTML, keyboard support, reduced-motion respect, useful loading/empty/error states, and mobile touch targets.
- Keep dependencies minimal and verify package/API compatibility before adopting.
- Use strict TypeScript; avoid `any`, unsafe casts, and duplicated business logic.
- Keep UI, domain logic, persistence, and external-provider adapters separated.
- Use migrations for schema changes. RLS is mandatory for private user data; frontend filters are not security.
- Catalog content and card images have licensing/terms constraints. Do not bypass access controls, scrape disallowed sources, or assume artwork may be redistributed.
- Optimize for thousands of cards: pagination/virtualization where appropriate, indexes, debounced search, batched updates, and no needless whole-binder rewrites.
- Persist user work safely; use optimistic updates only with rollback/error handling.
- Maintain documentation as decisions change.

## Product invariants
1. Global catalog data is distinct from user collection data.
2. A card identity, a printing/variant, an ownership record, a collection requirement, and a binder placement are separate concepts.
3. Users can create custom sets without an external catalog provider.
4. Collection requirement changes never erase ownership history.
5. Physical binder organization is independent of whether a card is owned.
6. Binder pages support configurable rows/columns and empty slots.
7. A card/variant can appear in multiple binder slots when appropriate.
8. User private data is only accessible to its owner unless explicitly shared.
9. Free initial experience; no billing now. Future entitlements must be isolated behind a service/policy layer.
10. External provider outages must not make manual checklists or local collection tracking unusable.

## Preferred stack (adapt only with a documented reason)
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui as useful
- React Router
- TanStack Query for server state
- Zustand only for justified client state
- Supabase Auth, PostgreSQL, Storage, RLS, migrations
- Netlify frontend deployment
- Vitest and Playwright
- A maintained drag/drop library compatible with React and touch

## UI direction
- Minimal, premium dark theme: near-black/charcoal surfaces, restrained accent, clear typography, subtle borders, generous spacing.
- Avoid generic SaaS clutter, neon-heavy gradients, oversized rounding, decorative noise, and modal-heavy flows.
- Responsive desktop/mobile; desktop optimized for bulk management and binder canvas, mobile for quick status updates and browsing.
- Shared tokens/components, consistent focus states, and accessible contrast.

## Workflow
- Keep `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/DATABASE_SCHEMA.md`, `docs/REFERENCE_APPLICATION_ANALYSIS.md`, `docs/CARD_DATA_SOURCES.md`, `docs/BINDER_SYSTEM.md`, `docs/IMPORT_FORMATS.md`, `docs/DEVELOPMENT.md`, and `docs/DEPLOYMENT.md` current.
- Record consequential decisions with context and tradeoffs in `docs/DECISIONS.md`.
- Maintain a prioritized `docs/ROADMAP.md`; mark status accurately.
- Prefer feature branches and focused commits if Git is available; never rewrite shared history.
- On each milestone, provide: implemented, files changed, tests/checks, known limitations, and next milestone.

## Definition of done for a feature
- Real end-to-end behavior exists (not just UI).
- Data model and authorization are correct.
- Validation and error states are present.
- Tests cover meaningful domain behavior.
- Responsive and accessible behavior has been checked.
- Documentation is updated.
- Build/typecheck/lint/tests pass, or remaining failures are clearly reported.
