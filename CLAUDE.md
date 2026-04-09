# Gemoci

Static SPA — no server. Runs entirely in the browser.

## Architecture

- `index.html` — entry point, loads JSZip CDN, mounts `src/app.js` as ES module
- `src/app.js` — API key state machine, UI events, orchestrates ocr+ods
- `src/ocr.js` — Gemini 2.0 Flash REST call with API key query param
- `src/ods.js` — builds ODS (OpenDocument Spreadsheet) blob via JSZip

## Auth

No Google OAuth. User pastes their own Gemini API key into a password input. Key stored in `window.__state.key` (memory only, cleared on page reload or "Clear key"). State machine: `no-key` → `has-key` → `processing`.

Gemini API key auth: `?key=<apiKey>` query param on the endpoint URL. No Authorization header.

The Generative Language API does not support user OAuth tokens for `generateContent` — only API keys work. Do not attempt to add OAuth scopes for this API.

## Deploy

GitHub Actions Pages deployment (workflow source, not gh-pages branch). No secrets required.
Live URL: `https://lockhatinc.github.io/statement/`

## Google Cloud setup

1. Enable the Generative Language API for the project
2. Create an API key in Credentials
3. Users obtain their own API key from https://aistudio.google.com/apikey
