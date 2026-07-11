/**
 * Central registry of the project's permanent visual assets (public/assets/**).
 * Reference assets through this map so paths are never hardcoded ad hoc and the
 * library can grow / be reorganized in one place as future stages add art.
 */
export const ASSETS = {
  /** Premium 3D one-million-dollar hero icon (public/assets/3d/icons). */
  million3d: '/assets/3d/icons/million-dollar-3d.png'
} as const;
