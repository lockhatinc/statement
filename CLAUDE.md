# Gemoci

Static SPA — no server. Runs entirely in the browser.

## Architecture

- `index.html` — entry point, loads JSZip CDN, mounts `src/app.js` as ES module
- `src/app.js` — API key state machine (no-key → has-key → processing), UI events, orchestrates ocr+ods
- `src/ocr.js` — Gemini REST call (`gemini-2.0-flash-exp` model) with `?key=` query param auth
- `src/ods.js` — builds ODS (OpenDocument Spreadsheet) blob via JSZip

## Auth

User pastes their own Gemini API key from aistudio.google.com/apikey. Key stored in `window.__state.key` (memory only, cleared on page reload or "Change key").

State machine phases: `no-key` → `has-key` → `processing`.

No OAuth, no GCP provisioning, no server-side secrets.

## Gemini API auth

`?key={apiKey}` query parameter on `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`. Uses AI Studio free-tier quota tied to the user's own API key.

## Deploy

GitHub Actions Pages deployment (workflow source, not gh-pages branch). No secrets required.
Live URL: `https://lockhatinc.github.io/statement/`
