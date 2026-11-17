# Frontend development

Vue 3 + Vite + TypeScript. The repository currently uses **npm** and commits `package-lock.json`; use npm consistently until the team explicitly migrates package management.

```bash
npm ci --no-audit --no-fund
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

## Local preview and authentication

- `npm run dev` automatically opens the workspace without a login prompt.
- Preview session and in-memory demo API are enabled only when `import.meta.env.DEV` is true.
- Preview records are sample data and are not sent to backend services or external AI providers.
- Production builds do not enable preview authentication or mock adapters; normal authentication and API calls remain required.

## Directory conventions

- `src/api`: shared fetch client plus domain API modules (`auth`, `users`, `organizations`, `roles`, `projects`).
- `src/components`: cross-domain reusable components; `src/views/{domain}`: page entry points and domain-private UI.
- `src/composables`: reusable Composition API logic; `src/layouts`: workspace/auth/admin shells.
- `src/router/modules`: domain route records; `src/stores`: Pinia instance and domain stores.
- `src/styles`: global style entry; `src/types`: API and environment declarations; `src/utils`: pure helpers.
- `tests/unit` and `tests/e2e`: unit and future browser tests. Playwright is not installed yet; add its dependency and browser setup before enabling E2E scripts.
- `public`: files served without bundling; `src/assets`: imported images, fonts and icons.

## Implemented UI

- M1: workspace shell, login/logout, overview, projects, users, RBAC role listing, organizations/departments.
- M2: story bible, episodes/scripts, character/scene/prop asset library, storyboard and Shot Contract detail.
- M3/MVP prototype: AI task tracking, QA/review states, lightweight multi-track timeline, MP4 export profile and history.
- Shared: responsive navigation, Bearer token injection, normalized API errors and development-only mock injection.

Production-domain screens currently use local preview records. They do not claim to perform real generation, human approval, media upload/download, FFmpeg rendering or persistent production operations. See `docs/api_todo.md` for backend contract gaps.

## Delivery verification

Formal release integration targets `main` from a `release/*` branch after required CI and repository policy checks pass.
