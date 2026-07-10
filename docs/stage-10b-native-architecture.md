# Stage 10B — Native Architecture (SwiftUI + Jetpack Compose)

This document is the platform-neutral **porting contract** for the Stage 10B
rewards, retention and emotional-experience ecosystem. It maps the shared domain
(already dependency-free and framework-agnostic) onto native **iOS / SwiftUI** and
**Android / Jetpack Compose** clients, so both can reproduce the exact same rules,
economy and ceremonies the web client uses — from the same server endpoints.

The design intent throughout Stage 10B was portability: the rules live in
`src/lib/rewards/` with **no React, no DOM, no timers, no locale, no money
formatting** inside them. Everything below is a straight transcription, not a
redesign. If a native client needs a rule, it either (a) calls the server, or
(b) mirrors the pure function documented here — never invents its own.

## Governing rules (identical on every platform)

- **Dollars only.** One monetary language: `$`. There is **no** second currency
  (no coins/crowns/gems/tokens). `Current Prize` = the live game; `Career
  Earnings` = the permanent lifetime record.
- **Career Earnings is an honor record.** `lifetimeTotal` only grows;
  `spendableBalance` is architected for a future cosmetic sink but equals
  `lifetimeTotal` at launch. The ledger is **append-only and idempotent**.
- **No pay-to-win, no gameplay power** from cosmetics/monetization. Cosmetics are
  identity only.
- **No permanent gameplay-HUD additions**, no progression clutter during
  questions. Profile is the home of identity/depth; Journey is the home of
  daily/weekly engagement; the Result screen reveals rewards **sequentially**.
- **Progressive disclosure**: a surface appears only after its first earned item —
  never an empty locked grid.
- **Server-authoritative**: clients render and request; the server grants. RLS on
  the `010_rewards_progression` tables is service-role only.
- **Five locales** (`he`, `en`, `ar`, `ru`, `am`), **RTL/LTR**, accessibility, and
  **reduced motion** are first-class on every platform.

---

## 1. Shared model mapping

Source of truth: [`src/lib/rewards/types.ts`](../src/lib/rewards/types.ts). All
dates are ISO-8601 strings; "day keys" are `YYYY-MM-DD` computed in the player's
own timezone; "week keys" are `YYYY-Www`. Keep these as strings on native too — do
**not** parse them into `Date`/`LocalDate` inside rule code; only format them for
display.

| TypeScript | Swift (Codable) | Kotlin (kotlinx.serialization) |
| --- | --- | --- |
| `type PlayerKey = string` | `typealias PlayerKey = String` | `typealias PlayerKey = String` |
| `type DayKey = string` (`YYYY-MM-DD`) | `typealias DayKey = String` | `typealias DayKey = String` |
| `type WeekKey = string` (`YYYY-Www`) | `typealias WeekKey = String` | `typealias WeekKey = String` |
| `Rarity` union | `enum Rarity: String, Codable` | `enum class Rarity` |
| `CareerEarnings` | `struct CareerEarnings: Codable` | `data class CareerEarnings` |
| `CareerLedgerEntry` | `struct CareerLedgerEntry: Codable` | `data class CareerLedgerEntry` |
| `PlayerTitle` / `AchievementBadge` | structs | data classes |
| `TrophyCabinet` | `struct` with `[String?]` slots | `data class` with `List<String?>` |
| `CategoryMastery` / `MasteryTier` | struct / enum | data class / enum |
| `CollectionState` | struct | data class |
| `CosmeticEntitlement` / `CosmeticType` / `CosmeticSource` | struct / enums | data class / enums |
| `DailyStreak` / `DailyQuestionState` | structs | data classes |
| `WeeklyObjectiveProgress` (`seenKeys?`) | `struct` with `let seenKeys: [String]?` | `data class` with `val seenKeys: List<String>? = null` |
| `TimelineEvent` / `TimelineEventType` | struct / enum | data class / enum |
| `PlayerIdentity` | struct | data class |
| `RevealItem` / `RevealType` | struct / enum | data class / enum |
| `DisclosureState` | struct of `Bool` | data class of `Boolean` |

**Enum discipline.** Every string union becomes a `String`-backed enum with an
`unknown` fallback case, so a server that adds a new `RevealType` or `CosmeticType`
never crashes an older client. Example (Swift):

