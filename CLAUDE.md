# CLAUDE.md — Project Context for Legacy Wisdom Stream

## Project Overview
Legacy Wisdom Stream is a React + TypeScript web (and mobile via Capacitor) app that lets creators capture and share life wisdom with recipients. Built with Lovable, Vite, shadcn/ui, Tailwind CSS, and Supabase.

## Tech Stack
- **Framework**: React 18 + TypeScript
- **Build tool**: Vite
- **UI**: shadcn/ui (Radix primitives) + Tailwind CSS
- **Backend/Auth/DB**: Supabase (`@supabase/supabase-js`)
- **Mobile**: Capacitor (iOS + Android)
- **Forms**: React Hook Form + Zod
- **Routing**: React Router DOM v6
- **Data fetching**: TanStack React Query
- **Animation**: Framer Motion

## Project Structure
```
src/
  pages/          # Route-level views (Landing, Auth, Index, creator/, recipient/, etc.)
  components/     # Shared UI components (layout, gamification, ui/, etc.)
  hooks/          # Custom React hooks
  integrations/   # Supabase client and type definitions
  lib/            # Utility functions
```

## Key Conventions
- Use `bun` for package management (bun.lockb present)
- Components follow shadcn/ui patterns — prefer composing from `src/components/ui/`
- Supabase client lives in `src/integrations/`
- Two primary user roles: **creator** (captures wisdom) and **recipient** (views wisdom)

## Common Commands
```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # ESLint
```

## Notes
- Originated from Lovable (lovable-tagger in devDeps); changes pushed here sync back to Lovable
- Capacitor config at `capacitor.config.ts` for mobile builds
- Supabase config/migrations in `supabase/`
