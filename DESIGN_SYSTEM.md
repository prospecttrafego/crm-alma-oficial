# Alma CRM — Design System (Definitive)

This document is the single source of truth for the **Frontend visual system** (tokens, components, and usage patterns). Any previous design guideline documents should be considered removed/obsolete.

## Brand Foundation

### Core Brand Colors

- **Brand Navy**: `#041E42` (RGB `4, 30, 66`) — brand anchor (typography, sidebar, structure)
- **Action Cyan**: `#41B6E6` (RGB `65, 182, 230`) — primary actions, highlights, focus

### Design Principles

- **Premium Minimalist**: clean surfaces, subtle borders, restrained color usage, comfortable long-session contrast
- **Token-first**: avoid hard-coded colors; prefer semantic tokens via Tailwind utilities (e.g. `bg-card`, `text-foreground`)
- **Clarity > decoration**: avoid heavy gradients and noisy backgrounds; use elevation and spacing for hierarchy

## Tokens (CSS Variables)

The canonical token implementation lives in `client/src/index.css`.

### Surface Tokens (Light Mode)

- `--background`: white
- `--foreground`: Brand Navy
- `--card`: white
- `--card-border`: `#E5E9F0`
- `--muted` / `--secondary`: `#F5F7FA`
- `--muted-foreground`: calm blue-gray (for metadata and secondary text)

### Surface Tokens (Dark Mode)

Dark mode is **neutral-first** (reduces eye fatigue). Brand Navy is still used as a structural anchor in the sidebar.

- `--background`: deep neutral
- `--card`: deep neutral (slightly elevated from background)
- `--border`: muted neutral border
- `--foreground`: near-white, not pure white

### Action & Focus

- `--primary`: Action Cyan
- `--primary-foreground`: Brand Navy (chosen for contrast on cyan)
- `--ring`: Action Cyan (focus ring)

### Sidebar

The sidebar stays **Brand Navy in both modes** to keep a stable anchor:

- `--sidebar`: Brand Navy
- `--sidebar-primary`: Action Cyan
- `--sidebar-foreground`: near-white

### Data Visualization

Charts must use token-driven colors:

- `--chart-1..5` (see `client/src/index.css`)
- Prefer `ChartContainer` from `client/src/components/ui/chart.tsx` to map series keys → CSS variables.

## Typography

### Font Stack

- UI font: `Inter` (via `--font-sans`)
- Keep headings **semibold** and compact; use spacing and hierarchy instead of heavy weights.

### Recommended Hierarchy

- Page title: `text-2xl font-bold`
- Section/card title: `text-base font-semibold`
- Description/meta: `text-sm text-muted-foreground`

## Layout Patterns

### Sidebar

- Navy background, consistent in both themes
- Use icons + labels; keep active state subtle (accent + elevation)

### Inbox (Three-Panel)

The Inbox follows a **three-panel layout**:

1. List panel (left)
2. Thread panel (center)
3. Context panel (right)

Panels support **collapsing** from the thread header to optimize focus on long threads.

### Reports / Executive Overview

Reports emphasize “Executive Dashboard” patterns:

- Top stat cards with icon + value + supporting description
- Time-series charts with subtle area fill
- Donut/pie charts as restrained supporting visuals
- Horizontal bar charts for distributions

## Components

### Cards

- Always use `Card` (`client/src/components/ui/card.tsx`)
- Use subtle borders and `shadow-sm` (token-driven)
- Use `rounded-xl` for a modern premium feel

### Buttons

- Primary: `variant="default"` (Action Cyan)
- Outline: `variant="outline"` for secondary actions
- Focus: rely on `ring` token for consistent keyboard accessibility

### Elevation & Interaction

Use the elevate utilities defined in `client/src/index.css`:

- `hover-elevate`, `active-elevate-2` for subtle interaction states
- Avoid aggressive shadows or strong color shifts

## Accessibility

- Keep readable contrast for long sessions (avoid pure black on white, avoid pure white on deep black)
- Focus ring must remain visible (`--ring`)
- Prefer icon + text for critical actions (don’t rely on color alone)

## Implementation Rules (Non-Negotiable)

- No hard-coded non-token colors. Use tokens.
- Do not change charting libraries; apply styling via tokens and Recharts configuration only.
- When introducing new visuals, update `client/src/index.css` tokens instead of scattering styles.
