# Product

## Register

product

## Users

Students and lecturers of V-SCHL tenant schools. Students land here from the
V-SCHL student portal to take AI-generated interactive lessons (multi-agent
classroom, chat, whiteboard, quizzes); lecturers and school admins generate
classrooms from course material and manage branding/quotas. Users arrive
mid-task from the portal, so V-CLASS must feel like a room in the same
building — not a different product.

## Product Purpose

V-CLASS (`dv-class`, OpenMAIC-based Next.js app) is the AI classroom of the
V-SCHL platform. It consumes the Core bridge API (syllabus, progress, quotas)
and owns all AI features that were removed from the portal. Success: a student
moving portal → V-CLASS perceives zero brand seam, and the classroom stays
legible during long reading/learning sessions.

## Brand Personality

Composed, scholarly, precise. Deep-navy calm with cyan as the single active
color and gold reserved for achievement/warmth. Quiet chrome, content forward.
Three words: disciplined, luminous, trustworthy.

## Anti-references

- The upstream OpenMAIC look: stock shadcn grays + purple `#722ed1` primary,
  decorative violet gradients, glassy blurred hero panels. That is the seam we
  are removing.
- Generic SaaS dashboard clichés: hero-metric cards, glassmorphism as default,
  gradient text.

## Design Principles

1. **One platform, one language** — tokens, radii, type, and motion come from
   the v-schl-portal design system (`src/styles/tokens.css` there is the
   source of truth). Never invent a parallel palette.
2. **Hairlines over shadows** — depth via surface steps (`bg → surface →
   surface-2`) and 1px lines, not drop shadows.
3. **Cyan means "act", gold means "achieve"** — accent color only on primary
   actions, selection, active state; gold only for accomplishment/highlight.
4. **Classroom stays quiet** — motion conveys state (150–250ms, ease-out-quart);
   no decorative choreography while a student is learning.
5. **Branding-safe theming** — school branding may override `--primary` /
   `--secondary` / `--accent` at runtime (server-injected on `<html>`); all
   accent usage must flow through those semantic tokens so overrides win.

## Accessibility & Inclusion

Body text ≥ 4.5:1 on its surface in both themes; visible 2px cyan
`:focus-visible` outline everywhere; full `prefers-reduced-motion` fallback;
light/dark/system theme respected (class-based `.dark`, system default).
Bilingual FR/EN UI — labels must survive French string lengths.
