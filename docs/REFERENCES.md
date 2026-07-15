# Open-source references and license review

Reviewed on 2026-07-15. ChangeLens uses these projects as product or architecture references. No application source code was copied from them.

| Project                                                              | Observed license                                                    | Pattern studied                                                         | ChangeLens boundary                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [Crawlee](https://github.com/apify/crawlee)                          | Apache-2.0                                                          | Renderer abstraction, concurrency, retries and `robots.txt` integration | Used as an npm dependency through its public API                                      |
| [changedetection.io](https://github.com/dgtlmoon/changedetection.io) | Apache-2.0                                                          | Change history, alert ergonomics and watch-oriented product language    | Product inspiration only; no code or assets reused                                    |
| [Scrapy](https://github.com/scrapy/scrapy)                           | BSD-3-Clause                                                        | Clear downloader/spider/pipeline/middleware separation                  | Architecture inspiration only; ChangeLens is TypeScript and does not depend on Scrapy |
| [Firecrawl](https://github.com/firecrawl/firecrawl)                  | Primarily AGPL-3.0; some SDK/UI directories differ                  | API ergonomics and structured output concepts                           | No code reused; the copyleft boundary was explicitly avoided                          |
| [Crawl4AI](https://github.com/unclecode/crawl4ai)                    | Apache-2.0 with project attribution requirements described upstream | Provenance-first AI/RAG output and optional intelligence                | Inspiration only; ChangeLens does not depend on or copy Crawl4AI                      |

Dependencies actually distributed by ChangeLens are recorded in `pnpm-lock.yaml` and retain their own licenses. The production inventory was checked on 2026-07-15 with `pnpm licenses list --prod`: application dependencies are permissively licensed, while the native libvips binary used transitively by Next.js/Sharp is LGPL-3.0-or-later and must retain its upstream license and relinking rights when redistributed. The inventory reports legacy `map-stream@0.1.0` metadata as unknown locally; the npm registry declares that package as MIT. No AGPL dependency is included in the application runtime.

The sole copied infrastructure configuration is Playwright's recommended seccomp profile. Its exact source, revision and Apache-2.0 attribution are recorded in [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

The ChangeLens code and original identity assets are MIT licensed. The controlled demonstration page designs are original to this repository.
