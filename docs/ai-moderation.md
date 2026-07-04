# AI Moderation Architecture

The community submission flow now supports AI moderation without requiring a real OpenAI key.

## Current Default

```env
OPENAI_MODERATION_ENABLED=false
OPENAI_API_KEY=
OPENAI_MODERATION_MODEL=gpt-4.1-mini
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
