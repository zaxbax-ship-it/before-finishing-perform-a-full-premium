/**
 * Rewards & retention domain — public surface.
 *
 * Import types, the launch catalogue and the pure engine from here. Everything is
 * dependency-free and portable (web / server / SwiftUI / Compose). No persistence,
 * no React, no I/O lives in this module — see the repository + contract layers.
 */
export * from './types';
export * from './catalogue';
export * from './engine';