```swift
enum RevealType: String, Codable {
    case result, careerEarnings = "career-earnings", xpLevel = "xp-level"
    case streak, titleUnlock = "title-unlock", badgeUnlock = "badge-unlock"
    case legendaryBadge = "legendary-badge", masteryTier = "mastery-tier"
    case collectionComplete = "collection-complete", careerMilestone = "career-milestone"
    case personalRecord = "personal-record", firstMillionaire = "first-millionaire"
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = RevealType(rawValue: raw) ?? .unknown
    }
}
```

Kotlin equivalent uses `@Serializable` with a custom serializer defaulting to an
`UNKNOWN` entry.

**`seenKeys` convention (important).** For weekly objectives, `seenKeys` is `[]`
only for the `distinct-categories` metric and `null`/absent otherwise. Native
clients that reconstruct objectives from storage must reproduce this from the
objective definition's `metric` — mirroring `initWeeklyProgress` /
`tableRowsToSnapshot`. See [`supabaseRewardsRepository.ts`](../src/lib/rewards/supabaseRewardsRepository.ts).

---

## 2. Repository mapping

Source: [`src/lib/repositories/rewardsRepository.ts`](../src/lib/repositories/rewardsRepository.ts).
The persistence boundary is a 3-method interface. Native clients do **not** talk to
the database directly (RLS forbids it); they talk to the API. So the native
"repository" is a **remote** implementation over HTTP, plus an optional local
cache for offline reads.

```
RewardsRepository
  load(playerKey, displayName?) -> RewardsProfileSnapshot
  save(snapshot)                -> RewardsProfileSnapshot   // server-side only
  appendLedgerEntry(playerKey, entry) -> CareerEarnings     // server-side only
```

| Web/server | Native | Notes |
| --- | --- | --- |
| `createInMemoryRewardsRepository` | in-memory cache (tests/offline) | deterministic, deep-cloned |
| `createSupabaseRewardsRepository` | **server-only** | never shipped in the app binary |
| API routes (`/api/rewards/*`) | `RemoteRewardsRepository` | the app's real data source |

Swift protocol (read side; writes go through action endpoints, below):

```swift
protocol RewardsRepository {
    func summary() async throws -> RewardsSummary
    func fullProfile() async throws -> FullProfile
    func dailyChallenge() async throws -> DailyChallenge
    func weeklyObjectives() async throws -> WeeklyObjectives
}
```

`save`/`appendLedgerEntry` intentionally have **no client counterpart** — the only
way a native client changes rewards state is by POSTing a game result or an action
(equip/pin/claim), and letting the server run the pure engine. This is what makes
self-granting impossible.

---

## 3. API contract mapping

Source: [`src/lib/api/contracts/rewards.ts`](../src/lib/api/contracts/rewards.ts)
and the envelope in [`common.ts`](../src/lib/api/contracts/common.ts). Every
endpoint returns the discriminated envelope `{ ok: true, ... } | { ok: false, ... }`.
Native clients branch on `ok` and treat any non-`ok` body as a typed failure — the
rewards service is **optional**, so a failure must never break gameplay.

### Endpoints (all under `/api/rewards`)

| Method + path | Purpose | Guarded |
| --- | --- | --- |
| `POST /result` | submit finished game → returns the ordered reveal queue | player key |
| `GET /summary` | streak glyph + disclosure signals | player key |
| `GET /profile` | full identity + depth surfaces | player key |
| `GET /daily` · `POST /daily` | daily question + check-in | player key |
| `GET /weekly` · `POST /weekly` | weekly objectives + claim | player key |
| `POST /title` · `POST /pin` · `POST /trophy` · `POST /cosmetics` | equip/pin actions | player key |
| Admin: `GET/POST /api/admin/rewards` | management console | `rewards.read` / `rewards.manage` |

### Codable / kotlinx mapping

Mirror the DTO shapes verbatim. Reuse the browser client
[`src/lib/rewards/client.ts`](../src/lib/rewards/client.ts) as the reference for
request bodies (`playerKey`, `utcOffsetMinutes`, etc.).

```swift
enum ApiEnvelope<T: Decodable>: Decodable {
    case ok(T)
    case failure(String?)
    // decode: read `ok`; if true decode T, else decode `error`
}
```

**Player key + timezone.** Anonymous players are keyed by a stable device id
(Keychain on iOS, `EncryptedSharedPreferences` on Android) — the analog of the
web's `localStorage` key. Authenticated players are keyed **server-side** by their
verified auth id; the client-sent key is ignored. Always send
`utcOffsetMinutes = -TimeZone.current.secondsFromGMT()/60` so day/week keys land in
the player's local calendar.

