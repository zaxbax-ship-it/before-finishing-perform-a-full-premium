# Architecture Audit - Pass 1

## Scope of this pass

This pass intentionally focuses on safe, reviewable architectural improvements.
It does not attempt a large refactor.

Goals for this pass:

- audit the current platform as a long-term product foundation
- identify the highest-risk architecture gaps
- improve only low-risk, backward-compatible foundations
- leave larger structural changes for future passes

## Executive summary

The project already contains several strong long-term foundations:

- repository/provider abstraction for local JSON and Supabase-backed data
- centralized infrastructure configuration
- optional external service adapters
- protected auth/admin flows
- multiplayer service layer separated from route handlers
- production-oriented health, observability, and rate-limiting groundwork

The main remaining challenges are architectural concentration and platform coupling:

- too much product behavior still lives in a few very large UI-centric modules
- some boundaries between server-only code and shared code were implicit rather than enforced
- mobile/API-first contracts exist in pieces, but are not yet fully formalized as a stable product API surface
- testing readiness and automation coverage are still behind the rest of the architecture

## Current scorecard

- Overall architecture: 7.8 / 10
- Production readiness: 7.4 / 10
- Mobile readiness: 6.8 / 10
- AI readiness: 7.5 / 10
- UX maturity: 8.4 / 10

## What was improved in this pass

### 1. Explicit server-only boundaries

Added `server-only` guards to backend-only modules so they cannot be imported accidentally into client bundles later.

This reduces future platform risk because:

- secrets and infrastructure code stay on the server
- repository/provider logic remains backend-owned
- route/security helpers are prevented from drifting into web-only UI code
- future mobile clients are encouraged to consume APIs rather than internal server modules

### 2. Platform architecture documentation

This audit document establishes a shared reference point for the next architectural passes:

- what is already strong
- what is still risky
- what should happen before launch
- what should happen after launch

## Strong foundations already present

### Data access

- Repository interfaces are in place.
- Local JSON and database providers already exist.
- Provider factory is established.
- The question-loading fallback strategy for gameplay is thoughtful and resilient.

### Infrastructure

- centralized env/config handling
- optional external adapters
- health endpoint
- Sentry groundwork
- distributed rate limiting foundation

### Security and operations

- auth enforcement exists
- admin gating exists
- service-role handling is separated from browser-safe keys
- multiplayer APIs already have defensive logging and rate-limit hooks

### Product/system thinking

- multilingual support is real, not decorative
- public/admin separation exists
- leaderboard and moderation concepts are already modeled
- AI moderation architecture is staged behind provider abstraction

## Highest-priority risks still remaining

### Critical before launch

1. Test coverage is still too light for the amount of surface area.
   - Especially auth, leaderboard writes, multiplayer flows, and moderation decisions.

2. The main gameplay UI remains concentrated in a very large component.
   - This increases regression risk and slows future native/API-first work.

3. Public API contracts are not yet formalized enough for future mobile clients.
   - Routes work, but the app still behaves more like a web app with APIs than a product whose APIs are the core platform contract.

### Important before launch

1. Shared DTO and validation contracts should be tightened around public APIs.
2. More server/client boundaries should be documented explicitly.
3. Route-level integration tests should exist for critical APIs.
4. Multiplayer lifecycle and reconnect behavior should be verified under load, not only functionally.

### Improves long-term maintainability

1. Break down oversized presentation modules into feature slices.
2. Introduce stable API contract modules for mobile consumption.
3. Separate pure domain logic from UI-specific orchestration more aggressively.
4. Add stronger naming conventions around “platform”, “service”, “provider”, and “adapter” responsibilities.

### Nice to have later

1. ADR-style design records for big systems
2. internal package boundaries if the product grows into a monorepo
3. dedicated client analytics abstraction for web and native parity
4. worker/queue architecture for heavier AI and moderation workflows

## Recommended roadmap

### Pass 2

- formalize shared API response/request DTO contracts
- document the public backend surface for future mobile clients
- add route-level smoke tests for auth, leaderboard, questions, and multiplayer

### Pass 3

- extract the heaviest gameplay UI module into smaller feature components
- preserve behavior exactly while reducing architectural concentration

### Pass 4

- strengthen moderation workflow persistence and retry semantics
- define async processing boundaries for future AI-heavy workflows

### Pass 5

- prepare native-client support explicitly:
  - API auth flow guidance
  - push/notification architecture
  - premium/subscription contract design
  - device-safe analytics events

## Files affected in this pass

This pass touched only backend-boundary files and documentation:

- server-only auth/session helpers
- server-only repository/provider modules
- server-only infrastructure modules
- server-only multiplayer/community security modules
- this audit document

## Why this pass stayed small

Large-scale cleanup is still needed, but it would not be safe to combine:

- gameplay decomposition
- API contract formalization
- test harness introduction
- platform-wide refactors

into one review cycle.

This pass deliberately improves the foundation without increasing launch risk.
