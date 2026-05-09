## Learned User Preferences

- Prefer the `cursor/` branch prefix for Cursor-driven work (for example `cursor/short-description`).
- Prefer Bun instead of npm for dependency installs and workspace scripts in this repository.
- Prefer the boring, minimal task primitive direction for the product model; keep concepts abstracted away from Cascades-specific package/event/trip interfaces where possible.
- For Impeccable UI work, run the context gates and command references before editing, emit the required `IMPECCABLE_PREFLIGHT` line before mutations, do not skip visual probe discussion, and preserve the established product/design context.
- For ReBAC UI polish, prefer flat page-native structure over nested card wrappers; keep org/user rows edge-to-edge with backgrounds only for hover, focus, drop target, selection, or current state.

## Learned Workspace Facts

- Git remote: https://github.com/pbroom/snowball.git
- Monorepo centers on a ReBAC task workbench: `apps/rebac-workbench` plus `packages/task-core`, `packages/authz-core`, and `packages/scenario-store`, with JSON scenarios, a local authorization evaluator that returns explanation paths, and a boundary for future SpiceDB or OpenFGA adapters.
- Broader product intent for the prototype includes enterprise tasking and clearing with ReBAC, deployable self-hosted or on cloud nodes, OIDC with Okta or Microsoft Entra ID, Azure AD sync feeding authorization inputs, SharePoint and Microsoft 365 Word/Excel/PowerPoint interactions, SharePoint and document permission management, strong operational and audit logging, Word formatting fidelity, and an API-first surface so AI agents can act on behalf of users and admins.
- The primary UI app is a Vite React workbench at `apps/rebac-workbench` using Tailwind CSS v4 and shadcn/ui (`components.json` in the app); project scripts and shadcn commands should use Bun (`bun`, `bunx --bun`).
- The workbench includes a light/dark/system theme path: `apps/rebac-workbench/src/theme-provider.tsx`, `src/components/theme-toggle.tsx`, and an inline first-paint theme script in `index.html`; the `localStorage` key is `theme`.
- Impeccable context is established with `PRODUCT.md`, `DESIGN.md`, and `.impeccable/design.json`; the design direction is a compact ReBAC field notebook with emerald primary language, not teal.
- The ReBAC identity surface uses a React Aria drag-and-drop Tree, row dropdown actions, inline add/rename editing, a D3 org chart, and a Zustand store at `apps/rebac-workbench/src/workbench-store.ts`.
