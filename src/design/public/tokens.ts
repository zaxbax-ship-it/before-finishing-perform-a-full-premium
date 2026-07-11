/**
 * Public Design System — canonical design tokens (TypeScript view).
 *
 * The Solo Gameplay screen is the Design Master. These mirror the CSS custom
 * properties (see ./tokens.css and :root in globals.css) so tooling, docs and
 * any JS consumer read from ONE authoritative source. Prefer the CSS `var()`
 * form in styles; use these constants for logic / documentation.
 */
export const PUBLIC_TOKENS = {
  color: {
    gold: '#f7ca67',
    goldDeep: '#b97724',
    azure: '#45c2ff',
    violet: '#7d6cff',
    ink: '#f8fbff',
    muted: '#b8c6e4',
    danger: '#ff6172',
    success: '#55f0b5',
    bg: '#030612',
  },
  radius: {
    sm: '12px', md: '16px', lg: '20px', xl: '24px',
    '2xl': '28px', '3xl': '32px', '4xl': '36px', full: '9999px',
  },
  glass: {
    /** Answer-card body. */ surface: 'var(--stage-glass)',
    /** Inner surfaces. */ quiet: 'var(--stage-glass-quiet)',
  },
  edge: {
    cyan: 'var(--stage-edge-cyan)',
    cyanStrong: 'var(--stage-edge-cyan-strong)',
  },
  shadow: {
    depth: 'var(--stage-depth)',
    xl: 'var(--shadow-xl)',
  },
  border: {
    hairline: 'hsla(0, 0%, 100%, 0.16)',
  },
} as const;

/**
 * The canonical, approved public surface class names (the CSS layer of the
 * design system). Components should route through the primitives in
 * ./primitives rather than hard-coding these strings.
 */
export const PUBLIC_CLASSES = {
  page: 'mx-auto max-w-5xl px-5 pb-16 pt-6',
  surface: 'glass stage-panel rounded-[28px] p-5 md:p-8',
  interactive: 'stage-interactive focus-ring',
  buttonPrimary: 'premium-button focus-ring',
  buttonSecondary: 'ghost-button focus-ring',
  input: 'form-input',
  modalBackdrop: 'modal-backdrop',
  modalCard: 'glass modal-card stage-panel',
  metric: 'metric-tile rounded-3xl p-5 text-center',
} as const;
