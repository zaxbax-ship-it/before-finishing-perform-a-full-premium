# Distributed Rate Limiting

The platform uses a provider-based rate limiting layer:

- local and unconfigured environments use the in-memory provider
- production can use Upstash Redis for distributed limits across serverless instances

The app does not require Upstash to build or run. If Upstash is not configured, the server falls back to in-memory limits and logs a warning through the existing logging/error reporting layer.

## Environment variables

```env
RATE_LIMIT_PROVIDER=auto
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
COMMUNITY_SUBMISSION_RATE_LIMIT=8
COMMUNITY_SUBMISSION_RATE_LIMIT_WINDOW_SECONDS=60
AI_MODERATION_RATE_LIMIT=20
AI_MODERATION_RATE_LIMIT_WINDOW_SECONDS=60
MULTIPLAYER_LOBBY_RATE_LIMIT=30
MULTIPLAYER_LOBBY_RATE_LIMIT_WINDOW_SECONDS=60
MULTIPLAYER_STATE_RATE_LIMIT=240
MULTIPLAYER_STATE_RATE_LIMIT_WINDOW_SECONDS=60
MULTIPLAYER_ANSWER_RATE_LIMIT=90
MULTIPLAYER_ANSWER_RATE_LIMIT_WINDOW_SECONDS=60
```

## Provider behavior

- `RATE_LIMIT_PROVIDER=auto`: use Upstash when both Redis variables exist; otherwise use memory
- `RATE_LIMIT_PROVIDER=memory`: always use local in-memory limits
- `RATE_LIMIT_PROVIDER=upstash`: prefer Upstash; if credentials are missing or the provider fails, fall back to memory and emit a warning

## Protected endpoints

- `POST /api/community/submissions`
- `POST /api/multiplayer/lobbies`
- `POST /api/multiplayer/lobbies/[id]`
- `GET /api/multiplayer/games/[id]`
- `POST /api/multiplayer/games/[id]`
- `POST /api/multiplayer/games/[id]/answers`
- `POST /api/multiplayer/games/[id]/lifelines`

## Production notes

- keep `UPSTASH_REDIS_REST_TOKEN` server-only
- do not expose Redis credentials with `NEXT_PUBLIC_`
- `/api/health` now reports safe rate-limiting status without returning secrets
