# ADR-001: Monorepo with separate web, API and worker runtimes

- Status: accepted
- Date: 2026-07-15

## Context

ChangeLens needs a product UI, authenticated control plane, recurring queue coordination and untrusted browser automation. A single Next.js process would reduce initial files but would couple browser memory pressure, job retries and HTTP availability. Fully separate repositories would add versioning and contract coordination before the product needs independent teams.

## Decision

Use a pnpm/Turborepo monorepo with three applications:

- `web`: Next.js product UI.
- `api`: Fastify control-plane API.
- `worker`: BullMQ extraction and alert processors.

Shared TypeScript packages own contracts, database access, queue definitions, scraping, storage and configuration. Deployable applications remain independently buildable and scalable.

## Consequences

Positive:

- Browser crashes or load do not share a process with authentication and CRUD.
- Worker concurrency and API replicas scale independently.
- Shared Zod schemas reduce drift between UI, API and queue snapshots.
- One lockfile, CI pipeline and developer command keep the portfolio approachable.

Costs:

- Local development requires PostgreSQL, Redis and S3-compatible storage.
- Workspace package build order and production deployment need explicit tooling.
- Cross-service integration behavior needs dedicated tests, observability and migration discipline.

## Alternatives considered

- Next.js-only application with in-process jobs: rejected because long-lived browser work conflicts with serverless/request lifecycles and failure isolation.
- Separate repositories: rejected for MVP coordination overhead.
- Database-backed polling queue: rejected because BullMQ already provides retries, backoff, job states and recurring schedulers.
- Kafka: rejected as disproportionate for the expected volume and operational goals.
