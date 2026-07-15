# Deployment guide

## Local reference deployment

The included Compose topology is optimized for development and portfolio demonstrations:

- PostgreSQL 17 for durable state.
- Redis 8 for BullMQ.
- LocalStack S3 for private screenshots.
- A one-shot migration container.
- Independent API, worker and web images.

```bash
cp .env.example .env
docker compose --profile app up --build
```

The service ports bind to loopback. The worker health port is internal to the Compose network. Do not use the example passwords or signing secret in a shared environment.

To reset all local data:

```bash
docker compose down --volumes
```

This deletes the local database, Redis state and screenshots.

## Production topology

Deploy the three application images independently. Run the migration image as a one-shot release task before rolling out API instances:

```bash
node node_modules/@changelens/database/dist/migrate.js
```

Recommended order:

1. Back up PostgreSQL and verify rollback constraints.
2. Run the migration task once.
3. Deploy API instances and wait for `/api/ready`.
4. Deploy workers with low initial concurrency.
5. Deploy the web app.
6. Verify queue latency, worker errors, blocked decisions and screenshot writes.

## Required configuration

All values are validated at process startup. See `.env.example` for the full list.

### API

- `DATABASE_URL`, `REDIS_URL`
- `S3_ENDPOINT`, region, bucket and credentials
- `WEB_ORIGIN`
- `COOKIE_SECURE=true`
- Unique `METRICS_TOKEN`
- Unique 32+ character `WEBHOOK_SIGNING_SECRET`

### Worker

- The same data-service endpoints and webhook signing secret.
- An identifying `CHANGELENS_USER_AGENT` with operator contact URL.
- Conservative concurrency, delay, timeout, response and redirect limits.

### Web

- `BACKEND_INTERNAL_URL` to the private API service.
- `NEXT_PUBLIC_API_BASE_URL=/api` for same-origin browser calls.
- `NEXT_PUBLIC_DEMO_SNAPSHOT=false`.

## Network and isolation requirements

- Only the web ingress should be public.
- API access should be limited to the web ingress/mesh and trusted metrics collector.
- PostgreSQL, Redis, S3 and worker health ports must be private.
- Worker egress must independently deny loopback, private, link-local, reserved and cloud metadata ranges for IPv4 and IPv6.
- Run browsers as an unprivileged user with a Chromium-compatible seccomp policy.
- Give API and worker separate least-privilege identities. The API needs object read/delete access; the worker needs object write/delete access.

## Health and metrics

| Service | Endpoint       | Semantics                               |
| ------- | -------------- | --------------------------------------- |
| API     | `/api/health`  | Process liveness                        |
| API     | `/api/ready`   | PostgreSQL, Redis and S3 readiness      |
| API     | `/api/metrics` | Prometheus metrics; bearer protected    |
| Worker  | `/health`      | Process ready to claim jobs             |
| Worker  | `/metrics`     | Job duration/count and delivery metrics |

Alert on sustained non-ready status, failed/stalled jobs, queue wait time, per-domain failure spikes, webhook failure rate, storage errors and browser restarts.

## Backup and recovery

- Back up PostgreSQL with point-in-time recovery.
- Enable versioning or backup policy on the screenshot bucket if evidence recovery is required.
- Redis persistence improves scheduler recovery but is not the source of completed execution history.
- After Redis loss, reconcile recurring schedulers from active monitors before restoring worker concurrency.
- Periodically sweep storage for objects whose execution row no longer exists.

## Release verification

```bash
pnpm check
pnpm test:e2e
pnpm audit --prod --audit-level high
docker compose config --quiet
```

Build all three images in CI. Do not publish an image if CodeQL, dependency audit or the browser suite fails.
