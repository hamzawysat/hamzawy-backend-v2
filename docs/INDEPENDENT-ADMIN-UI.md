# Independent Admin UI artifact

The `frontend/admin.html` page is the entry point for the Kotlin WebView admin app. The `build:admin` command creates a separate static artifact at `admin-dist/` without changing the existing `frontend-dist/` build or the client/technician entry pages.

## Build

```bash
npm run build:admin
```

The artifact preserves root-relative paths and includes shared runtime resources needed by the admin page. It excludes unrelated public entry pages and the one-time `admin-setup.html` bootstrap page plus its script. The shared `password.html` account page is included because the admin client/technician editor opens it for profile editing and account recovery. The bundle is a separate deployable artifact, but it is not yet a minimal admin-only source tree because some runtime assets remain shared.

The build validates the static dependency closure reachable from both `admin.html` and the shared `password.html` account page through HTML, CSS and JavaScript references. CI serves the generated artifact independently and browser-smoke-tests both entry points, including their local assets and runtime page errors. This catches missing statically referenced files; it cannot prove that every dynamically constructed URL or runtime code path works. Those still require staging tests.

## Hosting contract

The artifact is static UI only. It does not include, duplicate, or replace the API, authentication, MongoDB, or GridFS data.

A host for this artifact must:
- Serve the artifact at the URL configured in the Kotlin WebView.
- Preserve root-relative asset paths.
- Route `/api/*` to the existing backend through a same-origin reverse proxy.
- Keep private admin routes private and never publish API credentials or secrets in static files.
- Apply no-cache/revalidation headers to HTML and suitable versioned caching to static assets.
- Keep backend CORS/CSP allowlists aligned with the actual browser origin if cross-origin requests are deliberately introduced. The backend reads exact HTTP(S) origins from `ALLOWED_ORIGINS` and applies that validated list to both CORS and CSP `connect-src`; do not use wildcard origins.

## Portability boundary

The build output contains no Railway-specific deployment configuration and does not select a permanent hosting provider. The API and database remain separate from this static UI artifact.

Notification click routing in `frontend/service-worker.js` now resolves against the origin serving the worker, while accepting the known previous hosts only as incoming legacy links. The admin page loads `web-push.js`, which registers that worker at the site root. This removes one hard-coded production-origin dependency, but it is not proof of a safe migration: service-worker scope, existing subscriptions, push delivery, trusted WebView host configuration, and the same-origin `/api/*` reverse proxy still require staging verification.

The current Kotlin app still validates the existing Hamzawy Sat host and private admin path. This artifact build does not weaken that host allowlist. A host/domain migration requires a separately reviewed, secure app configuration change and matching backend proxy/CORS/CSP setup.

## Validation status

The build checks static HTML/CSS/JS dependency references for the admin dashboard and its shared account editor, and excludes the one-time bootstrap page. CI also runs an isolated browser smoke test against the generated static artifact. A successful artifact build is not equivalent to a live staging integration test. Authentication, recovery, image upload/read, notifications, service-worker behavior, WebView navigation, and caching must all be exercised against a non-production staging origin before enabling a separate deployment.
