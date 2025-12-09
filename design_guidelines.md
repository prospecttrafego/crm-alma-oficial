# Design Guidelines for Alma CRM SaaS

## Design Approach
**Reference-Based + Custom Brand Identity**: This CRM follows modern SaaS patterns (Linear for clean typography, Pipedrive for kanban UX, Intercom for inbox layout) while strictly adhering to Alma's brand identity.

## Brand Identity

**Colors** (User-Specified Palette):
- Background Light: `#f5f5f5`
- Black: `#000000`
- White: `#ffffff`
- Gray-Blue: `#475467`
- Purple Accent: `#605be5`

**Theme**: Dark gray primary theme with purple accent (#605be5)

**Logo Integration**:
- Desktop header (white logo on dark background)
- Login/splash screen
- Favicon/app icon

## Typography
- Font Family: Inter, Manrope, or SF Pro-like
- Style: Modern and minimalist
- Hierarchy: Clear distinction between headings, body text, and labels using weight and size

## Layout System
**Spacing Units**: Use Tailwind spacing primitives - primarily `2, 4, 8, 12, 16` for consistency
- Small gaps: `p-2`, `gap-2`
- Standard padding: `p-4`, `p-8`
- Section spacing: `py-12`, `py-16`

**Layout Structure**:
- Dark sidebar: `#000` or `#111` with `#475467` touches
- Dark topbar with white Alma logo
- Main content area with clean cards

## Component Library

**Buttons**:
- Primary (filled): Background `#605be5`, white text
- Secondary (outline): Border `#605be5`, text `#475467`
- No hover states specified - use component defaults

**Cards**:
- Background: `#1b1b1b` in dark mode
- Borders: Soft, subtle
- Corners: Slightly rounded (rounded-lg to rounded-xl)

**Navigation**:
- Sidebar navigation (persistent, dark)
- Active states use `#605be5` accent

**Inbox Layout** (3-column):
1. Conversation list (with filters, search)
2. Message view (chat interface)
3. Context panel (contact/deal info)

**Kanban Board**:
- Horizontal columns for pipeline stages
- Drag-and-drop cards
- Real-time updates via WebSocket

**Forms & Inputs**:
- Clean, modern inputs
- Consistent spacing
- Clear validation states

## Interaction Patterns

**Keyboard Shortcuts**:
- `j/k` or arrows: Navigate lists
- `r`: Reply to message
- `c`: Create internal comment
- `Cmd+K`: Quick search

**Performance Requirements**:
- Fast loading (skeleton states)
- 2-3 clicks maximum for frequent actions
- Optimistic UI updates
- Real-time WebSocket feedback

## Whitespace & Visual Balance
- Generous whitespace throughout
- Clean, uncluttered interfaces
- Breathing room between components
- Focus on readability and scannability

## Accessibility
- Clear visual hierarchy
- Sufficient color contrast
- Keyboard navigation support
- Loading states for async operations

## Images
No hero images specified for this internal CRM application. Focus on functional UI with clean data visualization and card-based layouts.