# Gemoci

OCR any image to an OpenDocument Spreadsheet using Gemini 2.0 Flash, with Google sign-in so each user runs on their own quota.

**Live**: https://lockhatinc.github.io/statement/

## How it works

1. Sign in with Google — grants access to the Gemini Generative Language API under your account
2. Drop or select an image (max 15 MB)
3. Click **Extract & Download ODS** — Gemini extracts the data, the browser builds and downloads the `.ods` file

No server. All processing runs in your browser using your OAuth token.

## Setup (self-host / development)

### Google Cloud

1. Create an **OAuth 2.0 Client ID** (Web application type) in [Google Cloud Console](https://console.cloud.google.com/)
2. Add `https://lockhatinc.github.io` (and `http://localhost:PORT` for local dev) as **Authorized JavaScript origins**
3. Enable the **Generative Language API** for the project

### GitHub Actions deploy

Add a repository secret named `GOOGLE_CLIENT_ID` with the OAuth client ID value.  
Push to `main` → GitHub Actions injects the ID and deploys to `gh-pages`.

### Local dev

Serve `index.html` from any static file server. Replace `GOOGLE_CLIENT_ID_PLACEHOLDER` in `index.html` with your actual client ID manually, or set it via the meta tag before serving.

## File structure

```
index.html          entry point, CDN scripts, UI markup
src/
  app.js            auth state machine + UI event wiring
  ocr.js            Gemini REST call → {headers, rows}
  ods.js            JSZip ODS builder → downloadable blob
.github/workflows/
  deploy.yml        inject client ID + deploy to gh-pages
```
