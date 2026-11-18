# Web (Vue 3 + Vite + TypeScript)

Lives beside the backend of the same monorepo: the API is `src/app`, the
deployment assets are in `docker/`, and this folder is the only frontend.

The repository uses **npm** and commits `package-lock.json`; keep using npm until
the team explicitly migrates package management (the folder layout no longer
depends on the package manager).

```bash
npm ci --no-audit --no-fund
npm run dev        # http://localhost:5173, proxies /api to http://localhost:8000
npm run typecheck
npm run lint
npm run test
npm run build
```

## Local preview and authentication

- `npm run dev` opens the workspace without a login prompt.
- Preview session and the in-memory mock API are enabled only when `import.meta.env.DEV` is true.
- Preview records are sample data and never reach backend services or AI providers.
- Production builds ship neither the preview session nor the mock adapter.

## Directory conventions

- `src/api`: fetch client (`index.ts`) plus one module per backend domain (`auth`, `users`, `organizations`, `roles`, `projects`); `mock.ts` is the dev-only adapter.
- `src/components`: cross-domain components. `src/views/{domain}`: page entry points with optional domain-private `components/`.
- `src/composables`: reusable Composition API logic. `src/layouts`: workspace/auth/admin shells.
- `src/router/modules`: one route module per domain, aggregated in `router/index.ts`.
- `src/stores`: `index.ts` (Pinia instance only) plus one store per domain (`auth.ts`).
- `src/styles`: global styles. `src/types`: API (`api.d.ts`) and env (`env.d.ts`) declarations. `src/utils`: pure helpers.
- `tests/unit` runs in CI; `tests/e2e` needs the optional Playwright toolchain (see `tests/e2e/README.md`).
- `public`: served without bundling. `src/assets`: imported images, fonts and icons.

## Implemented UI

- M1: workspace shell, login/logout, overview, projects, users, RBAC role listing, organizations/departments.
- M2: story bible, episodes/scripts, character/scene/prop asset library, storyboard and Shot Contract detail.
- M3/MVP prototype: AI task tracking, QA/review states, lightweight multi-track timeline, MP4 export profile and history.
- Shared: responsive navigation, Bearer token injection, normalized API errors, dev-only mock injection.

Production-domain screens use local preview records; they do not claim to perform real
generation, approval, media upload/download, FFmpeg rendering or persistent production
operations. See `docs/api_todo.md` for backend contract gaps.
