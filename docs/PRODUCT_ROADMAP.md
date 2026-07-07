# Product Roadmap

This document outlines the strategic product vision, future milestones, and long-term release roadmaps for the Trivia Platform.

---

## 1. Product Vision

The Trivia Platform is designed to be the premier multilingual trivia engine. By combining robust API-first designs, real-time multiplayer lobbies, automated submission pipelines, and high-fidelity layouts, the platform plans to expand from a high-performance web app into native mobile apps (iOS and Android) and enterprise channels.

---

## 2. Current & Planned Milestones

```
┌────────────────────────────────────────────────────────┐
│ Current Milestone: Base Staging Validation            │
├────────────────────────────────────────────────────────┤
│ Planned Milestone 1: Deconstruct UI & Build Test Suite │
├────────────────────────────────────────────────────────┤
│ Planned Milestone 2: Supabase Staging Activation      │
├────────────────────────────────────────────────────────┤
│ Planned Milestone 3: Real-time Multiplayer QA          │
├────────────────────────────────────────────────────────┤
│ Planned Milestone 4: Native Mobile Apps Release        │
└────────────────────────────────────────────────────────┘
```

### Milestone 1: UI Deconstruction & Staging Setup
*   **Goal**: Break down the monolithic `TriviaPlatform.tsx` file into focused subcomponents.
*   **Deliverables**:
    *   Separate components for Home, Game Play, Settings, Profile, Admin Panel, and Contact.
    *   Introduce thorough route-level and component tests.
    *   Configure staging environment variables.

### Milestone 2: Supabase Staging Activation
*   **Goal**: Transition from `local-json` fallback to real-time database-driven storage in staging.
*   **Deliverables**:
    *   Verify migrations, schema structures, and RLS policies on Supabase.
    *   Seed database with initial localized trivia bank.
    *   Validate user creation, admin allowlisting, and audit logs.

### Milestone 3: AI Moderation & Abuse Prevention
*   **Goal**: Enable secure OpenAI-driven moderation for community submissions.
*   **Deliverables**:
    *   Connect OpenAI moderation provider in staging.
    *   Integrate Cloudflare Turnstile CAPTCHA on the public submit form.
    *   Harden reputation delta adjustments and anti-spam loggers.

### Milestone 4: Real-time Multiplayer Validation
*   **Goal**: Ensure multiplayer lobbies work correctly under high load and flaky network drop conditions.
*   **Deliverables**:
    *   Validate player matchmaking, lobby TTL, and lifeline usage.
    *   Conduct load tests on multiplayer API endpoints.
    *   Optimize connection status syncs and rejoin logic.

---

## 3. Monetization Roadmap

*   **Ad Network Setup**: Connect Google AdSense first using clean, viewport-safe container bounds. Add optional support for Google Ad Manager, Media.net, and Ezoic.
*   **Stripe & Lemon Squeezy Subscriptions**: Fully scaffolded backend structures exist. Next phases will deploy pricing plans in production dashboards, activate signature verification, and connect client views.
*   **Microtransactions**: Allow users to purchase gameplay lifeline packages (e.g. additional Fifty-Fifties or Audience Polls) using Stripe or Lemon Squeezy checkout endpoints.

---

## 4. Mobile Roadmap

*   **API Verification**: Run smoke tests on all endpoints using mobile User Agents to ensure compatibility.
*   **Native SDK Binding**: Generate native data models and HTTP fetch libraries from the TypeScript contract guards (`src/lib/api/contracts`).
*   **Native Shells**: Launch native iOS (Swift/SwiftUI) and Android (Kotlin/Jetpack Compose) clients consuming the unified Next.js API route engine.
*   **In-App Purchase Mapping**: Map native App Store / Google Play billing hooks to the Stripe payment server.

---

## 5. AI Roadmap

*   **Fact-Checking Assistant**: Extend the OpenAI moderation pipeline to fact-check trivia answers against trusted online indices before enqueuing.
*   **Dynamic Question Generation**: Allow administrators to prompt AI models to generate niche category packs in all supported locales directly from the Admin Panel.
*   **Adaptive Difficulty Engine**: Track player success patterns dynamically to adjust the trivia sample curve (Easy to Expert) to fit individual player skills.

---

## 6. Community Roadmap

*   **Contributor Portal**: Build reputation-score displays for community contributors, letting users track their submission acceptance rates.
*   **Dynamic Leaderboards**: Launch weekly and monthly local leaderboards alongside the global top ranks, encouraging recurrent play.
*   **Badge System**: Award profile achievements for reaching high milestones (e.g. answering 1,000 correct questions or contributing 50 approved items).

---

## 7. Future Subscription Tier Plans

| Plan Tier | Price / Month | Features Included |
| --- | --- | --- |
| **Free Tier** | $0.00 | Standard trivia game modes, ad-supported gameplay, standard local leaderboards. |
| **Premium Solo** | $4.99 | Ad-free solo gameplay, offline local mode download, advanced statistics dashboard. |
| **Pro Multiplayer** | $9.99 | Premium solo features + custom real-time lobby hosting, priority AI question creation, higher multiplayer caps. |
