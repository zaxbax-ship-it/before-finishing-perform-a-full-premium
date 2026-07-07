/**
 * Test stub for the `server-only` import marker.
 *
 * Almost every backend module transitively imports `server-only`, whose client
 * entry throws when loaded outside a React Server Component bundle. Vitest runs
 * plain Node, so we alias `server-only` to this no-op module (see vitest.config.ts)
 * to exercise server code paths in isolation. This does not weaken the real build:
 * `next build` still enforces the server-only boundary.
 */
export {};
