# Lore — Claude Code Guidelines

## Stack
- **Framework:** Next.js 14 App Router (`'use client'` where needed)
- **Language:** JavaScript (JSX) — no TypeScript
- **Styling:** CSS Modules + CSS Custom Properties
- **Auth/DB:** Firebase Auth + Firestore (project: `lore-f5f5a`)
- **Media data:** TMDB API
- **Icons:** lucide-react + Font Awesome (CDN)
- **Fonts:** Inter (body), Inter Tight (display) — Google Fonts

---

## Design Tokens

All tokens live in **`src/styles/tokens.css`** — imported once via `globals.css`. Never duplicate `:root` blocks elsewhere.

### Colors
```css
/* Surfaces */
--color-surface-default: #141218;
--color-surface-contrast: #1c1b21;
--color-surface-selected: #303039;
--color-surface-hovered: #2b2a33;
--color-surface-inverse: #fefefe;

/* Text */
--color-text-default: #fefefe;
--color-text-secondary: rgba(255, 255, 255, 0.5);
--color-text-inverse: #323233;

/* Icons */
--color-icon-default: #fefefe;
--color-icon-secondary: #ceced2;
--color-icon-tertiary: #6c6c70;

/* Actions */
--color-action-default: #fefefe;
--color-action-hovered: #b6b6b9;

/* Borders */
--color-border-default: #2a2930;
--color-border-secondary: #1e1d24;
--color-border-selected: #58585f;
```

### Spacing (4px base unit)
```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;
--space-4: 16px;  --space-5: 20px;  --space-6: 24px;
--space-7: 28px;  --space-8: 32px;  --space-9: 36px;
--space-10: 40px; --space-12: 48px;
```

### Layout
```css
--max-width: 1300px;
--content-max-width: 750px;
--navbar-height: 80px;
--page-padding: 50px;          /* desktop */
--page-padding-mobile: 25px;   /* ≤960px */
```

### Border Radius
```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 32px;
```

### Transitions
```css
--transition-fast: all 0.2s ease;
--transition-base: all 0.3s ease;
--transition-slow: all 0.5s ease;
```

### Typography
```css
--font-sans: 'Inter', sans-serif;
--font-tight: 'Inter Tight', sans-serif;
```

---

## Styling Rules

- **Always use `var(--token-name)`** — never hardcode colors, spacing, or font values that exist as tokens.
- **CSS Modules** for all component styles — one `.module.css` per component.
- **Composition via `composes:`** for variant patterns instead of duplicating rules.
- **Single breakpoint:** `@media screen and (max-width: 960px)` for mobile.
- Dark theme is fixed — no light mode support.

### Button Patterns
```css
/* Primary (white fill) */
background: var(--color-surface-inverse);
color: var(--color-text-inverse);
border: none;
/* hover: */ background: var(--color-action-hovered);

/* Secondary (outline) */
border: 1px solid var(--color-border-default);
background: transparent;
color: var(--color-text-default);
/* hover: */ background: var(--color-surface-hovered);
```

### Modal Pattern
Use the generic `Modal` component (`src/components/Modal.jsx`):
```jsx
<Modal
  title="Title"
  onClose={handleClose}
  maxWidth="400px"
  actions={[
    { label: 'Cancel', onClick: handleClose, variant: 'secondary' },
    { label: 'Save', onClick: handleSave, disabled: !canSave },
  ]}
>
  {/* body content */}
</Modal>
```

---

## Component Library (`src/components/`)

| Component | Purpose |
|-----------|---------|
| `Navbar.jsx` | Sticky nav with mobile hamburger |
| `MediaCard.jsx` | Movie/TV card — variants: `explore`, `profile`, `grid` |
| `Modal.jsx` | Generic modal with header, body, CTA actions |
| `ProfileTabs.jsx` | Tabbed content: Lists, Movies, Shows, Watchlist |
| `AddToListModal.jsx` | Add media to watchlist or custom lists |

---

## Routes (`src/app/`)

| Route | Description |
|-------|-------------|
| `/` | Landing — hero carousel + service cards |
| `/login` | Firebase auth |
| `/signup` | Firebase registration |
| `/onboarding` | First-time user setup (username + Letterboxd import) |
| `/explore` | Debounced TMDB search with filter chips |
| `/details?id=&media_type=` | Media details + binary insertion sort rating |
| `/profile` | Current user profile |
| `/user?uid=` | Other user profiles |
| `/list?id=` | Custom list details |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/styles/tokens.css` | Single source of truth for all CSS variables |
| `src/app/globals.css` | Imports tokens, resets, Google Fonts |
| `src/contexts/AuthContext.jsx` | Provides `{ user, initials, photoURL, loading }` |
| `src/lib/firebase.js` | Firebase init |
| `src/lib/tmdb.js` | TMDB helpers + `getPosterUrl(path, size)` |

---

## Icons

lucide-react — import named icons, always pass `size` prop:
```jsx
import { Globe, Lock, Check, X } from 'lucide-react';
<Globe size={14} />
```

Font Awesome via CDN for legacy usage:
```jsx
<i className="fas fa-camera" aria-hidden="true" />
```

---

## Assets (`public/images/`)

| File | Usage |
|------|-------|
| `Rabbit.svg` | Primary app logo |
| `Lore-mobile.svg` | Mobile logo variant |
| `Letterboxd.svg` | Letterboxd brand icon |
| `default-avatar.svg` | Fallback user avatar |
| `placeholder.png` | Generic media placeholder |

TMDB posters loaded via:
```js
import { getPosterUrl } from '../lib/tmdb';
getPosterUrl(posterPath, 'w185'); // w92 | w185 | w342 | w500 | w780 | original
```

---

## Figma → Code Workflow

When implementing a Figma design:

1. **Map colors** to the nearest `--color-*` token — never use raw hex values that exist as tokens.
2. **Map spacing** to `--space-N` — use the closest 4px-unit value.
3. **Use existing components** (`Modal`, `MediaCard`, etc.) before creating new ones.
4. **CSS Modules** — add styles to the relevant `.module.css` file, not inline.
5. **Reuse button patterns** — primary (inverse fill) or secondary (outline) from the patterns above.
6. **Font sizes** — prefer inheriting body size; use explicit sizes only for headings or when Figma specifies a deviation.
7. **Border radius** — use `--radius-sm` (4px), `--radius-md` (8px), or `--radius-lg` (32px). For circular elements use `border-radius: 50%`.
