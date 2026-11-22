# API data-load diagnosis (Railway deploy #206)

## Scope and evidence

Inspected Railway production deployment `a803f6e4-65a7-4f4f-8ab3-5d2dfacb40e7`, running commit `92962698500c29bfd63c8c87021162fc8fb4b935` (merge of PR #206).

- Deployment status: `SUCCESS`; service `hamzawy-backend-v2` is `Online` with 1/1 replicas.
- Runtime startup: `Sunaa server listening on port 8080`.
- Database startup: `✓ MongoDB متصل: ac-wqya0bm-shard-00-02.6otjzwx.mongodb.net`.
- No uncaught exception or runtime error was present in the inspected deploy log. The one `npm warn config production` line is a package-manager warning, not an app crash.
- Railway returned 184 HTTP records in the inspected deployment window. None had status >= 400.

## Exact API requests observed

All observed application data requests used same-origin `/api/...` paths and returned successful statuses:

| Request | Count | Status |
|---|---:|---:|
| `GET /api/services` | 4 | 200 |
| `GET /api/areas` | 4 | 200 |
| `GET /api/content` | 4 | 200 |
| `GET /api/client/me` | 1 | 200 |
| `GET /api/client/orders` | 2 | 200 |
| `GET /api/client/wallet` | 1 | 200 |
| `GET /api/notifications/client` | 6 | 200 |
| `GET /api/referrals/me/client` | 1 | 200 |
| `GET /api/wallet-settings` | 1 | 200 |
| `GET /api/store/advertisement/current` | 16 | 200 |
| `POST /api/page-visits` | 5 | 202 |
| `POST /api/csp-report` | 9 | 204 |

No failing API URL was observed in these HTTP logs. The frontend requests are same-origin on `https://www.hamzawy-sat.dynv6.net`: technician startup calls `/api/services`, `/api/areas`, and `/api/content?role=fanni`; client startup calls `/api/services`, `/api/areas`, and `/api/content?role=client`. Railway's HTTP log path field omits query strings, so it records the content request as `/api/content`. The HTTP log stream records status/path/timing, not response bodies or Content-Type, so it cannot prove the exact live response bytes. A direct external curl attempt from this session could not resolve the public hostname. The route source does show that `/api/areas`, `/api/services`, and `/api/content` finish with Express `res.json(...)`: `/api/areas` returns `{ ok, areas, technicianCountByArea }`; `/api/services` returns `{ ok, categories, services }`; `/api/content` returns `{ siteName, maintenance, maintenanceMessage, announcement, faqs }`. These are JSON handlers, not static HTML routes.

## Root causes found in the frontend

1. **Technician dashboard render crash:** `frontend/js/fanni-render.js` declared `const user = currentUser || getUser()` but built the header initial from `t?.name`. There is no `t` binding in that scope. Evaluating an optional chain on an undeclared identifier still throws `ReferenceError`, which is caught by the dashboard renderer and replaced with the exact fallback text “تعذر عرض بيانات الصفحة حاليًا.” This explains why the API requests can succeed while the screen still shows the error. Fixed to use `user?.name`.

2. **Client splash overlay never dismissed:** `frontend/client.html` contains a full-screen `#clientLoadingOverlay` whose CSS only hides it when `is-hidden` is added. The client startup handler launched `loadServices()`, `loadPublicContent()`, and `initializeClientAccount()` but never added that class. The overlay therefore remained above the rendered app. Fixed by awaiting those startup tasks with `Promise.allSettled` and then adding `is-hidden`.

## Review of the two server changes

- PR #205 changed the frontend artifact to `frontend-dist` and made startup validate it. PR #206 moved API routers and the API 404 handler above the static middleware.
- Current order is correct: API middleware/routers and `/api` 404 are registered before the two `express.static(frontendPath, ...)` middlewares.
- `index: false` was already present in the pre-PR-205 `src/server.js`; it was not introduced by either recent server change. Explicit page handlers serve `/`, `/client`, and `/fanni`.
- `fallthrough: false` belongs to the separate `/images` static middleware and was also present before PR #205. Railway HTTP logs show `/images/LOGO_UPLOAD_HERE/logo.png` returning 200.
- No server.js change was needed for these diagnosed frontend failures.

## Changed files in this branch

- `frontend/js/fanni-render.js`: use the already-defined `user` variable instead of the undefined `t`.
- `frontend/js/client-actions.js`: dismiss the client loading overlay after the initial startup tasks settle.
- This diagnostic note.

No merge or Railway deploy was performed from this branch.