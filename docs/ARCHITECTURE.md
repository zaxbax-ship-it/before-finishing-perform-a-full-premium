# Architectural Specification

This document details the architectural design and system specifications of the Trivia Platform, serving as a permanent guide for developers and system operators.

---

## 1. System Topology Overview

The application follows a clean, decoupled architecture pattern. The system is layered to ensure that the core domain logic remains independent of external delivery mechanisms (such as web, mobile apps, or cli environments) and storage engines (local file storage, remote relational database, or memory cache).

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                   │
│   ┌───────────────────────┐   ┌─────────────────────┐   │
│   │    Web Client (React) │   │ Native Mobile Apps  │   │
│   └───────────┬───────────┘   └──────────┬──────────┘   │
└───────────────┼──────────────────────────┼──────────────┘
                │                          │
                ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│                    API Contract Layer                   │
│          Envelopes, DTO shapes, runtime guards          │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                     Application Layer                   │
│   ┌───────────────────────┐   ┌─────────────────────┐   │
│   │   Next.js API Routes  │   │ Multiplayer Service │   │
│   └───────────┬───────────┘   └──────────┬──────────┘   │
└───────────────┼──────────────────────────┼──────────────┘
                │                          │
                ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Domain/Service Layer                 │
│      Clean Repository Interfaces & Gameplay Logic       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                 │
│  ┌────────────────────────┐   ┌──────────────────────┐  │
│  │ Local JSON / LocalStorage │   │ Supabase/Postgres SQL│  │
│  └────────────────────────┘   └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Layered Architecture Specifications

### 2.1 Frontend (Presentation Layer)
*   **Web Client**: Built with React and Next.js (App Router) in client-rendered Single Page Application layouts.
*   **Styling System**: Styled entirely with native CSS modules and global configurations (`src/app/globals.css`, `auth.css`, `multiplayer.css`, `compliance.css`, `language-menu.css`). Avoids TailwindCSS or other utility frameworks to maximize direct render speeds and control.
*   **Decoupled Views**: The gameplay interfaces handle localized rendering, visual count-downs, animations, and sound effects.

### 2.2 Backend & API Layer
*   **Endpoint Routing**: Implemented using Next.js Route Handlers (`src/app/api/**`).
*   **API-First Contract**: To ensure ease of native mobile porting, every endpoint must return a discriminated response envelope:
    *   **Success**: `{ ok: true, ...payload }`
    *   **Error**: `{ ok: false, error: string, status?: string }`
*   **Runtime Verification**: Simple dependency-free type guards (`src/lib/api/contracts/common.ts`) assert payload types runtime, rather than heavy schema compilers, to stay runtime-agnostic.
*   **Versioning Guideline**: The `API_CONTRACT_VERSION` is defined globally. Backward-compatible changes (adding fields) do not trigger version updates. Breaking changes are isolated by endpoint prefixing or version negotiation headers.

### 2.3 Repository Pattern & Data Access
*   **Abstraction**: Features talk to `RepositoryProvider` interfaces (`src/lib/repositories/interfaces.ts`). No service or controller directly calls a SQL client or filesystem handles.
*   **Dynamic Factory**: `providerFactory.ts` checks the environment variables:
    *   If `NEXT_PUBLIC_DATABASE_MODE === 'supabase'` and URLs/keys are loaded, the `database` provider is instantiated.
    *   Otherwise, it falls back to the `local-json` provider.
*   **Double-Resilient Gameplay Source**: When queries for gameplay questions run on the database provider and return empty arrays (or time out), the application falls back to `local-json` assets dynamically, logging a warning but keeping the gameplay uninterrupted.

### 2.4 Database Layout
*   **Core Tables**: The SQL migration file (`database/001_supabase_core_schema.sql`) declares schema definitions for:
    *   `users`, `admins`, `roles`, `permissions`, `role_permissions`
    *   `question_submissions`, `approved_questions`, `review_queue`, `moderation_results`
    *   `audit_logs`, `contributor_reputation`, `reputation_events`, `anti_spam_events`, `notifications`
