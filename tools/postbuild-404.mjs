/**
 * Post-build step: add a 404.html with a SPA redirect so that deep links
 * (for example /attendance/job-card) work on a plain static host that does
 * not rewrite unknown paths to index.html.
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist/hrms/browser');
if (!fs.existsSync(dist)) {
  console.error('dist folder not found:', dist);
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Hana HRM</title>
    <script>
      (function () {
        try {
          sessionStorage.setItem('hana-hrm-redirect', location.pathname + location.search);
        } catch (e) {}
        location.replace('/');
      })();
    </script>
    <style>
      body { font-family: system-ui, sans-serif; color: #45536b; padding: 40px; }
    </style>
  </head>
  <body>
    <p>Redirecting to the Hana HRM application…</p>
  </body>
</html>
`;

fs.writeFileSync(path.join(dist, '404.html'), html);
console.log('404.html (SPA redirect) written to', dist);
