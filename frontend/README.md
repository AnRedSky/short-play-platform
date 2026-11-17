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

## Implemented in this branch

- Authenticated application shell, login/logout and `/auth/me` permission loading.
- M1 workspace pages: overview, projects, users, RBAC role list, organizations/departments.
- Central API client with Bearer token injection, normalized API errors and an injectable mock adapter.
- Responsive desktop/mobile navigation and common loading/empty/error states.

## Pending integration

M2/M3 creation and generation screens, M4 workflow/review/quality, and M5 media/timeline/export screens remain to be implemented against the published OpenAPI contract. See `docs/api_todo.md` and `docs/product/page-map.md`. The repository currently has no approved visual design source; the page map is an information architecture, not a claim of visual-design sign-off.
