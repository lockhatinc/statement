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
