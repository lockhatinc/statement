# Gemoci

Static SPA — no server. Runs entirely in the browser.

## Architecture

- `index.html` — entry point, loads GSI + JSZip CDN, mounts `src/app.js` as ES module
- `src/app.js` — OAuth state machine (no-auth → setting-up → has-key → processing), UI events, orchestrates setup+ocr+ods
- `src/setup.js` — provisions `gemoci-*` GCP project + enables Generative Language API; returns `{ token, projNum }`
- `src/ocr.js` — Gemini REST call (`gemini-2.0-flash` model) with OAuth Bearer auth + x-goog-user-project header
- `src/ods.js` — builds ODS (OpenDocument Spreadsheet) blob via JSZip

## Auth

Google Sign-In (GSI token client) with `cloud-platform + email` scope. On sign-in, `setup(token)` runs the GCP provisioning chain and returns `{ token, projNum }`. Stored in `window.__state.auth` (memory only, cleared on sign-out or reload).

State machine phases: `no-auth` → `setting-up` → `has-key` → `processing`.

OAuth client ID: `873801679825-ss0jff8jhitvm1v7pj2chh4qdlg108ob.apps.googleusercontent.com` (Web Application type in project `gemini-50279`, JS origin `https://lockhatinc.github.io`).

## Setup chain (src/setup.js)

1. Resolve email from tokeninfo endpoint
2. Derive deterministic `projectId = 'gemoci-' + 8charBase64EmailHash`
3. Search CRM v3 for project with label `gemoci:1` — reuse if found
4. If not found: create project, poll operation until done; 409 → GET existing by projectId
5. Enable `generativelanguage.googleapis.com` via serviceusage (idempotent, polls until done)
6. Return `{ token, projNum }`

All steps throw with clear messages on failure. No fallbacks.

## Gemini API auth

`Authorization: Bearer {token}` header + `x-goog-user-project: {projNum}` header. No API key. GCP API keys created via `apikeys.googleapis.com` do NOT receive Gemini Developer free-tier quota — only OAuth Bearer calls with `cloud-platform` scope route correctly to the user's project's free quota.

## Deploy

GitHub Actions Pages deployment (workflow source, not gh-pages branch). No secrets required. Client ID baked into `src/app.js`.
Live URL: `https://lockhatinc.github.io/statement/`
