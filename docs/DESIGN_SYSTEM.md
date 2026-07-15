# Product design system

ChangeLens is designed as an operations workspace, not a marketing dashboard. The interface prioritizes target state, execution evidence and next actions over decorative metrics. This document records the visual decisions behind the portfolio release so the product can evolve without drifting back into generic template patterns.

## Product principles

1. **Evidence over decoration.** Every number shown in an operational view comes from the dashboard API or deterministic demo snapshot. ChangeLens does not invent trends, worker counts, health percentages or change previews to fill space.
2. **Dense, not cramped.** Tables and three-pane tools remain information-rich, while 12–14 px interface type, clear grouping and consistent spacing keep them scannable.
3. **One functional accent.** Plum identifies primary actions and active navigation. Green, amber, red and blue are reserved for semantic status.
4. **Light, editorial surfaces.** Warm whites, ink typography and quiet borders replace glow, glass, ornamental gradients and the familiar dark “developer dashboard” aesthetic. Depth comes from hierarchy rather than effects.
5. **Technical detail where it helps.** Monospace is used for selectors, identifiers, logs and structured output—not for ordinary labels or body copy.
6. **No dead affordances.** Search, notification and system controls are only shown when they perform a real task. Static security context is presented as context, not as an interactive control.

## Visual foundations

The product theme lives in `apps/web/src/app/product-theme.css`. It is loaded after the original component stylesheet and forms a deliberate migration layer: component markup remains stable while the portfolio release can be reviewed as one coherent visual system.

| Role           | Token            | Value     | Use                                  |
| -------------- | ---------------- | --------- | ------------------------------------ |
| Canvas         | `--bg`           | `#f5f3f7` | Application background               |
| Surface        | `--panel`        | `#ffffff` | Panels, tables and editor panes      |
| Raised surface | `--panel-strong` | `#f4f1f7` | Hover and nested controls            |
| Primary text   | `--text`         | `#241d2d` | Page and section headings            |
| Secondary text | `--muted`        | `#72697b` | Supporting content                   |
| Accent         | `--mint`         | `#71519a` | Primary action and current selection |
| Warning        | `--amber`        | `#a56b23` | Changed or delayed state             |
| Failure        | `--red`          | `#b34f5e` | Failed, blocked or destructive state |

Spacing follows a practical 4 px base. Panels use a restrained 5 px radius and operational labels use 3 px corners instead of decorative pills. Shadows are intentionally omitted from the main workspace.

## Information hierarchy

- The persistent shell answers **where am I?** through active navigation and a compact breadcrumb.
- The page header answers **what can I do here?** through one title, one sentence and the relevant actions.
- Summary metrics answer **does anything need attention?** before detailed tables.
- Tables answer **which monitor or run?** with stable columns and semantic status.
- Detail views answer **what happened and why?** with captured evidence, normalized values, diffs and logs.
- The extraction editor keeps target, schema and normalized output visible as one workflow.

## Account identity

`PublicUser` includes a nullable `avatarUrl`. The deterministic portfolio account points to a local, user-owned 512×512 image at `apps/web/public/profile/jose-miguel-diaz.png`; new accounts fall back to generated initials. The image is rendered by a shared `UserAvatar` component in the workspace switcher, account shortcut and settings profile.

The database stores only the URL, not image bytes. This release does not expose avatar upload or accept remote avatar URLs, keeping file handling out of the authentication boundary.

## Responsive behavior

- Above 1180 px, the dashboard uses four summary columns and a monitor table beside queue and health panels.
- Below 1180 px, summary metrics form two columns and operational side panels share a second row.
- Below 860 px, navigation becomes a drawer, identity copy is reduced and the editor stacks its panes.
- Below 620 px, summaries, health groups, settings and account details become single-column layouts with a persistent mobile action bar.

The end-to-end suite checks both desktop Chromium and a Pixel 7 viewport, including a no-horizontal-overflow assertion.

## Content and capture rules

Portfolio screenshots must use `NEXT_PUBLIC_DEMO_SNAPSHOT=true` and controlled pages under `apps/web/public/demo`. This keeps names, timings, changes and captures deterministic, avoids third-party content and makes screenshots reproducible.

Before publication:

1. Capture the dashboard, extraction editor, monitor detail, change comparison, account settings and mobile dashboard.
2. Confirm there are no browser console errors, clipped controls or horizontal page overflow.
3. Do not add fictitious operational data solely to make a capture busier.
4. Keep personal information limited to the intentionally public portfolio identity.

## Accessibility baseline

- Interactive icons have accessible names.
- Status is communicated with text and icon/color, never color alone.
- Focus behavior remains native and keyboard-compatible.
- Body and control text targets readable sizes at normal zoom.
- Responsive layouts preserve content order and do not depend on hover.

This is a baseline rather than a conformance claim. A future release should add automated contrast and keyboard-flow checks with an accessibility test runner.
