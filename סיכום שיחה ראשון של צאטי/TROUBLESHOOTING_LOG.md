# Key Production Issues Solved

## Multiplayer Production Failures
- `databaseMode=local` caused production mismatch.
- Fixed by setting `NEXT_PUBLIC_DATABASE_MODE=supabase`.
- FK error on lobby creation:
  - lobby referenced `host_player_id` before the player row existed.
  - Fixed by creating lobby, inserting host player, then updating lobby.
- Join error PGRST100:
  - malformed Supabase `.or()` syntax.
  - Fixed identity filter syntax.
- Missing `lifeline_uses` column:
  - migration `005_multiplayer_lifelines.sql` had to be run in Supabase.

## Question Loading
- API initially returned all 21,161 questions.
- Optimized to 640 sample + `totalAvailable`.
- Then sampling was improved to be randomized and anti-repeat using local seen IDs.

## Auth / Google OAuth
- Google Cloud OAuth Client created.
- Supabase Google provider enabled with Client ID and Client Secret.
- Vercel env variables added:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
- Redirect default fixed from `/admin` to `/` for public users.
- Admin redirect still works via `?redirect=/admin`.

## UI / UX
- Header overlap fixed with top utility bar.
- Language selector moved to globe icon.
- Auth buttons no longer float incorrectly.
- In-game home button added.
- Smart section reveal scrolling added.
- Lucide icons introduced.
- Multiplayer UX polished.
