# Frontend development

Requires Node.js 22+ and npm.

```bash
npm ci --no-audit --no-fund
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

## Local UI preview

- Running `npm run dev` automatically opens the workspace without login.
- The preview session and demo API adapter are enabled only when `import.meta.env.DEV` is true.
- Preview records are in-memory sample data, clearly labeled in the UI, and are not sent to backend services or external AI providers.
- Production builds do not enable the preview session or mock adapter; normal authentication and API calls remain required.

## Implemented UI

- M1: authenticated shell, login/logout, overview, projects, users, RBAC role listing, organizations/departments.
- M2: story bible, episodes/scripts, character/scene/prop asset library, storyboard and Shot Contract detail.
- M3/MVP production flow: AI task tracking, QA/review states, lightweight multi-track timeline prototype, MP4 export profile and history prototype.
- Shared: responsive navigation, API adapter with Bearer token injection, normalized errors, mock injection point and API client tests.

## Integration boundary

Production-domain screens currently use local preview records. They do not claim to perform real generation, human approval, media upload/download, FFmpeg rendering or persistence. See `docs/api_todo.md` for confirmed routes and backend contract gaps. The repository does not yet contain an approved visual design system; current styling is an implementation prototype pending product/design sign-off.
