# Alma CRM Design Guidelines

## Design Philosophy

Alma CRM follows a **Premium Minimalist** approach — clean interfaces with sophisticated color choices and subtle depth through glass morphism effects. The design emphasizes clarity, professionalism, and trust.

## Brand Identity

### Primary Colors

| **Name**        | **Hex**   | **RGB**           | **Usage**                            |
| --------------- | --------- | ----------------- | ------------------------------------ |
| Navy            | `#041E42` | rgb(4, 30, 66)    | Sidebar, dark mode backgrounds, text |
| Cyan / Sky Blue | `#41B6E6` | rgb(65, 182, 230) | Primary actions, accents, highlights |

### Supporting Colors

| **Name**   | **Light Mode** | **Dark Mode** | **Usage**              |
| ---------- | -------------- | ------------- | ---------------------- |
| Background | `#FFFFFF`      | `#0A1628`     | Main content area      |
| Card       | `#FFFFFF`      | `#0D1E33`     | Card surfaces          |
| Muted      | `#F5F7FA`      | `#152238`     | Secondary backgrounds  |
| Border     | `#E5E9F0`      | `#1E3A5F`     | Dividers, card borders |

### Semantic Colors

| **Purpose** | **Color** | **Usage**                                      |
| ----------- | --------- | ---------------------------------------------- |
| Success     | `#22C55E` | Won deals, positive trends                     |
| Warning     | `#F59E0B` | Medium priority, pending states                |
| Danger      | `#EF4444` | Lost deals, high priority, destructive actions |

## Typography

### Font Stack

- **Display**: Plus Jakarta Sans (headings, titles)
- **Body**: Inter (UI text, paragraphs)
- **Mono**: JetBrains Mono (code, data)

### Scale

| **Level** | **Size** | **Weight** | **Line Height** | **Usage**        |
| --------- | -------- | ---------- | --------------- | ---------------- |
| H1        | 24px     | 700        | 1.2             | Page titles      |
| H2        | 20px     | 600        | 1.3             | Section headers  |
| H3        | 16px     | 600        | 1.4             | Card titles      |
| Body      | 14px     | 400        | 1.5             | Default text     |
| Small     | 12px     | 400        | 1.5             | Labels, metadata |
| XS        | 11px     | 500        | 1.4             | Badges, tags     |

## Spacing System

Based on 4px grid:

- `4px` — Tight spacing (icon gaps)
- `8px` — Compact spacing (button padding)
- `12px` — Default spacing (form fields)
- `16px` — Comfortable spacing (card padding)
- `24px` — Section spacing
- `32px` — Large gaps
- `48px` — Page margins

## Component Patterns

### Glass Cards

Used for elevated content. Subtle navy-tinted backgrounds with thin borders.

**Light Mode:**

```css
background: rgba(4, 30, 66, 0.03);
border: 1px solid rgba(4, 30, 66, 0.08);
```

**Dark Mode:**

```css
background: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 255, 255, 0.10);
```

### Buttons

- **Primary**: Cyan background, white text (dark mode: navy text)
- **Secondary**: Light gray background, navy text
- **Ghost**: Transparent, hover reveals background
- **Destructive**: Red background for dangerous actions

### Avatars

- Round with subtle border
- Primary color tint for initials
- Size variants: 24px, 32px, 40px, 64px

## Interaction States

### Hover

- Cards: Slightly darken background
- Buttons: Brightness adjustment via elevation system
- List items: Subtle background reveal

### Focus

- Ring color: Cyan (`#41B6E6`)
- Offset: 2px
- Ring width: 2px

### Active/Selected

- Sidebar items: Cyan text, accent background
- List selections: Elevated glass background

## Layout Patterns

### Sidebar

- Fixed width: 256px (expanded), 64px (collapsed)
- Dark navy background in both modes
- Logo at top with brand mark
- Navigation with icons and labels
- User profile at bottom

### Three-Panel Inbox

1. **List Panel** (320px): Conversation list with search
2. **Message Panel** (flex): Thread view with composer
3. **Context Panel** (320px): Contact/deal information

### Kanban Board

- Horizontal scroll for stages
- Draggable cards within columns
- Stage headers with count and value total

## Icons

- Library: Lucide React
- Stroke width: 1.75 (lighter feel)
- Size: 16px (inline), 20px (buttons), 24px (navigation)
- Color: Inherit from text or specific semantic color

## Motion

### Transitions

- Default duration: 200ms
- Easing: `ease-out` for entries, `ease-in-out` for state changes
- Properties: opacity, transform, background-color

### Micro-interactions

- Button hover: Subtle elevation
- Card hover: Gentle lift
- Menu expansion: Smooth slide

## Dark Mode Considerations

- Reduce contrast slightly (not pure black/white)
- Use semi-transparent overlays for depth
- Cyan accent remains vibrant
- Shadows become more pronounced (higher opacity)
- Glass effects use white tint instead of navy

## Accessibility

- Minimum contrast ratio: 4.5:1 for body text
- Focus indicators always visible
- Interactive targets: minimum 44x44px touch area
- Color is never the only indicator of state

## Do's and Don'ts

### Do

- Use generous whitespace
- Maintain consistent spacing
- Let the cyan accent draw attention
- Use glass effects sparingly for hierarchy

### Don't

- Use gradients (per brand preference)
- Overcrowd interfaces
- Mix too many font weights
- Use pure black text on white

