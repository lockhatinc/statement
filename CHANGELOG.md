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
- Fix: add generative-language OAuth scope — cloud-platform alone is insufficient for generateContent, causes 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT
- Fix: remove generative-language OAuth scope — it is a restricted scope that Google consent screen rejects; cloud-platform is sufficient for Gemini Bearer auth
- Fix: restore generative-language scope — required for generateContent; unverified app works for test users explicitly added in OAuth consent screen

## 2026-04-10 (continued)

- Refactor: replace Google OAuth + GCP provisioning with user-provided API key (aistudio.google.com/apikey); removes GSI dependency and OAuth scope restrictions entirely
- Delete src/setup.js — GCP project provisioning no longer needed
- State machine simplified to no-key → has-key → processing
- Switch model to gemini-2.0-flash-exp (latest stable flash variant available via API key)
- Switch model to gemini-3.1-flash-lite-preview
- Fix: JSZip is not a constructor — use window.JSZip global instead of dynamic CDN import
- Localize jszip.min.js — remove CDN dependency, serve from same origin
- UX: remove "Use this key"/"Change key" buttons; key auto-saves on enter/blur, persists in localStorage, masked once set; single "Clear" button to reset
- Feature: accept PDF files in addition to images; increase size limit to 20MB
- Feature: multi-sheet ODS output — one sheet per page
- Feature: formula detection — running balance columns output as =D{n}+C{n+1} ODS formulas
- Feature: numeric/currency cells as ODS float (office:value-type="float") with display text
- Feature: layout reproduction — prompt instructs model to preserve original visual structure
- Feature: page-break row stitching — split transaction rows merged onto originating page
- UX: step-by-step instructions with direct aistudio.google.com/api-keys link; dropzone mentions PDF
- Refactor: fully generalized OCR prompt — works for any document, not bank-statement-specific
- Fix: null cell coercion now returns empty string instead of throwing
- Fix: formula row numbers now correctly 1-based from first output row, accounting for metadata rows
- Improvement: page-break stitching rule clarified — date comes from originating page, skip continuation fragments
- Improvement: LAYOUT directive replaces COMPLETENESS — explicit top-to-bottom reading order captures header blocks, section headings, address blocks, footers as rows
- Fix: NUMBERS section reverted to exact-match document format — no artificial +/- prefixes added to display strings
- Fix: prompt now specifies ODS as output format and uses `of:=` in all formula examples — model outputs correct ODS formula syntax natively; ods.js passes formula string through without prefix manipulation
- Fix: replace &hellip; entity with plain ... in spinner text
