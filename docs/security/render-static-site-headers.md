# Jynlo production static-site security headers

Render service: **desporto24-web** (`srv-darsq3bbc2fs738de0mg`), workspace **Jynlo**.
Current production hosting is **Render Static Site**, not the repository's Docker Nginx.
Changing `default.conf.template` has **no effect** on this deployed static site.

## Required Render Dashboard setup

Go to Render > desporto24-web > Settings > Headers and add the following rules.
Path for every header is `/*` unless otherwise noted.

| Path | Name | Value |
| --- | --- | --- |
| `/*` | `Strict-Transport-Security` | `max-age=31536000` |
| `/*` | `X-Content-Type-Options` | `nosniff` |
| `/*` | `X-Frame-Options` | `DENY` |
| `/*` | `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `/*` | `Content-Security-Policy` | `frame-ancestors 'none'; object-src 'none'; base-uri 'self'` |
| `/index.html` | `Cache-Control` | `no-cache` |

This deliberately limited CSP is compatible with third-party Google sign-in
and map assets because it does not yet restrict `script-src`, `connect-src`
or `img-src`. A stricter policy should first be trialled as
`Content-Security-Policy-Report-Only` and validated in both PT/EN flows.

Do not use `includeSubDomains` or `preload` in HSTS before confirming every
subdomain uses HTTPS.

## Verification after saving

Use a passive HEAD request to `https://d24sports.com/` and
`https://d24sports.com/index.html` and verify that the configured
headers are present. Test Google login, map, feed and community pages,
uploads, and deep-link navigation before expanding CSP.

The Render connector currently lacks an action to edit Static Site headers,
so this dashboard configuration requires an authorized account operator.
Reference: https://render.com/docs/static-site-headers
