# Security policy

## Supported versions

ChangeLens is pre-1.0. Security fixes are applied to the latest `main` branch and the most recent tagged release only.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use [GitHub private vulnerability reporting](https://github.com/JMDcore/JMD-ChangeLens/security/advisories/new). If that channel is unavailable, email `jmdcore.dev@gmail.com` with the subject `ChangeLens security report`.

Include, when possible:

- A concise description and affected component.
- Reproduction steps against a local or controlled target.
- Expected impact and prerequisite access.
- A suggested mitigation, if known.
- Whether public disclosure is planned.

Do not test against infrastructure or targets you do not own or have permission to assess. Do not include live credentials, third-party personal data, or a destructive proof of concept.

You can expect acknowledgement within 72 hours and an initial assessment within seven days. Timelines for a fix and coordinated disclosure depend on severity and release impact. Credit is offered unless anonymity is requested.

## In-scope vulnerability classes

- SSRF or private-network access through targets, redirects, browser subrequests or webhooks.
- Authentication, authorization, session or CSRF bypass.
- Cross-user access to monitors, executions, screenshots or exports.
- Signature bypass or exposure of webhook secrets.
- Remote code execution, injection or unsafe browser isolation.
- Credentials, secrets or sensitive target content written to logs.
- Retention or deletion failures that expose data beyond the configured period.

Reports about CAPTCHA solving, stealth scraping or bypassing a third-party site's controls are not accepted as feature requests; those behaviors are explicitly outside the product scope.

## Security design

Read [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) for threats, implemented controls, residual risks and the public-deployment checklist.
