# AI Moderation Architecture

The community submission flow now supports AI moderation without requiring a real OpenAI key.

## Current Default

```env
OPENAI_MODERATION_ENABLED=false
OPENAI_API_KEY=
OPENAI_MODERATION_MODEL=gpt-4.1-mini
AI_MODERATION_STRICT_REVIEW=true
```

With this configuration the app uses the `mock-local` provider. It performs deterministic checks for:

- duplicate or near-duplicate questions
- low-quality wording
- missing explanation
- unsafe, abusive or spam-like terms
- improved question punctuation and answer cleanup
- an explanation capped at 80 words
- recommendation: approve, reject or needs manual review

## Production Provider

The OpenAI provider is implemented but inactive until both conditions are true:

```env
OPENAI_MODERATION_ENABLED=true
OPENAI_API_KEY=sk-...
```

The key is server-only and must never be exposed as a `NEXT_PUBLIC_` variable.

## Safety Controls

The production safety layer is active for both the mock provider and the future OpenAI provider.

```env
COMMUNITY_SUBMISSION_RATE_LIMIT=8
COMMUNITY_SUBMISSION_RATE_LIMIT_WINDOW_SECONDS=60
AI_MODERATION_RATE_LIMIT=20
AI_MODERATION_RATE_LIMIT_WINDOW_SECONDS=60
AI_MODERATION_TIMEOUT_MS=12000
AI_MODERATION_RETRY_ATTEMPTS=1
AI_MODERATION_MAX_ESTIMATED_TOKENS_PER_REQUEST=4500
AI_MODERATION_DAILY_REQUEST_LIMIT=1000
AI_MODERATION_MONTHLY_REQUEST_LIMIT=20000
AI_MODERATION_DAILY_ESTIMATED_TOKEN_LIMIT=2500000
AI_MODERATION_MONTHLY_ESTIMATED_TOKEN_LIMIT=50000000
AI_MODERATION_AUTO_APPROVE_MIN_CONFIDENCE=88
AI_MODERATION_DUPLICATE_REVIEW_RISK=55
AI_MODERATION_LOW_QUALITY_REVIEW_RISK=60
AI_MODERATION_UNSAFE_REJECT_RISK=85
AI_MODERATION_STRICT_REVIEW=true
```

Current rate limits and budgets use an in-memory fallback so the app works without paid services. For production scale, replace the same abstraction with Redis or Upstash so limits are shared across serverless instances.

If a request is over budget, times out, returns uncertain fact-checking, has duplicate risk, or has low confidence, the submission is routed to `review_queue` instead of being auto-approved.

## Storage Flow

Community submissions go through:

```text
Client form -> /api/community/submissions -> AI moderation service -> repository provider
```

The API route stores results in:

- `question_submissions`
- `moderation_results`
- `review_queue`
- `audit_logs`
- `anti_spam_events`
- `approved_questions` when auto-approved

If Supabase is not enabled, the local JSON provider remains the fallback and the browser keeps localStorage compatibility.

## Before Enabling Real OpenAI

1. Confirm Supabase tables exist.
2. Add `OPENAI_API_KEY` only to server/Vercel environment variables.
3. Set `OPENAI_MODERATION_ENABLED=true`.
4. Keep `OPENAI_MODERATION_MODEL` explicit.
5. Test several submissions from `/admin`.
6. Review logs in `moderation_results` and `audit_logs`.
