# Changelog

## 2026-04-09

- Initial release: static OCR SPA using Gemini 2.0 Flash Preview
- Google OAuth via GSI browser token client
- ODS output built client-side with JSZip
- GitHub Actions deploy to lockhatinc/statement gh-pages
- Switched deploy to GitHub Actions Pages (workflow source)
- Created Web Application OAuth client ID in gemini-50279, External/In production audience, JS origin https://lockhatinc.github.io
- Set GOOGLE_CLIENT_ID secret; real client ID now injected in deployed index.html
- Fix: removed async from GSI script tag to prevent ReferenceError: google is not defined
- Fix: replace invalid generative-language OAuth scope with cloud-platform
- Refactor: replace Google OAuth with user-provided Gemini API key; remove GSI dependency
- Fix: model name corrected from gemini-2.0-flash-preview to gemini-2.0-flash (preview variant not available in v1beta)
- Fix: error message was hidden by render() call inside showErr; fixed ordering so error shows after render
- Upgrade: switch model to gemini-3-flash-preview (latest available)
- Restore Google OAuth sign-in (GSI token client, cloud-platform + email scope)
- Add src/setup.js: idempotently provisions GCP project + enables Generative Language API + creates restricted API key
- State machine: no-auth → setting-up → has-key → processing
- Update CLAUDE.md to reflect OAuth + auto-provisioning architecture
- Fix: enable apikeys.googleapis.com via serviceusage before calling API Keys API (was returning 403)
- Fix: narrow project search to derived projectId to prevent matching unrelated project with gemoci:1 label
- Fix: retry key create up to 20x with 6s delay when apikeys API returns 403 "not been used" (GCP propagation lag up to 120s)
- Fix: revert model to gemini-2.0-flash (gemini-3-flash-preview does not exist)
- Fix: add x-goog-user-project header to all apikeys.googleapis.com calls to route quota through user's GCP project instead of OAuth app project
- Fix: remove duplicate content in src/setup.js (file was doubled)
- Fix: replace GCP API key provisioning with OAuth Bearer token auth for Gemini calls — GCP API keys don't get Gemini Developer free-tier quota; OAuth Bearer + x-goog-user-project routes correctly to user's project free quota
- Refactor: setup.js now returns { token, projNum } instead of API key string; ocr.js uses Authorization Bearer header; apikeys.googleapis.com dependency removed entirely