**Contract version.** Read `API_CONTRACT_VERSION` from `common.ts` and pin it in a
native constant; surface a soft "please update" if the server minor exceeds the
client's.

---

## 4. Reward reveal queue mapping

Source: `buildRevealQueue` in [`src/lib/rewards/engine.ts`](../src/lib/rewards/engine.ts);
web ceremony in [`RewardReveals.tsx`](../src/components/trivia/RewardReveals.tsx).

The **server** builds the queue (deterministic priority order) and returns it from
`POST /api/rewards/result`. The native client **must not** reorder or invent
reveals — it only plays what it receives, one at a time, then returns to the
Result summary. Never a dashboard.

- `RevealItem.priority` is authoritative — sort ascending, present sequentially.
- Only meaningful moments are enqueued (a normal loss yields just `result`).
- The ceremony is a **queue of full-screen moments**, not a list. iOS: a
  `RevealCoordinator` `ObservableObject` driving a `ZStack` of transitions;
  Android: a `RevealViewModel` exposing `StateFlow<RevealItem?>` driving an
  `AnimatedContent`.

```swift
@MainActor final class RevealCoordinator: ObservableObject {
    @Published private(set) var current: RevealItem?
    private var queue: [RevealItem] = []
    func begin(_ items: [RevealItem]) { queue = items.sorted { $0.priority < $1.priority }; advance() }
    func advance() { current = queue.isEmpty ? nil : queue.removeFirst() }
}
```

**Reduced motion.** If `UIAccessibility.isReduceMotionEnabled` (iOS) /
`Settings.Global.TRANSITION_ANIMATION_SCALE == 0` or the accessibility
reduce-motion flag (Android) is set, replace each animated moment with an
instant static card — exactly like the web's reduced-motion fallback.

---

## 5. Entitlement mapping (titles, badges, cosmetics, trophies, collections)

Sources: catalogue [`src/lib/rewards/catalogue.ts`](../src/lib/rewards/catalogue.ts),
engine grant/equip helpers, and `getFullProfile`.

- **Catalogue is code-owned and identical across platforms.** Ship the same
  `TITLES` / `BADGES` / `COSMETICS` / `COLLECTIONS` / `MASTERY_TIERS` /
  `WEEKLY_OBJECTIVES` tables as native constants generated from the TS source
  (a small codegen step keeps them in lockstep). Never hand-edit one platform.
- **Names/descriptions are localization keys**, never literals (`rewards.title.*`,
  `rewards.badge.*`, `rewards.cosmetic.*`). Native resolves them through the same
  five locale bundles (section 8).
- **Equip/pin are server actions.** The client POSTs to `/title`, `/pin`,
  `/trophy`, `/cosmetics`; the server validates (e.g. max 3 pinned showcase-eligible
  badges, trophy slot rules) and returns the new state. The native UI reflects the
  server response — it does not locally mutate entitlements.
- **Progressive disclosure** gates every surface: a Trophy Cabinet, Mastery list or
  Collection grid renders only when it has ≥1 earned item (`DisclosureState` from
  `/summary` + presence checks in the profile), matching `computeDisclosure`.
- **Starter cosmetics** exist from first launch (a complete quiet default), so the
  cosmetics surface is never empty and never a store-first experience.

---

## 6. Haptics & audio mapping

The web uses CSS/DOM; native uses first-class feedback. Feedback is **tied to the
reveal type**, is skill-neutral, and respects the OS "reduce motion / reduce
sound" and the app's own toggles. Nothing here affects gameplay outcomes.

| Reveal / event | iOS (Core Haptics / `UINotificationFeedbackGenerator`) | Android (`VibrationEffect` / `HapticFeedbackConstants`) | Audio |
| --- | --- | --- | --- |
| `result` (win) | `.success` | `CONFIRM` | short chime |
| `career-earnings` tally | light transient ticks per digit | `EFFECT_TICK` loop | count-up shimmer |
| `streak` | `.warning`→`.success` on new best | `LONG_PRESS` | streak tone |
| `badge-unlock` | `.success` | `CONFIRM` | badge pop |
| `legendary-badge` / `first-millionaire` | Core Haptics AHAP crescendo | one-shot composed waveform | fanfare (the equipped `fanfare` cosmetic) |
| `mastery-tier` / `collection-complete` | medium impact | `EFFECT_HEAVY_CLICK` | tier stinger |

