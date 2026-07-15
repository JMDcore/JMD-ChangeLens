# Contributing to ChangeLens

Thank you for helping improve ChangeLens. Contributions should preserve its core product boundary: focused monitoring of legitimate public targets with observable, conservative automation.

## Before opening work

- Search existing issues and pull requests.
- Use a feature request for meaningful scope or architecture changes.
- Use private vulnerability reporting for security issues.
- Do not propose CAPTCHA solving, stealth, authenticated-target bypasses, bulk personal-data extraction or unrestricted proxy rotation.

## Local setup

```bash
cp .env.example .env
pnpm install
pnpm services:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

For UI-only work:

```bash
NEXT_PUBLIC_DEMO_SNAPSHOT=true pnpm dev:web
```

## Development rules

- Keep TypeScript strict; avoid `any` and validate external input at a boundary.
- Keep the API free of browser execution and long-running jobs.
- Create a durable execution record before publishing a job.
- Scope every user-owned database query by `userId`.
- Validate URLs at initial input, redirects, final destinations and outgoing webhooks.
- Do not log passwords, tokens, cookies, complete private URLs, page bodies or extracted personal data.
- Prefer established crawling, queue and validation libraries over custom reimplementations.
- Update controlled demo data when a visual flow needs reliable evidence.
- Add a migration for schema changes; never edit an applied migration.

## Verification

Run before opening a pull request:

```bash
pnpm check
pnpm test:e2e
pnpm audit
```

Changes to URL policy require focused SSRF tests. Queue changes require retry/idempotency tests. UI changes should include desktop and mobile evidence. Database changes require a generated migration and a note about rollback or compatibility.

## Commits and pull requests

Use focused conventional commits where practical:

```text
feat(worker): persist blocked redirect decisions
fix(api): scope screenshot export by owner
docs(security): document egress policy
```

Pull requests should explain the outcome, verification, security/retention effects and rollback path. Keep generated output and local secrets out of commits. Maintainers may ask for a smaller change when a proposal mixes product scope, refactoring and infrastructure.

## License

By contributing, you agree that your contribution is licensed under the repository's MIT License and that you have the right to submit it.
