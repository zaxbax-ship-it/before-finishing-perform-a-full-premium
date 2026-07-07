# Icon Design System

## Design philosophy

The product uses a single semantic icon layer built on top of `lucide-react`.
We do not import raw Lucide icons ad hoc inside feature screens unless there is a very strong reason.
This keeps the visual language consistent across web today and native apps later.

Core principles:

- Semantics first: features ask for `LeaderboardIcon`, not a specific Lucide glyph.
- Clarity before minimalism: text stays when an icon alone would be ambiguous.
- Reuse across platforms: the same semantic names should map cleanly to iOS and Android assets later.
- Accessibility by default: icon-only controls must always have labels, tooltips, or both.
- Premium restraint: icons support hierarchy and speed, but do not replace necessary wording.

## Source of truth

- Central file: [src/lib/design/icons.tsx](C:/Users/יוסי דוידוב/Documents/Codex/2026-06-27/before-finishing-perform-a-full-premium/src/lib/design/icons.tsx)

All product-facing screens should import semantic icons from that file.

## Icon rules

1. Import semantic icons only.
2. Prefer icon + text for primary actions, destructive actions, admin tools, and onboarding moments.
3. Use icon-only buttons when the meaning is universal and the control has:
   - `aria-label`
   - `title`
   - visible focus state
4. Lifelines may be icon-first, but must keep accessible labels.
5. Avoid flags for languages; use a universal language/globe pattern.
6. Do not mix multiple icon styles in the same surface.

## Semantic mapping

| Semantic icon | Lucide base | Intended use |
| --- | --- | --- |
| `PremiumIcon` | `Crown` | premium moments, host, featured states |
| `CoinsIcon` | `Coins` | money, rewards, balance |
| `RewardsIcon` | `Coins` | rewards summaries |
| `AchievementsIcon` | `Trophy` | wins, completion, champion states |
| `LeaderboardIcon` | `Medal` | rankings, public leaderboard |
| `ProfileIcon` | `User` | profile, account |
| `FriendsIcon` | `Users` | friends, community |
| `MultiplayerIcon` | `Users` | multiplayer mode |
| `SoloIcon` | `Gamepad2` | solo gameplay |
| `QuizIcon` | `Sparkles` | playful quiz entry points |
| `QuestionIcon` | `CircleHelp` | help, rules, question-oriented sections |
| `CategoriesIcon` | `ScrollText` | category browsing |
| `HintsIcon` | `Lightbulb` | lifelines, hints |
| `StatisticsIcon` | `BarChart3` | stats and analytics |
| `SettingsIcon` | `Settings` | settings and control surfaces |
| `NotificationIcon` | `Bell` | notifications |
| `SearchIcon` | `Search` | search inputs and actions |
| `HomeIcon` | `Home` | return home |
| `BackIcon` | `ArrowLeft` | back navigation |
| `ForwardIcon` | `ArrowRight` | continue / next |
| `PlayIcon` | `Play` | start game, join, continue |
| `PauseIcon` | `Pause` | pause states |
| `ShareIcon` | `Share2` | sharing |
| `FavoritesIcon` | `Heart` | lives, favorites |
| `HistoryIcon` | `History` | timer/history |
| `RefreshIcon` | `RefreshCw` | refresh, retry |
| `PaymentsIcon` | `CreditCard` | payment confirmation |
| `WalletIcon` | `Wallet` | wallet, paid action modal |
| `SubscriptionIcon` | `RefreshCw` | reset/reload style actions |
| `AdminIcon` | `ShieldCheck` | admin area |
| `ModeratorIcon` | `Shield` | moderation |
| `MailIcon` | `Mail` | contact and email |
| `SupportIcon` | `LifeBuoy` | support/help |
| `SecurityIcon` | `Shield` | security |
| `LoginIcon` | `LogIn` | sign in |
| `LogoutIcon` | `LogOut` | sign out |
| `EditIcon` | `PenLine` | edit |
| `CopyIcon` | `Copy` | duplicate/copy |
| `DeleteIcon` | `Trash2` | delete |
| `ImportIcon` | `Upload` | import |
| `ExportIcon` | `Download` | export |
| `ConfirmIcon` | `Check` | confirm/save/success |
| `CloseIcon` | `X` | cancel/close |
| `WarningIcon` | `AlertTriangle` | warning/error |
| `GlobeIcon` | `Globe` | language |
| `CelebrationIcon` | `Sparkles` | celebratory accents |

## Lifeline system

Solo and multiplayer lifelines are icon-first:

- `FiftyFiftyIcon`
- `SwapQuestionIcon`
- `PhoneFriendIcon`
- `AudienceIcon`

Visible text may be hidden in compact gameplay UI, but every control must preserve:

- `aria-label`
- `title`
- readable focus state
- a stable icon shell that remains tappable on mobile

## Where text should remain

Keep text visible in these cases:

- authentication buttons
- payment confirmations
- destructive admin actions
- leaderboard save actions
- category names
- answer choices
- moderation decisions
- anything legally or financially sensitive

## Accessibility

- Every icon-only control must expose an accessible name.
- Focus rings must remain obvious in dark mode.
- Do not rely on color alone for meaning.
- Maintain sufficient touch target size for mobile.
- Decorative icons should stay `aria-hidden`.

## Future mobile guidelines

- Keep semantic icon names stable so native clients can mirror them.
- Avoid CSS-dependent meaning.
- Prefer square icon containers with predictable sizing tokens.
- Keep labels, tooltips, and descriptions separable from the glyph itself.
- Never encode platform-only interaction assumptions into the icon API.

## Adoption notes

- Public UI can use icon + text more freely.
- Gameplay should stay compact and icon-led.
- Admin should remain more explicit than gameplay to protect clarity.
