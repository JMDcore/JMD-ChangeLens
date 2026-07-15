# Portfolio publication kit

## GitHub repository settings

- Description: `Safe, observable web data extraction and change monitoring with Crawlee, Playwright, BullMQ and PostgreSQL.`
- Website: use the deployed demo URL when available.
- Topics: `typescript`, `nextjs`, `playwright`, `crawlee`, `bullmq`, `web-scraping`, `automation`, `postgresql`, `redis`, `ssrf`, `observability`.
- Social preview: upload the ready-to-use 1280×640 `docs/assets/social-cover.png`.
- Enable Issues, Discussions if desired, private vulnerability reporting, Dependabot alerts and branch protection.
- Require the `Quality gate`, `Browser tests`, container jobs and CodeQL checks on `main`.

## Screenshot set

1. `dashboard.png` — operational overview with API-backed metrics, queue activity and monitor health.
2. `editor.png` — three-pane page/schema/result extraction editor.
3. `monitor-detail.png` — captured page and normalized output.
4. `change-diff.png` — field diff, execution log and historical timeline.
5. `account-settings.png` — account identity and responsible-use workspace controls.
6. `mobile-dashboard.png` — responsive operations view.

Use `docs/assets/linkedin-architecture.png` as the 1200×627 technical overlay for a second carousel slide. The SVG originals remain editable.

All screenshots use deterministic snapshot data and controlled demo pages. No third-party page, secret or personal dataset appears in them.

The profile image is the repository owner's intentionally public portfolio photo. Its local 512×512 copy avoids a runtime dependency on an external image host.

Visual and content conventions are recorded in `docs/DESIGN_SYSTEM.md`. Re-run desktop and mobile end-to-end tests before replacing screenshots.

## Suggested LinkedIn post

```text
He desarrollado ChangeLens, una plataforma visual para extraer datos estructurados de páginas públicas y monitorizar sus cambios con el tiempo.

Quería que el proyecto complementara mi CRM ClientFlow y demostrara otra parte del desarrollo de producto: automatización, backend, procesamiento asíncrono, navegadores headless, seguridad y observabilidad.

La arquitectura separa una interfaz en Next.js, una API Fastify y workers BullMQ. Las extracciones usan Crawlee con Cheerio o Playwright, PostgreSQL conserva el historial y las diferencias, Redis coordina trabajos y S3 almacena capturas privadas.

El reto más importante no fue descargar HTML, sino diseñar límites responsables: robots.txt, identificación del agente, ritmo por dominio, protección SSRF en URLs/redirecciones/subrecursos, sesiones seguras, webhooks firmados, retención y trazabilidad de cada decisión.

El repositorio incluye datos demo controlados, pruebas unitarias, integración y E2E responsive, Docker Compose, CI, CodeQL, Dependabot y documentación del modelo de amenazas.

También he documentado las decisiones de producto visual: una interfaz de operaciones sin métricas inventadas ni controles inactivos, con jerarquía, estados y densidad pensados para el trabajo diario.

Código y arquitectura: https://github.com/JMDcore/JMD-ChangeLens

#TypeScript #Nextjs #Playwright #WebScraping #Automation #Backend #CyberSecurity #OpenSource
```

## Talking points

- Why a separate worker is more reliable than launching Chromium inside an HTTP route.
- Why Redis coordinates work while PostgreSQL remains the source of truth.
- How static-first extraction reduces browser cost.
- How structured diffs avoid noisy whole-page comparisons.
- Why SSRF protection needs both application validation and infrastructure egress policy.
- Why AI is deferred until it can preserve provenance and original data.
