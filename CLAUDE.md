# Gemoci

Static SPA — no server. Runs entirely in the browser.

## Architecture

- `index.html` — entry point, loads GSI + JSZip CDN, mounts `src/app.js` as ES module
- `src/app.js` — OAuth state machine (no-auth → setting-up → has-key → processing), UI events, orchestrates setup+ocr+ods
- `src/setup.js` — idempotently provisions a Gemini API key via GCP APIs using OAuth token
- `src/ocr.js` — Gemini REST call (`gemini-2.0-flash` model) with API key query param
- `src/ods.js` — builds ODS (OpenDocument Spreadsheet) blob via JSZip

## Auth

Google Sign-In (GSI token client) with `cloud-platform + email` scope. On sign-in, `setup(token)` runs the GCP provisioning chain. Key stored in `window.__state.key` (memory only, cleared on sign-out or reload).

State machine phases: `no-auth` → `setting-up` → `has-key` → `processing`.

OAuth client ID: `873801679825-ss0jff8jhitvm1v7pj2chh4qdlg108ob.apps.googleusercontent.com` (Web Application type in project `gemini-50279`, JS origin `https://lockhatinc.github.io`).

## Setup chain (src/setup.js)

1. Resolve email from tokeninfo endpoint
2. Derive deterministic `projectId = 'gemoci-' + 8charBase64EmailHash`
3. Search CRM v3 for project with label `gemoci:1` — reuse if found
4. If not found: create project, poll operation until done; 409 → GET existing by projectId
5. Enable `generativelanguage.googleapis.com` and `apikeys.googleapis.com` via serviceusage in parallel (idempotent)
6. List API keys — find key with `displayName='gemoci'`; if found, call getKeyString
7. If not found: create key restricted to `generativelanguage.googleapis.com`, poll operation, return `keyString`
8. Key create/list retries up to 20× with 6s delay — GCP apikeys API takes up to 120s to propagate after enable

All steps throw with clear messages on failure. No fallbacks.

## Gemini API auth

`?key=<apiKey>` query param on the endpoint URL. No Authorization header. OAuth tokens cannot be used for `generateContent` — API key provisioning is the workaround.

## Deploy

GitHub Actions Pages deployment (workflow source, not gh-pages branch). No secrets required. Client ID baked into `src/app.js`.
Live URL: `https://lockhatinc.github.io/statement/`
