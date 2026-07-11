import type { ReactNode } from 'react';
import { PublicPanel, PublicMetric, PublicField, PublicSuccess, PublicIconButton } from '@/design/public/primitives';

/**
 * Shared trivia-screen primitives — now thin re-exports of the centralized
 * Public Design System (`src/design/public`). Kept for import-path stability;
 * new code should import from '@/design/public' directly. The Solo Gameplay
 * screen is the Design Master and these all derive from it.
 */

/** Titled public page panel. `icon` is accepted for signature compatibility
 * (the shared header intentionally shows no decorative icon). */
export function Panel({ title, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return <PublicPanel title={title}>{children}</PublicPanel>;
}

export const Field = PublicField;
export const Metric = PublicMetric;
export const Success = PublicSuccess;
export const IconButton = PublicIconButton;
