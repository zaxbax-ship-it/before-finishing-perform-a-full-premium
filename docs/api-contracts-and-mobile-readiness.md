# API Contracts & Mobile Readiness

This document describes the shared API contract layer introduced to move the
backend toward an **API-first** platform that serves the current web client and
future native **iOS** and **Android** apps from the same endpoints.

## API-first philosophy

- The Next.js route handlers under `src/app/api/**` are the product's backend.
  The web UI is just the first consumer.
- Every public endpoint returns a **discriminated envelope**: `{ ok: true, ... }`
  on success, `{ ok: false, error?, status? }` on failure. Clients branch on `ok`.
- Response **shapes are described once** in `src/lib/api/contracts` and imported
  by both the routes (compile-time enforcement via `satisfies`) and the tests
  (runtime validation via guards). Native clients mirror these shapes.

## Where the contracts live

`src/lib/api/contracts/`

| File | Contracts |
| --- | --- |
| `common.ts` | `ApiOk`, `ApiError`, `ApiEnvelope`, `API_CONTRACT_VERSION`, envelope guards |
| `health.ts` | `HealthResponse` (+ `isHealthResponse`) |
| `questions.ts` | `QuestionDto`, `QuestionsResponse` (+ guards) |
| `leaderboard.ts` | `LeaderboardEntryDto`, `LeaderboardResponse`, `LeaderboardSubmitResponse`, `PublicLeaderboardEntry` |
| `multiplayer.ts` | `MultiplayerLobbySummaryDto`, `ListLobbiesResponse` (public listing only) |
| `index.ts` | Barrel re-export — clients import from `@/lib/api/contracts` |

Contracts are **type + guard only**; they add no runtime behavior and change no
existing response.

## How future mobile apps should consume the backend

1. **Base URL** comes from `NEXT_PUBLIC_SITE_URL`. All endpoints are under `/api`.
2. **Gate on health**: call `GET /api/health` on launch; treat `status: 'down'`
   (HTTP 503) as backend-unavailable.
3. **Auth**: the backend uses Supabase Auth. Native apps authenticate with the
   Supabase mobile SDK and send the session; server authorization is unchanged and
   remains server-side only. Do not trust client role claims.
4. **Shared types**: generate the mobile models from these contracts (hand-port
   for Swift/Kotlin now; a generator can be added later). Never hand-invent shapes.
5. **Envelopes**: always branch on `ok`. Show `error` for failures; never surface
   raw server text.
6. **Idempotency & retries**: `GET` endpoints are safe to retry. Stateful
   multiplayer actions are not yet idempotent (see roadmap) — do not blind-retry.

## Contract versioning recommendations

- `API_CONTRACT_VERSION` is date-based and bumped **only on a breaking change**.
- **Additive changes are non-breaking**: adding an optional field does not bump the
  version. Clients must ignore unknown fields.
- **Breaking changes** (removing/renaming/retyping a field) ship under a new
  version and, if needed, a new path segment (e.g. `/api/v2/...`) while the old
  shape is kept for a deprecation window.
- Publish the version in a response or a header when a client needs to negotiate.

## DTO guidelines

- **Reuse domain types** where the public shape equals the internal one
  (`QuestionDto = Question`). Re-export through the contract module so clients
  never import internal paths.
- **Project, don't leak**: internal-only fields must not reach public responses.
  The leaderboard currently returns `authUserId`/`isHidden`; `PublicLeaderboardEntry`
  documents the intended tightened shape for the next breaking version. (Not
  changed now to preserve current behavior.)
- **No secrets, ever** in responses (enforced by a health smoke test).
- Keep DTOs flat and serializable (no class instances, no `Date` objects — use ISO
  strings, as the code already does).

## Future API evolution strategy

1. Contract the remaining stateful multiplayer responses (join/start/answer/state)
   once their logic is stable, with careful separation of per-player private data.
2. Tighten the leaderboard public projection (drop internal fields) under a version
   bump.
3. Add idempotency keys to stateful multiplayer actions (also improves mobile retry
   safety).
4. Consider generating mobile client models from the contract types.
5. Grow the smoke suite alongside each newly contracted endpoint.

## Testing foundation

A first Vitest smoke/integration suite lives in `test/` (run with `npm test`):

- `test/api/health.test.ts` — invokes the real `GET /api/health`; asserts contract
  validity and that no secret material appears.
- `test/api/questions-contract.test.ts` — balanced sampling behavior + response
  contract validation.
- `test/auth/admin-guard.test.ts` — the admin allowlist authorization primitive.
- `test/api/multiplayer-contract.test.ts` — public lobby listing contract.
- `test/contracts/envelope.test.ts` — envelope guards + version.

Vitest aliases `server-only` to a no-op stub (`test/setup/empty-module.ts`) so
backend modules can be exercised in Node; the real `next build` still enforces the
server-only boundary. Test files are excluded from the production type-check.
