# Design

Visual system for V-CLASS. Adapted from the v-schl-portal design system
(`v-schl-portal/src/styles/tokens.css` + `global.css`) — that repo is the
source of truth; this file maps it onto V-CLASS's Tailwind v4 + shadcn stack.

## Theme

Dual theme, class-based (`.dark` on `<html>`, system default).
Dark is the brand-defining theme: deep navy `#000913`, surfaces stepping up
`#06121b → #0a1822`, white text in alpha tiers. Light theme: warm paper
`#f1f0ea` page, white surfaces, near-black ink.

A fixed, non-interactive atmosphere glow (gold bottom-left, cyan top-right
radial gradients at ~5% alpha) sits behind app content.

## Color

Brand + semantic (theme-independent):

| Token | Value | Use |
|---|---|---|
| cyan (primary) | `#00B2C2` | primary actions, active/selected state, focus, links |
| cyan-dark | `#008A99` | primary hover |
| cyan-electric | `#7DF9FF` | rare emphasis on dark surfaces |
| gold | `#D4AF37` | achievement, warmth, warning |
| ochre | `#B8860B` | gold's darker step |
| success | `#22c55e` | |
| danger | `#f87171` | |
| info | `#5d83ff` | |

shadcn mapping: `--primary` = cyan with dark-ink foreground `#001518`;
`--background/--card/--popover/--sidebar` = navy surface steps (dark) / paper +
white (light); `--border/--input` = hairline alphas (`white/8%`, `black/8%`);
`--ring` = cyan. School branding may override `--primary/--secondary/--accent`
inline on `<html>` — never hardcode cyan where "primary action" is meant.

Utility-class sweep rule: legacy `purple/violet/fuchsia-N` → `cyan-N`
(luminance-preserving), or the semantic `primary` token when the element is
app chrome. Decorative multi-hue sets may use cyan/teal/gold/amber families.

## Typography

- Display / headings: **Plus Jakarta Sans** (variable) — `--font-display`
- Body / UI: **Inter** (variable) — `--font-sans`
- Mono / data / micro-labels: **JetBrains Mono** (variable) — `--font-mono`

Signature micro-label: JetBrains Mono, 10px, weight 500, uppercase,
letter-spacing 0.18em, faint text color (`.label` utility). Tabular numerals
(`.mono`) for data. Fixed rem scale, ratio ~1.2; no fluid clamp headings.

## Shape & Depth

- Radii: cards 14px (`rounded-xl` with `--radius: 10px`), buttons/controls
  7–8px (`rounded-md`), pills 20px, chips 5px. Never > 16px on containers.
- Depth = surface steps + 1px hairline borders. No decorative drop shadows;
  shadows only on floating layers (popover/modal), small and tight.

## Motion

- 150–250ms; color/opacity 140ms ease; transforms `cubic-bezier(0.22,1,0.36,1)`
  (ease-out-quart). Buttons compress `scale(0.97)` on press.
- Motion conveys state only. Full `prefers-reduced-motion: reduce` fallback.

## Components

shadcn/base-ui primitives, rethemed via tokens (never per-component colors).
Primary button = solid cyan with `#001518` ink; outline/ghost = hairline
border, text-soft. Selection `::selection` = cyan with dark ink. Focus =
2px cyan outline, 2px offset. Skeletons shimmer; empty states teach.
