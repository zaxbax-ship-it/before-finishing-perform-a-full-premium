# Working Workflow / Rules

## After Every Codex or Claude Report
1. Read the full report first.
2. Decide whether code changed.
3. If code changed, provide exact black-screen commands:
   ```bash
   git status
   git add .
   git commit -m "..."
   git push origin main
   ```
4. If a migration file was added, run it in Supabase SQL Editor before testing production.
5. If Vercel environment variables changed, redeploy.
6. If Supabase policies/realtime changed, verify them before testing.
7. Do not commit blindly.
8. Do not let agents rebuild working systems.

## Architecture Preservation
Always preserve:
- Repository pattern
- Supabase integration
- Auth and authorization
- Admin area
- AI moderation
- Leaderboard
- Multiplayer foundation
- Localization
- Compliance/SEO pages
- Existing responsive design

## Important Rule Learned
If Codex/Claude adds `database/XXX.sql`, do not test production until the SQL was run in Supabase.