*   **Leaderboard Tables**: Managed in `database/002_leaderboard_schema.sql` and `database/003_leaderboard_rls_policies.sql` to support secure, authenticated high-score logging.
*   **Multiplayer Tables**: Declared under `004_multiplayer_schema.sql` and `005_multiplayer_lifelines.sql` for session states, active players, and lifeline status persistence.
*   **RLS (Row Level Security)**: All PostgreSQL tables enforce RLS. Public read/write tokens are blocked; all DB actions from the server bypass RLS using the private `SUPABASE_SERVICE_ROLE_KEY`.

### 2.5 Authentication & Access Control
*   **Model**: Powered by Supabase Auth (SSR client).
*   **Enforcement Policy**: Middleware (`middleware.ts`) automatically intercepts routes under `/admin`.
    *   If Supabase is unconfigured, the app falls back to open local access.
    *   If Supabase is configured, it enforces authentication, checking user records and allowlists (`ADMIN_EMAILS`) for authorization.
*   **Client Parity**: Native apps handle authentication using the Supabase Native SDK, passing the session headers down to the shared API endpoints.

### 2.6 Multiplayer Architecture
*   **Service Core**: Stateful actions are processed by `src/lib/multiplayer/service.ts`.
*   **Connectivity**: Lobbies, games, round-answering, lifelines (fifty-fifty, friend, audience), and prize calculations are synchronized via backend database states.
*   **Rate Limits**: Configurable rates limit gameplay state retrieval and answer submissions to prevent automated scraping.

### 2.7 Advertising & Core Web Vitals
*   **CLS Protection**: Layout containers (`AdSlot.tsx`, `GameplayAdSlot.tsx`) utilize reserved aspect-ratio sizing and CSS containment properties to guarantee that ad-injection does not cause page layout shifts.
*   **Lazy Loading**: Employs browser `IntersectionObserver` interfaces to defer ad loading until they approach the active viewport.
*   **Provider Neutral**: Supports switching between providers (`adsense`, `google-ad-manager`, `media-net`, `ezoic`) using standard configuration flags.

### 2.8 Payments Foundation
*   **Design**: A Stripe backend structure is scaffolded inside environment configs.
*   **Flow**: Intended to handle transactional pricing for premium single-player features, custom lobby hosting, or monthly subscription packages. All payment logic occurs server-side to satisfy security requirements.

### 2.9 Analytics, Compliance & Consent
*   **Consent Gatekeeping**: External scripts for analytics (GA4, GTM, Clarity) are loaded via `IntegrationScripts.tsx` and run only after a compatible CMP (Cookiebot, Usercentrics, Consentmanager) passes a consent confirmation flag.
*   **Metadata Integration**: Metadata configurations (`robots.ts`, `sitemap.ts`) automatically construct canonical links and verification tags based on the active `NEXT_PUBLIC_SITE_URL`.

---

## 3. Mobile-Readiness Decisions

The codebase utilizes several strategic design decisions to accommodate seamless Native iOS and Android development:
1.  **Strict Serialization**: Domain models pass ISO timestamps instead of raw Javascript `Date` objects and avoid nested class prototypes, keeping objects flat and JSON-safe.
2.  **Semantic Design Icons**: Component UI references abstract definitions (like `PlayIcon` and `BackIcon`) rather than Lucide-specific React icons, making it simple to map components directly to native assets.
3.  **Independent Auth Client**: The backend API verifies authentication headers and tokens rather than assuming Next-specific session contexts, matching mobile SDK integration.
4.  **Uniform Envelopes**: Mobile apps handle HTTP error responses by simply parsing the standardized `{ ok: false, error: ... }` block and presenting native UI alerts.

---

## 4. Deployment Flow

1.  **Local Testing**: Run `npm.cmd test` to ensure API contracts and health checks pass.
2.  **Schema Syncing**: Apply SQL schema migrations in the remote database.
3.  **Variable Deployment**: Configure server-side and client-side environment configurations in Vercel.
4.  **Static Validation**: Run `next build` to verify type compliance and compilation checks.
5.  **Traffic Route**: Route users to the production URL, verifying `/api/health` status reports liveness.
