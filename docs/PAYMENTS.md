# Payment & Subscription Architecture Specification

This document provides a detailed overview of the Trivia Platform's payment and entitlement infrastructure. It describes the provider-agnostic core, specific provider integrations, mobile app compatibility guidelines, and steps required before going live.

---

## 1. System Architecture

The payment system follows the same Clean Architecture principles as the rest of the application:

```
┌──────────────────────────────────────────────────────────┐
│                   Presentation Layer                     │
│    - Web checkout actions                                │
│    - Mobile Native App Store billing SDKs                │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                   API Contract Layer                     │
│    - CheckoutSessionResponse / EntitlementsResponse      │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                  Infrastructure Adapters                 │
│    - StripeAdapter / LemonSqueezyAdapter                 │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                   Repository Pattern                     │
│    - PaymentsRepository (DB or local-json)               │
└──────────────────────────────────────────────────────────┘
```

By decoupling storage (`PaymentsRepository`) and provider orchestration (`PaymentAdapter`), the platform can easily switch payment processors or introduce new mobile billing channels without changing core gameplay loops.

---

## 2. Core Entities

We define three key entities in the domain to manage user monetization records:

1.  **UserSubscription**: Records active subscription state (e.g. status, expires dates, provider subscription IDs). Used to gate recurring tiers like `Premium Solo` or `Pro Multiplayer`.
2.  **UserEntitlement**: Represents a singular permission token (e.g. `premium_solo` or a lifeline package). Entitlements can be backed by a subscription or a one-time transaction. The client queries this boundary to unlock features.
3.  **PaymentTransaction**: An immutable audit log tracking every checkout order, amount, currency, and provider payload for financial reporting.

---

## 3. Provider Roles

### Lemon Squeezy
*   **Role**: Primary Merchant of Record (MoR) for direct web purchases, especially globally. It handles global tax compliance (VAT, sales tax) out-of-the-box.
*   **Integration**: Handles subscription checkouts, one-time checkout links, and posts secure webhook updates (`order_created`, `subscription_created`, `subscription_updated`).

### Stripe
*   **Role**: Direct merchant processor for card-level payment controls, custom checkout flows, and specialized subscription tier controls.
*   **Integration**: Handles checkouts and posts webhook events (`checkout.session.completed`, `customer.subscription.updated`).

### Apple Pay & Google Pay (Mobile Apps)
*   **Role**: Native billing providers for iOS (App Store In-App Purchases) and Android (Google Play Billing).
*   **Implementation Strategy**:
    *   Mobile clients leverage native swift/kotlin SDKs to trigger native sheets.
    *   Once a purchase is successful, the app retrieves the receipt token and calls a server verification route.
    *   The server verifies the receipt against Apple/Google servers, saves the transactions, and stores the resulting `UserEntitlement` records in the `PaymentsRepository`.

---

## 4. Webhook Processors

Webhooks verify request signature headers utilizing provider secrets to ensure payload authenticity.
*   **Stripe Webhook**: Endpoint `/api/payments/webhooks/stripe`. Validates signature via `stripe-signature` header.
*   **Lemon Squeezy Webhook**: Endpoint `/api/payments/webhooks/lemon-squeezy`. Validates signature via `x-signature` header.

Both endpoints ingest events asynchronously, update `user_subscriptions` and `user_entitlements` states, and log audit trails inside `payment_transactions`.

---

## 5. Mobile Native Considerations

To ensure compatibility with native applications, the payment architecture incorporates these rules:
1.  **Flat DTO Serialization**: Responses returned by `/api/payments/checkout` and `/api/payments/entitlements` are flat, JSON-serializable structures.
2.  **Abstract Entitlement Checks**: Mobile apps do not check raw Stripe/Lemon Squeezy API states. Instead, they query the backend endpoint `GET /api/payments/entitlements` (or matching client context), which resolves all active features across web subscriptions, mobile in-app purchases, and admin bypasses in a single payload.
3.  **Idempotency & Verification**: Receipt-validation requests from mobile clients must support transactional logs to prevent duplicate entitlement generation.

---

## 6. Steps Remaining Before Enabling Live Payments

To transition this payment infrastructure to live operations:
1.  **Apply Database Migrations**: Run the database migration script [006_payments_schema.sql](file:///c:/Users/יוסי%20דוידוב/Documents/Codex/2026-06-27/before-finishing-perform-a-full-premium/database/006_payments_schema.sql) in your remote Supabase instance to create the necessary tables (`user_subscriptions`, `user_entitlements`, `payment_transactions`) and configure Row Level Security (RLS) policies. **This must be run before enabling real payments in production.**
2.  **Configure API Secrets**: Supply the server-side environment variables (`STRIPE_SECRET_KEY`, `LEMON_SQUEEZY_API_KEY`, etc.) in the target deployment console.
2.  **Define Price & Product IDs**: Set up pricing plans in the Lemon Squeezy and Stripe dashboards. Update the application configuration to map these IDs to client request schemas.
3.  **Implement Live Adapter Functions**: Swap the `unavailable(provider)` function definitions in `src/lib/infrastructure/adapters/index.ts` with real provider HTTP/SDK calls (e.g. using `stripe` Node SDK or Lemon Squeezy API request constructs).
4.  **Register Webhook Listeners**: Register `/api/payments/webhooks/stripe` and `/api/payments/webhooks/lemon-squeezy` on the respective provider dashboard consoles and populate the signature verification keys (`STRIPE_WEBHOOK_SECRET`, `LEMON_SQUEEZY_WEBHOOK_SECRET`).
