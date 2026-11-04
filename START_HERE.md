# Start Here — Claude Code

Read `CLAUDE.md` and `prompts/IMPLEMENTATION_BRIEF.md` completely. Treat `docs/` specifications as supporting requirements.

Begin by inspecting the current repository and the reference application:
https://timely-souffle-0c4e55.netlify.app

Write an evidence-based reference analysis, architecture, decisions, and phased roadmap. Then implement the first working milestone rather than stopping at planning.

First milestone acceptance:
- responsive dark app shell and navigation
- Supabase environment/config handling (no credentials committed)
- authentication screens and protected routes
- profile migration and owner-only RLS
- dashboard empty state/onboarding
- README setup steps
- test/typecheck/lint/build commands passing (or document external blockers precisely)

After that, continue through the roadmap in vertical slices. Ask before destructive/production actions. Never fake integrations or claim unverified success.
