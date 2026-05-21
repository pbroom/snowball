# AGENTS

## Learned User Preferences

- Prefer the `cursor/` branch prefix for Cursor-driven work (for example `cursor/short-description`).
- Prefer Bun instead of npm for dependency installs and workspace scripts in this repository.
- Prefer the boring, minimal task primitive direction for the product model; keep concepts abstracted away from Cascades-specific package/event/trip interfaces where possible.
- For Impeccable UI work, run the context gates and command references before editing, emit the required `IMPECCABLE_PREFLIGHT` line before mutations, do not skip visual probe discussion, and preserve the established product/design context.
- For ReBAC UI polish, prefer flat page-native structure over nested card wrappers; keep org/user rows edge-to-edge with single-line labels (entry counts and actor/title meta in `aria-label` only), leading avatars with initials on user rows, neutral background tokens for hover, focus, selection, and current user (not primary tints), and no borders or outlines on hover, focus, or selected states (drop-target drag affordance may keep border).
- For ReBAC D3 org chart highlights, use blue or neutral semantic tokens (`--primary`, `--muted`, `--border`, `--ring`); avoid purple, red, or off-brand `--chart-*` hues when chart tokens read purple.

## Learned Workspace Facts

- Git remote: https://github.com/pbroom/snowball.git
- Monorepo centers on a ReBAC task workbench: `apps/rebac-workbench` plus `packages/task-core`, `packages/authz-core`, and `packages/scenario-store`, with JSON scenarios, a local authorization evaluator that returns explanation paths, and a boundary for future SpiceDB or OpenFGA adapters.
- Broader product intent for the prototype includes enterprise tasking and clearing with ReBAC, deployable self-hosted or on cloud nodes, OIDC with Okta or Microsoft Entra ID, Azure AD sync feeding authorization inputs, SharePoint and Microsoft 365 Word/Excel/PowerPoint interactions, SharePoint and document permission management, strong operational and audit logging, Word formatting fidelity, and an API-first surface so AI agents can act on behalf of users and admins.
- The primary UI app is a Vite React workbench at `apps/rebac-workbench` using Tailwind CSS v4 and shadcn/ui (`components.json` in the app) with preset `b1ZzrZbpw` (radix-mira, blue primary, neutral base, Lucide for shadcn components); project scripts and shadcn commands should use Bun (`bun`, `bunx --bun`).
- The workbench includes a light/dark/system theme path: `apps/rebac-workbench/src/theme-provider.tsx`, `src/components/theme-toggle.tsx`, and an inline first-paint theme script in `index.html`; the `localStorage` key is `theme`.
- Impeccable context is established with `PRODUCT.md`, `DESIGN.md`, and `.impeccable/design.json`; the live workbench theme follows shadcn preset `b1ZzrZbpw` in `apps/rebac-workbench/src/styles.css` (blue/neutral), while Impeccable docs may still describe emerald.
- The ReBAC identity surface uses a React Aria drag-and-drop Tree with single-line rows, user avatars with initials, row dropdown actions, inline add/rename editing, a D3 org chart, and a Zustand store at `apps/rebac-workbench/src/workbench-store.ts`.
- ReBAC click-performance validation uses `bun run perf:rebac-clicks` with `PERF_URL=http://127.0.0.1:4173` against `bun run --cwd apps/rebac-workbench preview` on port 4173; the script defaults to port 5173, which may hit a different Vite app if another dev server is running.
