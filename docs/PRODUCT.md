# Product scope

## Product statement

ChangeLens helps a technical operator turn a small, explicit part of a public page into structured data, execute that extraction safely over time, and understand exactly what changed.

The primary user is a developer, analyst or small operations team monitoring product, status or release information that is legitimately public. The core job is not “crawl the web”; it is “maintain a trustworthy, inspectable monitor.”

## MVP outcome

A user can:

1. Create an account and private session.
2. Enter a public HTTP(S) target.
3. Define up to 25 CSS extraction fields with a scalar type.
4. Preview the structured result.
5. choose static, browser or automatic rendering.
6. Run manually or every 15 minutes, hourly, every six hours or daily.
7. Inspect status, duration, renderer, retry attempts, output, screenshot and logs.
8. Compare a successful run with its previous successful baseline.
9. Export JSON or CSV.
10. Receive an HMAC-signed webhook only when normalized values change.

## Explicit non-goals for v0.1

- Authenticated or paywalled target browsing.
- CAPTCHA solving, proxy rotation, stealth or anti-bot bypass.
- Bulk URL imports or high-volume discovery crawling.
- Direct in-page element selection; the current editor visualizes selector mapping on controlled content.
- Lists, nested schemas, pagination and browser interaction scripts.
- Email delivery, teams, billing, public API keys and usage metering.
- AI-generated selectors or summaries.

These boundaries control delivery risk and make the security posture legible. Later AI assistance must be optional, visibly derived, and never replace selectors or captured values as the source of truth.

## Success measures

- A first monitor can be created and previewed without documentation.
- Every accepted job has a durable state and every failure has a user-readable code.
- Repeated identical values do not produce change alerts.
- A blocked network decision is stored, visible and never silently retried.
- Controlled demos and product screenshots require no third-party target.
- The same contracts validate browser input, API input and worker snapshots.

## Delivery increments

### v0.1 — portfolio release

The current repository: secure single-user workspaces, monitor CRUD, static/browser extraction, recurring jobs, evidence, diffs, signed webhooks, exports, observability, deterministic demo and CI/security automation.

### v0.2 — extraction depth

Direct element picker, typed schema errors, list extraction, pagination hints and reusable templates.

### v0.3 — platform surface

Public API keys, signed outgoing event versions, team workspaces, roles and domain consumption limits.

### v0.4 — optional intelligence

Selector suggestions and change summaries with explicit model/provider controls, cost visibility, provenance and an original-data view beside every generated result.
