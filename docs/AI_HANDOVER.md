# AI Handover & Onboarding Guide

Welcome, AI Coding Assistant! This document is designed to onboard you to the Trivia Platform codebase. Read this document in full before editing or proposing code changes.

---

## 1. Project Philosophy & Core Values

*   **API-First, Client-Second**: Endpoints are built to serve any future client, not just the web. Treat Next.js API routes as a standalone product.
*   **Agnostic Data Storage**: Code must remain database-agnostic. The UI and service layers speak to repository interfaces, never directly to database engines.
*   **Resiliency by Design**: The application must remain operational even when external providers fail. If database lookups or AI APIs fail, fallback systems must silently keep gameplay alive.
*   **Premium Visuals & Zero CLS**: Interface adjustments must preserve layout stability (e.g. no Cumulative Layout Shift for ads) and maintain elegant, high-fidelity presentation styling.

---

## 2. Architecture Rules & Guardrails

*   **Enforce `server-only` Boundaries**: Backend utilities, secrets, and database access logic must be kept out of client components. Import the `server-only` module at the top of these files.
*   **Strict API Contract Compliance**: All endpoints under `src/app/api/**` must implement responses that conform to `src/lib/api/contracts`. Use `satisfies` compile-time checks in endpoints, and run validation tests.
*   **No Direct SQL Calls**: Never query SQL, Postgres, or Supabase directly from route handlers, pages, or components. Always route access through the `RepositoryProvider` interfaces.
*   **No Tailwind CSS Utility Drift**: All styling must reside in vanilla CSS modules or global stylesheet files. Do not inject ad-hoc utility frameworks unless explicitly requested.

---

## 3. Things That Must Never Be Broken

1.  **Response Envelope Structure**: Do not change the `{ ok: true, ... }` or `{ ok: false, error: ... }` response shape. Mobile apps rely on this signature to parse status codes.
2.  **Vitest Health & Smoke Suite**: The API smoke test suite (`test/**`) must remain passing on every commit. Never disable health check assertions.
3.  **Local Mode Fallback**: If `NEXT_PUBLIC_DATABASE_MODE` is unset or set to `local`, the entire application must continue to run using local JSON and browser storage.
4.  **Semantic Icon Layer**: Never import raw icon elements directly into screen layouts. Only reference symbols from `src/lib/design/icons.tsx` to maintain compatibility with future mobile asset maps.

---

## 4. Mobile-First Principles

*   **Flat JSON Payloads**: Keep API responses flat, serializable, and easily parsed by native iOS (Swift) and Android (Kotlin) network models.
*   **Safe Date Strings**: Avoid passing JavaScript `Date` instances. Always pass dates as ISO 8601 strings.
*   **Abstract Auth Checks**: Read auth from incoming request headers rather than relying on browser cookie APIs, supporting native app token passes.

---

## 5. Coding Standards & Conventions

*   **TypeScript Enforcement**: No `any` type allowances. Declare explicit interfaces and type guards.
*   **Clean Naming**:
    *   `*Repository` for data layer access.
    *   `*Dto` for serializable transfer shapes.
    *   `*Service` for orchestration.
*   **Preserve Existing Comments**: Retain docstrings, annotations, and system warnings that are unrelated to your current changes.

---

## 6. How Future Work Should Be Approached

1.  **Read and Understand**: When you receive a task, query the current code layout using grep or list utilities. Do not execute destructive edits.
2.  **Confirm Contracts**: If modifying API logic, review the target types in `src/lib/api/contracts` first. Update the contracts alongside the code if API changes are approved.
3.  **Run Tests Regularly**: Use `npm.cmd test` to verify code health. Tests run under Vitest and expect standard output responses.
4.  **Document and Walkthrough**: Once changes are finalized, document updates clearly. Provide step-by-step verification proofs.
