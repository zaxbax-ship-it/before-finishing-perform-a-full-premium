# Public Design System

The **Solo Gameplay screen is the Design Master** — the single approved visual
language for the entire public product. This package (`src/design/public`) is
the one source of truth for that language.

## Design master rule

- Every public screen, dialog, modal, popover, drawer, toast, overlay, form,
  panel, list, card, empty/loading/error state and interaction derives its
  appearance from this design system.
- **Creating new standalone public visual styles is not allowed** unless
  explicitly approved. Extend the tokens / primitives here instead.
- If the Solo Gameplay visual language changes, update the tokens/primitives
  here and the rest of the public product inherits it.
- **Admin is intentionally excluded** and must not use these primitives.

## What's here

| File | Role |
|---|---|
| `tokens.css` | Canonical CSS custom properties (navy glass, cyan edge-light, depth). The single source for the gameplay-derived design values. Imported once in the root layout. |
| `tokens.ts` | The TypeScript view of the tokens + the approved canonical class names (`PUBLIC_TOKENS`, `PUBLIC_CLASSES`). |
| `primitives.tsx` | The approved React primitives (server-safe). |
| `PublicModal.tsx` | The one approved public dialog (backdrop + glass card + focus trap + dismiss). |
| `index.ts` | Barrel — import everything from `@/design/public`. |

## Primitives

`PublicPage`, `PublicSurface`, `PublicPanel`, `PublicInteractiveCard`,
`PublicButton` (`primary` / `secondary` / `danger`), `PublicInput`,
`PublicTextarea`, `PublicSelect`, `PublicField`, `PublicMetric`,
`PublicSuccess`, `PublicIconButton`, `PublicModal`.

Each composes the canonical approved CSS layer:

- **surface / panel** → `glass stage-panel` (deep-navy glass + cyan lower-edge)
- **interactive card** → `stage-interactive` (answer-card navy + azure hover)
- **primary button** → `premium-button` · **secondary** → `ghost-button`
- **inputs** → `form-input` (dark glass + cyan focus edge)
- **modal** → `modal-backdrop` + `glass modal-card stage-panel`
- **metric tile** → `metric-tile`

The shared `src/components/trivia/primitives.tsx` (`Panel`, `Metric`, `Field`,
`Success`, `IconButton`) re-exports these, so every screen already using them
inherits the design system automatically.

## Usage

```tsx
import { PublicPanel, PublicButton, PublicInput } from '@/design/public';

<PublicPanel title={t.title}>
  <PublicInput placeholder={t.placeholder} />
  <PublicButton variant="primary" onClick={submit}>{t.submit}</PublicButton>
</PublicPanel>
```