Rules: (1) gate all of it behind `hapticsEnabled` / `soundEnabled` settings; (2)
skip entirely under system reduce-motion if the user hasn't explicitly opted in;
(3) the **fanfare** and **result-halo** are cosmetics — read the equipped
`CosmeticType.fanfare` / `.resultHalo` from the profile and play that variant.

---

## 7. Notifications & widgets

Retention surfaces derive from the same daily/streak/weekly state — no new rules.

**Notifications**
- **Daily question available / streak-at-risk**: schedule a local notification for
  the player's local morning (compute with the same `utcOffsetMinutes` logic).
  iOS: `UNUserNotificationCenter` with a `UNCalendarNotificationTrigger`; Android:
  `AlarmManager` + a notification channel (`WorkManager` for reliability).
- **Weekly objective claimable**: fire when `getWeekly` shows a completed,
  unclaimed objective. Deep-link into the Journey surface.
- Copy comes from the localization bundles; respect quiet hours and OS permission
  state. Never notify about monetization.

**Widgets**
- iOS **WidgetKit** (`TimelineProvider`) and Android **Glance** `GlanceAppWidget`.
- Show: current streak glyph, today's daily-question status, and Career Earnings
  lifetime total (read-only). All from `/summary` + `/profile`, cached.
- Widgets are **read-only** and honor disclosure: a brand-new player's widget shows
  the quiet default (no fake locked slots).

---

## 8. Accessibility & localization mapping

**Localization**
- Five locales: `he`, `en`, `ar`, `ru`, `am`. Ship the same key set the web uses
  (`rewards.*` keys in `src/lib/localization/locales/*`). A codegen step converts
  them to `.strings`/`.stringsdict` (iOS) and `strings.xml` per-locale (Android).
- **Never concatenate** localized fragments; use positional format args. Money is
  formatted at the edge with a dollars formatter (grouping per locale, symbol
  always `$`) — the rules never format money.
- **RTL/LTR**: `he`/`ar` are RTL. Use **leading/trailing** (SwiftUI) and
  `start/end` + `layoutDirection` (Compose) everywhere — never left/right — mirroring
  the web's logical-property CSS. Test every rewards surface in both directions.

**Accessibility**
- **Dynamic Type** (iOS) / **font scale** (Android): all rewards typography scales;
  no clipped monograms, badges or ledger rows.
- **VoiceOver / TalkBack**: every reveal announces its meaning (e.g. "New badge:
  Perfect Run"); the ledger is a proper table; equip/pin buttons have labels and
  state. The one-at-a-time ceremony sets accessibility focus to each moment.
- **Reduce Motion / Reduce Transparency**: static fallbacks for the ceremony and
  the count-up (final value shown immediately), matching the web.
- **Contrast & targets**: honor increased-contrast settings; 44pt/48dp minimum
  touch targets on equip/pin/claim controls.

---

## 9. Parity checklist (definition of done for a native client)

- [ ] Domain models decode from the live API with unknown-case fallbacks.
- [ ] Reveal queue is server-ordered and played one moment at a time, never reordered.
- [ ] Dollars only; no second currency anywhere in the UI or copy.
- [ ] Career Earnings shown as an honor record (lifetime only grows); ledger read-only.
- [ ] Equip/pin/claim are server round-trips; no local entitlement mutation.
- [ ] Progressive disclosure hides every not-yet-earned surface.
- [ ] Five locales resolve every `rewards.*` key; RTL verified for `he`/`ar`.
- [ ] Reduce-motion and VoiceOver/TalkBack paths verified on the ceremony.
- [ ] Notifications + widgets are read-only, localized, and disclosure-aware.
- [ ] No rewards element added to the in-question gameplay HUD.

---

### Cross-references

- Domain + engine: `src/lib/rewards/{types,catalogue,engine,service}.ts`
- Persistence: `src/lib/repositories/rewardsRepository.ts`, `src/lib/rewards/supabaseRewardsRepository.ts`
- Contracts + client: `src/lib/api/contracts/rewards.ts`, `src/lib/rewards/client.ts`
- Web surfaces (reference implementations): `src/components/trivia/RewardReveals.tsx`,
  `src/components/trivia/screens/{Journey,RewardsProfile}.tsx`
- Migrations: `database/010_rewards_progression.sql`, `database/011_reward_stats.sql`
- General mobile readiness: `docs/api-contracts-and-mobile-readiness.md`
