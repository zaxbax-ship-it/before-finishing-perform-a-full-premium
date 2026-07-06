# Project Summary

## Current Product
A global trivia / game-show platform built with:
- Next.js / TypeScript
- Vercel
- Supabase
- Supabase Auth
- Admin area with permissions
- Repository pattern
- AI moderation architecture
- Public authentication UX
- Google OAuth connected
- Multiplayer mode
- Leaderboard
- Legal/compliance pages
- SEO / ads readiness
- Localization
- Large Hebrew question bank

## Major Completed Items
- Solo game works.
- Multiplayer works in production across real devices.
- Create lobby / join lobby / waiting room / real-device flow works.
- Multiplayer lifelines, timer, round feedback and scoreboards were added.
- Leaderboard schema + RLS were completed.
- Supabase migrations through `005_multiplayer_lifelines.sql` were run.
- Realtime enabled only for safe multiplayer tables:
  - multiplayer_lobbies
  - multiplayer_games
  - multiplayer_results
- Public auth UX exists:
  - Login
  - Signup
  - User menu
  - Profile
  - Nickname flow
- Google OAuth is connected and working.
- Admin remains protected.
- Compliance pages exist:
  - Privacy Policy
  - Terms
  - Cookie Policy
  - About
  - Contact
- SEO/ad readiness files exist:
  - robots.txt
  - sitemap.xml
  - ads.txt
  - manifest
  - metadata
- Large Hebrew question bank imported:
  - Final local count: about 21,161 questions.
- Question sampling optimized:
  - Browser receives limited sample, not all 21,161 questions.
  - `totalAvailable` remains 21,161.
  - Sampling is randomized and balanced.
  - Seen question IDs tracked locally to reduce repeats.

## Important Remaining Work
1. Performance audit / bundle optimization.
2. Google Analytics 4.
3. Google Tag Manager.
4. Microsoft Clarity.
5. Monitoring, e.g. Sentry.
6. Cookie consent / CMP.
7. Google Search Console.
8. Domain setup.
9. OpenAI production cost/security audit.
10. Translation pipeline for non-Hebrew questions.
11. AdSense.
12. Beta testing.
13. Lighthouse / performance / accessibility / security audit.
14. Final launch.

## Cost Notes
- Do not run mass translation of 20,000+ questions through OpenAI without explicit approval.
- OpenAI cost audit must happen before launch.
