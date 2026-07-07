# Project State

This document provides a comprehensive overview of the current status of the Trivia Platform, listing implemented systems, production-ready elements, experimental/inactive integrations, and technical debt.

## 1. Project Overview

The project is a multi-language, high-performance Trivia Game designed from the ground up to be database-agnostic, API-first, and easily portable to native iOS and Android environments. It features single-player and real-time multiplayer modes, community question submissions, automated AI-moderation pipelines, and production-ready analytics, advertising, and consent systems.

---

## 2. Implemented Systems

*   **Multi-language Localization**: Fully supports Hebrew (`he`), English (`en`), Arabic (`ar`), Russian (`ru`), and Amharic (`am`). Localization keys are dynamically mapped for categories, questions, and interface components.
*   **Database-Agnostic Repository Layer**: Employs a Clean Architecture repository boundary. The app defaults to local file storage and browser `localStorage` but has complete support for a Postgres database.
*   **API-First Contract Layer**: Shared contracts and guards exist under `src/lib/api/contracts` to enforce identical payload shapes between Next.js api routes and clients (both the current web client and future native mobile apps).
*   **Lobby & Multiplayer Game Engine**: Supports lobby creation, custom parameters (difficulty, locale, categories), and real-time game coordination on the server using structured repository hooks.
*   **Visual Icon Design System**: Semantic icon mapping decouples feature screens from explicit `lucide-react` styling, preparing the system for SF Symbols and Android drawables mapping.
*   **Compliance, Ads, and Analytics Layer**: Built-in support for consent management platforms (CMP), Google Analytics (GA4), GTM, Microsoft Clarity, sitemaps, robots rules, and responsive ad containers.

---

## 3. Production-Ready Systems

These systems are fully coded, validated via tests, and ready for deployment upon supplying matching production keys/credentials:

*   **Local JSON Gameplay**: The baseline single-player game, using `localStorage` for stats and game state.
*   **Environment & Secret Validation**: A centralized environment configuration manager (`config.ts`, `environment.ts`, `secrets.ts`) that verifies presence, types, and scope of configurations without leaking server secrets.
*   **Vitest Integration Suite**: Contains test suites checking health check responses, balanced question sampling, multiplayer lobby listing contracts, admin authorization guards, and envelope guards.
*   **Structured Schema Migrations**: SQL migrations (`database/*.sql`) are complete, covering PostgreSQL databases, roles/permissions tables, audit logs, multiplayer sessions, lifelines, and Row-Level Security (RLS) rules.
*   **Observability (Sentry)**: Instrumentation is prepared for Next.js server, client, and edge environments.
*   **Agnostic Ad Containment**: Placeholder wrappers and layout spacing (`AdSlot.tsx`) preserve Core Web Vitals (specifically Cumulative Layout Shift) when ads are activated.

---

## 4. Inactive/Staged Production Integrations

These systems are implemented but run in a mockup/local mode until production keys are configured:

*   **Supabase Database & Auth**: Runs in "open local mode" using JSON files and local session mockups. Supabase RLS and client authorization activate when URL and secret keys are populated.
*   **OpenAI AI Moderation**: Submissions run through `mock-local` rules (abusive terms, length, quality checks) until the OpenAI API key is supplied.
*   **Upstash Redis Rate Limiting**: Falls back to in-memory rate limiting when Redis keys are not provided.
*   **Payment & Subscriptions**: Stripe & Lemon Squeezy payment infrastructure is fully scaffolded (including SQL schemas, repository interfaces, checkout controllers, and webhook parsers) but live billing is inactive (mock local mode is active).
*   **Email Notifications**: Resend integration is staged but inactive.
*   **Cloudflare Turnstile**: CAPTCHA validation parameters are defined but not enforced on forms.

---

## 5. Technical Debt

*   **Concentrated Client UI Component**: `TriviaPlatform.tsx` contains the entire web game shell (home screen, gameplay, rules, settings, profile, contact screens) in a single ~154KB client component. This hampers code reuse and makes native porting more difficult.
*   **Multiplayer Retry Safety**: Stateful multiplayer requests (e.g., submit answer, use lifeline) do not utilize idempotency keys, which increases the likelihood of double-submissions or timeouts under flaky mobile networks.
*   **Test Coverage Gaps**: While the contract boundary is tested, core logic loops (actual gameplay states, score updates, leaderboard writes, and moderation workflows) lack automated tests.
*   **Manual Nickname Uniqueness checks**: Nickname claims on the leaderboard are protected but rely on in-memory or database-level queries that need rigorous load-testing before scaling.

---

## 6. Current Priorities

1.  **Decompose Gameplay UI**: Split the giant `TriviaPlatform.tsx` module into focused, testable feature components (e.g. `SoloGameView`, `LobbyView`, `SettingsPanel`).
2.  **Verify Supabase Database Integration**: Perform staging validation of the Supabase tables, migrations, and RLS rules under real workloads.
3.  **Harden Multiplayer Reconnections**: Verify lobby status syncs and player reconnection logic under network drops.
4.  **Strengthen Test Automation**: Introduce unit and integration tests for gameplay controllers, reputation systems, and submission flows.
