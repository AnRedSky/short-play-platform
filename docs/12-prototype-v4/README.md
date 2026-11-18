# Prototype V4 — API-backed product prototype

Tracking: GitHub Issue #61.

## Purpose

V4 replaces the standalone HTML demonstration with the repository's production Vue 3 application surface. It is intended for product review and user testing against a running backend, not as an offline clickable mock.

## Runtime

- Frontend: `web/` (Vue 3, TypeScript, Pinia, Vue Router, Vite).
- API base: `VITE_API_BASE_URL`, default `/api/v1`.
- Authentication: existing session store and bearer-token API client.
- Project boundary: all production routes include `:projectId`; the router guard verifies project access in production builds.
- Data: server responses only. No locally seeded business records and no success state before a successful API response.
- Binary files: authenticated API download; uploads use multipart/form-data.
- Responsive layout: existing shared design tokens plus module-specific responsive styles.

## Start locally

1. Start the backend and its configured PostgreSQL/Redis dependencies using the repository README.
2. Apply migrations and start the API.
3. In `web/`, install from the lockfile and run the Vite development server.
4. Sign in using a real backend account. Do not enable preview/mock mode for acceptance.
5. Open a real project from Project Space.

## Important acceptance rule

A backend route being registered is not proof of a complete business workflow. Where the backend currently lacks a list/read/update or lifecycle endpoint, the UI explicitly reports that contract gap and does not manufacture records or success feedback. These pages are not considered complete until the gap is closed and tested against a real API.
