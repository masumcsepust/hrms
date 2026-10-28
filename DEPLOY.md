# Deploying Huma

The project builds to a plain static site — no server, no database, no runtime
config. Whatever host you pick, it only needs to serve `dist/` over HTTPS.

```bash
npm install
npm run build     # → dist/
```

---

## 1. Azure Static Web Apps (what this repo is already wired for)

The repo contains `.github/workflows/azure-static-web-apps-gray-glacier-04b3c0600.yml`.
It needs two secrets/values to work with a **new** Static Web App:

| Where | Value |
| --- | --- |
| GitHub → Settings → Secrets → `AZURE_STATIC_WEB_APPS_API_TOKEN_<SUFFIX>` | the deployment token from the SWA resource |
| Workflow → `azure_static_web_apps_api_token` | must match that secret name |

Workflow settings that matter:

```yaml
app_location: "/"              # source code
output_location: "dist/"       # built site
```

`output_location: "dist/"` is correct **only** because `angular.json` sets:

```json
"outputPath": { "base": "dist", "browser": "" }
```

which puts `index.html`, the bundles and `media/` straight into `dist/`. If you
switch to the classic `dist/<project>/browser` layout, update
`output_location` to match.

### Creating a Static Web App from scratch

1. Azure portal → **Static Web Apps** → **Create**
2. Pick a resource group, a name, and a plan (Free)
3. Source: **GitHub** → connect `masumcsepust/hrms` → production branch `main`
4. Build preset: **Angular**
5. Set **App location** to `/` and **Output location** to `dist/`
6. Azure creates the workflow file and the token secret for you

### Node version

`package.json` pins:

```json
"engines": { "node": "22.22.3" }
```

Angular 22 refuses to run on anything below `v22.22.3` (or `v24.15.0`).
Pin it exactly — a range like `>=22.22.3` makes the Azure Oryx builder resolve
to `24.13.0`, which is below Angular's minimum and fails the build.

---

## 2. Azure Blob Storage + CDN

```bash
npm run build
az storage blob upload-batch \
  --account-name <account> \
  --container-name $web \
  --destination dist \
  --source dist \
  --content-type-text "text/html; charset=utf-8" \
  --overwrite true
```

Enable "Static website" on the container (`index.html` = index document,
`error.html` = error document) and put a CDN in front of it.

---

## 3. GitHub Pages

Add a workflow with `actions/deploy-pages@v4`, then set the Pages source to
**GitHub Actions**. Because a project page is served from `/<repo>/`, the build
needs a matching base href — the repo already has a `github-pages`
configuration for this:

```bash
npx ng build --configuration github-pages
# baseHref "/hrms/", output → dist/hrms-landing/browser
```

Upload `dist/hrms-landing/browser` as the Pages artifact.

---

## 4. Netlify / Vercel / Cloudflare Pages

Point the build command at `npx ng build --configuration production` and the
publish directory at `dist`.

| Host | Build command | Publish directory |
| --- | --- | --- |
| Netlify | `npx ng build --configuration production` | `dist` |
| Vercel | `npx ng build --configuration production` | `dist` |
| Cloudflare Pages | `npx ng build --configuration production` | `dist` |

---

## 5. Any web server (nginx)

```nginx
server {
  listen 443 ssl http2;
  server_name huma.example.com;

  root /var/www/huma;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~* \.(js|css|woff2?|ttf|svg|png|jpg|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

`try_files … /index.html` matters — it is what makes client-side routes work
on a hard refresh.

---

## Build configurations in `angular.json`

| Configuration | baseHref | Output | Use for |
| --- | --- | --- | --- |
| `production` (default) | `/` | `dist/` | Azure SWA, Netlify, Vercel, nginx |
| `github-pages` | `/hrms/` | `dist/hrms-landing/browser` | GitHub project pages |
| `development` | `/` | `dist/` | `ng serve` |

---

## Notes

- `src/fonts/` holds the three self-hosted variable fonts (Fraunces, Inter,
  Geist Mono). They are bundled and fingerprinted by Angular, so the CSS
  references them relatively and the site works under any base path.
- Everything on the page is fictional placeholder content — company names,
  statistics, testimonials and pricing are for the demo.
- `npm run build` runs `ng build` with the default `production` configuration.
  There is no server-side rendering, so the output is a single static bundle
  (~90 kB gzipped) plus the fonts.
