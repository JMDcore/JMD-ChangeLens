---
name: ChangeLens
description: An evidence-first operations workspace for trustworthy public web monitoring.
colors:
  primary: "#704a8f"
  primary-hover: "#5f3d7b"
  navigation: "#251b2d"
  canvas: "#f6f6f8"
  surface: "#ffffff"
  surface-raised: "#f4f3f6"
  ink: "#201824"
  text-secondary: "#453b4a"
  text-muted: "#665d6c"
  divider: "#2a20331f"
  success: "#3f704a"
  warning: "#a56b23"
  failure: "#b34f5e"
  info: "#526f9e"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 660
    lineHeight: 1.15
    letterSpacing: "-0.7px"
  title:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "4px"
  control: "6px"
  surface: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 15px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 15px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "20px"
---

# Design System: ChangeLens

## 1. Overview

**Creative North Star: "The Operations Ledger"**

ChangeLens should feel like a dependable working instrument: calm enough to scan for hours, exact enough to trust when something fails, and distinctive without inventing unfamiliar controls. A solid aubergine navigation rail anchors the workspace while cool white surfaces keep operational evidence legible.

The product rejects both generic SaaS decoration and theatrical developer tooling. Hierarchy comes from contrast, spacing, typography and data structure—not gradients, glow, glass, oversized radii or a wall of interchangeable cards. The interface serves the monitoring task and then gets out of the way.

**Key Characteristics:**

- Evidence-first and visibly operational.
- Dense but readable at normal zoom.
- Restrained plum identity with semantic state colors.
- Flat surfaces, quiet dividers and standard affordances.
- One consistent interaction vocabulary across every screen.

## 2. Colors

The palette combines a deep aubergine navigation anchor with cool, nearly neutral work surfaces. Plum is functional: it marks the primary action, selection and focus—not decoration.

### Primary

- **Operational Plum:** the sole product accent, reserved for primary actions, selection and focus.
- **Deep Plum:** the interaction state for primary actions; never a decorative secondary accent.

### Secondary

- **Evidence Blue:** links or informational evidence when plum would incorrectly imply an action.
- **Change Amber:** changed and delayed states only.
- **Failure Rose:** failed, blocked and destructive states only.
- **Health Green:** healthy and successful states only.

### Neutral

- **Aubergine Rail:** persistent navigation and the main identity anchor.
- **Cool Canvas:** page background behind operational surfaces.
- **Working White:** tables, editor panes and grouped controls.
- **Ink:** headings and primary data.
- **Muted Ink:** descriptions, metadata and secondary labels; it must remain WCAG-readable.

**The One Accent Rule.** Plum occupies less than ten percent of the work area and always communicates action, focus or selection.

**The State Integrity Rule.** Green, amber, rose and blue are never decorative. Their meaning must remain stable on every screen.

## 3. Typography

**Display Font:** Inter with the native UI sans fallback stack  
**Body Font:** Inter with the native UI sans fallback stack  
**Label/Mono Font:** SFMono-Regular, Cascadia Code, Roboto Mono, Consolas, monospace for selectors, IDs, logs and structured values only

**Character:** One familiar sans family keeps a complex product coherent. Weight and spacing create hierarchy; novelty fonts would compete with the data.

### Hierarchy

- **Headline** (660, 28px, 1.15): one page title, fixed rather than fluid.
- **Title** (650, 14px, 1.3): panels, table groups and editor panes.
- **Body** (400, 14px, 1.5): descriptions and instructional copy, capped around 70 characters when prose is continuous.
- **Label** (600, 12px, 1.4): controls, metadata and table labels. Uppercase tracking is prohibited except for true tabular column headers.
- **Data** (500–650, 10–13px): identifiers and structured values in monospace; ordinary UI labels never use monospace.

**The Readable Density Rule.** Dense does not mean tiny. Persistent interface text stays at 11px or larger; descriptions and controls target 12–14px.

## 4. Elevation

The application is flat by default. Depth comes from the dark navigation rail, surface contrast and one-pixel dividers. Main workspace panels do not use drop shadows; transient overlays may use a short, structural shadow only when they must separate from moving content.

**The Border-or-Shadow Rule.** A component may use a quiet border or a compact shadow, never the generic wide-shadow-plus-border combination.

## 5. Components

### Buttons

- **Shape:** restrained control corners (6px), 40px high.
- **Primary:** operational plum with white text; only one primary action per local decision point.
- **Hover / Focus:** darker plum on hover and a visible two-pixel plum focus ring with two-pixel offset.
- **Secondary:** white or transparent with a strong neutral border; it never competes with primary.

### Chips

- **Style:** compact rectangular status labels (4px radius), tinted by semantic state and always containing text.
- **State:** color reinforces a written state; it never carries meaning alone.

### Cards / Containers

- **Corner Style:** gently squared surfaces (8px).
- **Background:** working white on the cool canvas.
- **Shadow Strategy:** none at rest.
- **Border:** one-pixel low-contrast divider.
- **Internal Padding:** 16–22px, selected according to information density.

### Inputs / Fields

- **Style:** white fill, strong neutral stroke and 6px corners.
- **Focus:** plum stroke and visible outer focus ring.
- **Error / Disabled:** error copy remains adjacent to the source; disabled controls preserve legible text.

### Navigation

The 228px aubergine rail uses labeled Lucide icons. Inactive items are quiet lavender-gray; hover increases contrast; the active item becomes a solid light surface without a colored side stripe. Mobile switches to a drawer plus a standard bottom navigation bar.

### Extraction Workspace

Page preview, extraction schema and normalized output remain visible as one task. Selected schema fields use a full lavender tint and border change; side stripes are forbidden. JSON is the only deliberately dark content surface because syntax contrast serves the task.

## 6. Do's and Don'ts

### Do:

- **Do** use the aubergine rail as the identity anchor and keep the work canvas light.
- **Do** reserve plum for primary actions, focus and current selection.
- **Do** use tables, dividers and spatial grouping before introducing another card.
- **Do** keep states explicit with text, icon and stable semantic color.
- **Do** preserve native keyboard behavior, visible focus and reduced-motion support.
- **Do** show real API or deterministic demo evidence only.

### Don't:

- **Don't** use purple gradients, glow, glassmorphism or decorative background grids.
- **Don't** repeat tiny uppercase tracked eyebrows above page and section titles.
- **Don't** use colored side stripes on cards, rows, alerts or selected fields.
- **Don't** nest cards or repeat identical icon-heading-copy cards when dividers can express the grouping.
- **Don't** use pill-shaped controls for ordinary actions or statuses.
- **Don't** animate layout properties or add decorative page-load choreography.
- **Don't** shrink persistent labels below 11px to create artificial density.
- **Don't** add fictitious metrics or controls solely to make a screenshot look busier.
