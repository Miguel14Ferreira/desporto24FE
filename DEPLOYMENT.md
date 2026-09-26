# Desporto24 FE - Deployment

## Production model

The Angular production build uses same-origin API calls.

Nginx serves the SPA and proxies:

- `/api/**` to the backend
- `/media/**` to the backend
- `/healthz` as the frontend container health endpoint

The backend upstream is controlled by the runtime environment variable
`BACKEND_UPSTREAM`.

Default inside the image:

```text
http://desporto24be:8080
```

## Build

```bash
docker build -t desporto24-fe .
```

## Run against a backend container/service

```bash
docker run --rm \
  -p 80:80 \
  -e BACKEND_UPSTREAM=http://desporto24be:8080 \
  desporto24-fe
```

When the backend is outside the Docker network, set `BACKEND_UPSTREAM`
to the internal/reachable backend URL.

## Health check

```text
GET /healthz
```

## Important

Do not put backend credentials, JWT secrets, SMTP credentials, or Twilio
credentials in the frontend environment. The browser only needs the
same-origin API path configured by the production build.
