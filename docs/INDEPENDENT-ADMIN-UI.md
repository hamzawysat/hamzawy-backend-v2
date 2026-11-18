# Independent Admin UI artifact

The \`frontend/admin.html\` page is the entry point for the Kotlin WebView admin app. The \`build:admin\` command creates a separate static artifact at \`admin-dist/\` without changing the existing \`frontend-dist/\` build or the client/technician entry pages.

## Build

\`\`\`bash
npm run build:admin
\`\`\`

The build preserves root-relative paths such as \`/js/admin-core.js\`, \`/css/admin-layout.css\`, \`/web-push.js\`, and \`/images/...\`. Shared files are deliberately copied with the admin artifact so future edits to the client/technician pages do not have to be deployed with the admin UI.

## Hosting contract

The artifact is static UI only. It does not include, duplicate, or replace the API, authentication, MongoDB, or GridFS data.

A host for this artifact must:
- Serve the artifact at the URL configured in the Kotlin WebView.
- Preserve root-relative asset paths.
- Route \`/api/*\` to the existing backend through a same-origin reverse proxy, or provide an explicitly reviewed API-base configuration before using a different origin.
- Keep the admin entry path private/non-enumerable as currently required by the app, and never publish API credentials or secrets in static files.
- Apply appropriate no-cache/revalidation headers to HTML and immutable/versioned caching to fingerprinted assets.
- Permit the deployed admin origin in the backend's \`ALLOWED_ORIGINS\` when cross-origin API access is intentionally used.

## Portability boundary

The build output is provider-neutral. It contains no Railway-specific deployment configuration and does not select a permanent hosting provider. Moving the artifact between providers must not require moving the API or database.

The current Kotlin app still validates the existing Hamzawy Sat host and private admin path. This artifact build does not weaken that host allowlist. A host/domain migration requires a separately reviewed, secure app configuration change and a matching backend CORS/reverse-proxy setup.

## Validation

The build fails if a local root-relative reference declared directly in \`admin.html\` is absent from the artifact. Dynamic asset loads and runtime API behavior still require integration testing against a staging host before enabling a separate deployment.
