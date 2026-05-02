# AGENTS.md — Breadcrumbs v2

## Cursor Cloud specific instructions

### Overview

Breadcrumbs is a Next.js 16 (App Router) application with Supabase (hosted) for data/auth and Anthropic Claude for AI features. See `CLAUDE.md` for full architecture and code conventions.

### Prerequisites

- **Node.js 20** via nvm (installed at `~/.nvm`). Load with:
  ```
  export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  ```
- **npm** as the package manager (lockfile: `package-lock.json`)

### Common commands

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 3000) |
| Build | `npm run build` |
| Tests | `npm test` (vitest, 68 tests across 6 files) |
| Type check | `npx tsc --noEmit` |

### Gotchas

- **No ESLint config**: The repo has `eslint` and `eslint-config-next` installed but no `.eslintrc*` or `eslint.config.*` file. `next lint` was removed in Next.js 16. Running `npx eslint` will fail without creating a config first.
- **Next.js 16 middleware deprecation**: The `middleware.ts` file triggers a warning about using `proxy` instead. This is cosmetic and does not affect functionality.
- **Environment validation**: `src/lib/env.ts` strictly validates env vars on first API request. Placeholder values (starting with `your_` or `YOUR_`) will throw. For local dev without real Supabase/Anthropic credentials, use `.env.local` with dummy values that don't start with `your_` (e.g. `placeholder-anon-key`). The home page, login, and signup pages work without valid credentials; API routes will fail.
- **Tests mock all externals**: Vitest tests mock Supabase, Anthropic, and `next/headers` — they run without any real credentials or services.
- **Auth middleware**: Routes `/capture`, `/archive`, `/foundation`, `/ask` are protected by Supabase auth middleware. Without a real Supabase connection, these redirect to `/login`. Unprotected pages: `/`, `/login`, `/signup`, `/setup`.
