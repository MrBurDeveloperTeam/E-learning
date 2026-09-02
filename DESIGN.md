---
version: alpha
name: "DentalLearn"
description: "A calm, clinical learning community for dental professionals, expressed through soft teal operational surfaces and focused content." 
colors:
  background: "#F7FAFA"
  surface: "#FFFFFF"
  primary: "#88C1BD"
  primary-dark: "#2D6E6A"
  foreground: "#1E3333"
  muted: "#6B8E8E"
  border: "#D4E8E7"
  danger: "#DC2626"
typography:
  sans:
    fontFamily: "Inter, system-ui, sans-serif"
  playful:
    fontFamily: "Fredoka, Inter, system-ui, sans-serif"
rounded:
  DEFAULT: "0.5rem"
  control: "0.75rem"
  card: "1.75rem"
spacing:
  control-height: "2.75rem"
  card-gap: "1rem"
  page-section-gap: "1rem"
components:
  button: {}
  card: {}
  select: {}
  status-badge: {}
---

# DentalLearn Design System

## Overview

### Creative North Star

The interface should feel like a well-run contemporary dental clinic: bright, composed, hygienic, and reassuring, with instruments arranged by task rather than used as decoration.

### Product context and register

- **Audience and primary job:** Dental professionals and administrators discover, review, and manage clinical learning videos.
- **Target markets:** Malaysia and Southeast Asia, based on the product metadata and existing English-language interface.
- **Locale and language policy:** Product UI is currently English. Imported titles retain their source language.
- **Usage scene:** Responsive web use, with administrators completing focused operational tasks on desktop and viewers browsing on desktop or mobile.
- **Register:** Hybrid. Public learning surfaces carry the Snabbb identity; authenticated admin routes prioritize operational clarity.
- **Memorable signature:** Soft teal clinical surfaces with large, quiet card radii and compact specialty/status pills.
- **Restraint:** Admin forms, failure messages, and results remain familiar, dense enough to scan, and free of decorative motion.
- **Anti-references:** Avoid generic neon SaaS dashboards, hospital-blue severity everywhere, and playful pet styling inside operational admin controls.
- **Token ownership/runtime mapping:** This document mirrors the established runtime source in `src/index.css` and `tailwind.config.ts`; runtime CSS variables remain canonical.

## Colors

Teal communicates brand and selection without replacing semantic tones. White and near-white surfaces provide the clinical base. Foreground and muted teal-neutrals establish hierarchy. Success, warning, and danger use their established semantic colors with text or icons so meaning never depends on color alone. Dark mode preserves the same hierarchy through the CSS variables in `src/index.css`.

## Typography

Inter is the product and admin typeface, with medium or semibold weights reserved for headings, field labels, and high-value counts. Fredoka is limited to the virtual-pet experience. Operational copy uses sentence case; compact uppercase is reserved for data labels and section eyebrows.

## Layout

Admin content uses responsive grids, 1rem panel gaps, natural document scrolling, and a 44px minimum height for primary controls. Forms collapse to one column at narrow widths. Async feedback appears below the owning operation and reserves stable button geometry while running.

## Elevation & Depth

Hierarchy comes from tonal surfaces, borders, and the established low card shadow. Strong shadows and blur are reserved for overlays. Dark mode relies more heavily on borders than shadows.

## Shapes

Controls use 12px radii, admin cards use approximately 28px radii, and statuses use pills. Icon containers may use a radius between the control and card sizes. Rounded shapes should group related information, not decorate every line.

## Components

### Foundational visual states

Interactive controls provide hover, visible focus, pressed, disabled, and busy states. Loading uses the existing Lucide spinner and keeps the button width stable. Errors remain inline until the user retries successfully.

### Buttons and actions

Brand-filled buttons are reserved for the primary safe action. Neutral bordered buttons handle secondary operations. Buttons pair unfamiliar icons with visible labels and use explicit disabled cursors and opacity.

### Navigation and data display

Admin navigation and cards reuse the shared admin primitives. Status badges combine text with semantic tone. Result grids change column count responsively without hiding values.

### Forms and overlays

Forms use explicit labels and app-owned validation. Authored selects use the shared Base UI Select primitive with trigger-width popups, keyboard behavior, collision handling, and visible focus.

### Iconography

Lucide is the canonical icon family, using consistent outline strokes at 16–24px. Operational actions keep text labels unless the meaning is universally clear.

### Motion

Motion communicates loading, entry, or state change and stays brief. Reduced-motion preferences take precedence over decorative transitions.

### Content and data visualization

Copy is direct and operational: name the action, outcome, and recovery. Counts use locale-aware formatting. Imported content preserves source attribution and does not imply that DentalLearn owns the video.

## Do's and Don'ts

- **Do:** Reuse semantic CSS variables and shared admin primitives.
- **Do:** Place actionable API errors beside the operation that failed.
- **Don't:** Hide partial failures behind a successful zero-result state.
- **Don't:** introduce isolated raw brand colors or novel component geometry for a single admin workflow.
