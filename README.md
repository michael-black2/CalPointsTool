# React + Vite + GitHub Actions Starter

## Local dev
```bash
npm ci
npm run dev
```

## Deploy options
- **GitHub Pages**: enabled via `.github/workflows/pages.yml`. In repo Settings → Pages, set "Build and deployment" to "GitHub Actions".
- **Docker**: build & push to GHCR via `.github/workflows/docker-publish.yml`.

### Vite `base` note for GitHub Pages
If deploying to `https://<user>.github.io/<repo>`, set `base: '/<repo>/'` in `vite.config.js`. For user/organization pages root (`<user>.github.io`), base can remain default.
