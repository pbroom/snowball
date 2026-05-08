# Snowball

Monorepo for experimenting with **relationship-based access control (ReBAC)** around a task shell: a Vite + React workbench edits org graphs, tasks, and permissions, backed by small TypeScript libraries for authorization and scenario persistence.

## Requirements

- [Bun](https://bun.sh) 1.3.1 (see `packageManager` in the root `package.json`)

## Setup

```bash
bun install
```

## Scripts (repo root)

| Script        | Description |
|---------------|-------------|
| `bun run dev` | Start the ReBAC workbench dev server (`apps/rebac-workbench`). |
| `bun run build` | TypeScript project references build, then Vite production build for the workbench. |
| `bun run typecheck` | `tsc -b` across workspaces. |
| `bun run test` | Run Vitest once. |
| `bun run test:watch` | Vitest watch mode. |
| `bun run lint` | ESLint on the repo. |

## Repository layout

- **`apps/rebac-workbench`** — **ReBAC Task Workbench**: local UI to model scenarios (users, orgs, relationships), run permission checks, and persist scenarios (e.g. browser storage via `@snowball/scenario-store`).
- **`packages/task-core`** — Shared types and domain model: entities, tasks, resources, relationships, permissions.
- **`packages/authz-core`** — Authorization logic (e.g. permission checks and visibility) over `Scenario` data.
- **`packages/scenario-store`** — Load/save/validate scenarios and related helpers (seed data, auditing).

TypeScript config uses project references (`tsconfig.json`, `tsconfig.base.json`).

## Contributing

Use the scripts above for typecheck, tests, and lint before opening a change. Pull requests welcome.

## License

This project is licensed under the [MIT License](LICENSE).
