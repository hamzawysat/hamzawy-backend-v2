# Independent Admin UI artifact

The `frontend/admin.html` page is the entry point for the Kotlin WebView admin app. The `build:admin` command creates a separate static artifact at `admin-dist/` without changing the existing `frontend-dist/` build or the client/technician entry pages.

## Build

```bash
npm run build:admin
```

The artifact preserves root-relative paths and includes shared runtime resources needed by the admin page. It excludes unrelated public entry pages and the one-time `admin-setup.html` bootstrap page plus its script. The bundle is a separate deployable artifact, but it is not yet a minimal admin-only source tree because some runtime assets remain shared.

The build validates the static dependency closure reachable from `admin.html` through HTML, CSS and JavaScript references. This catches missing statically referenced files; it cannot prove that every dynamically constructed URL or runtime code path works. Those still require staging tests.

## Hosting contract

The artifact is static UI only. It does not include, duplicate, or replace the API, authentication, MongoDB, or GridFS data.

A host for this artifact must:
- Serve the artifact at the URL configured in the Kotlin WebView.
- Preserve root-relative asset paths.
- Route `/api/*` to the existing backend through a same-origin reverse proxy.
- Keep private admin routes private and never publish API credentials or secrets in static files.
- Apply no-cache/revalidation headers to HTML and suitable versioned caching to static assets.
- Keep backend CORS/CSP allowlists aligned with the actual browser origin if cross-origin requests are deliberately introduced.

## Portability boundary

The build output contains no Railway-specific deployment configuration and does not select a permanent hosting provider. The API and database remain separate from this static UI artifact.

Important: `frontend/service-worker.js` currently contains the production Hamzawy Sat origin for notification click routing. The admin page also loads `web-push.js`, which registers that service worker at the site root. Therefore this artifact must not be activated on a different origin until notification routing and service-worker scope are made origin-neutral and tested. A same-origin `/api/*` reverse proxy is also mandatory for the current relative API calls.

The current Kotlin app still validates the existing Hamzawy Sat host and private admin path. This artifact build does not weaken that host allowlist. A host/domain migration requires a separately reviewed, secure app configuration change and matching backend proxy/CORS/CSP setup.

## Validation status

The build checks static HTML/CSS/JS dependency references and excludes the one-time bootstrap page. A successful artifact build is not equivalent to a live staging integration test. Authentication, recovery, image upload/read, notifications, service-worker behavior, WebView navigation, and caching must all be exercised against a non-production staging origin before enabling a separate deployment.
