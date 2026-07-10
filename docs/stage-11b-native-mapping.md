# Stage 11B — Native Mapping (SwiftUI + Jetpack Compose)

Focused port contract for the Stage 11B changes. As with Stage 10B, the *rules*
are platform-neutral (in `src/lib/community.ts`), never buried in CSS or React
state — native clients call the same logic.

## 1. Question validation state
Source: `validateCommunityQuestion(question, correctAnswer)` and
`meaningfulLength(value)` in [`community.ts`](../src/lib/community.ts). Rule: a
question needs ≥ **35 meaningful characters** (trimmed, whitespace collapsed); the
answer only needs to be non-empty.

```swift
struct CommunityQuestionValidation { let meaningfulLength, minLength: Int; let questionValid, answerValid, canSubmit: Bool }
func meaningfulLength(_ v: String) -> Int { v.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).count }
```
```kotlin
fun meaningfulLength(v: String) = v.trim().replace(Regex("\\s+"), " ").length
data class QuestionValidation(val meaningfulLength: Int, val minLength: Int, val questionValid: Boolean, val answerValid: Boolean, val canSubmit: Boolean)
```
The submit control binds `disabled = !canSubmit` (SwiftUI `.disabled(!v.canSubmit)`, Compose `enabled = v.canSubmit`).

## 2. Touched / blurred validation disclosure
Source: `shouldShowQuestionHint(question, touched)`. The compact hint shows only
after the field is **touched (blurred)**, has content, and is still too short; it
disappears the instant the rule passes. No permanent helper copy; no toast/modal.

- **SwiftUI**: track `@State private var touched = false`; set it in
  `.onChange(of: isFocused) { if !$0 { touched = true } }` (FocusState). Render the
  hint (and the `n / 35` counter) only when `shouldShowQuestionHint(...)`.
- **Compose**: `Modifier.onFocusChanged { if (!it.isFocused && wasFocused) touched = true }`;
  show a `Text` hint conditionally.

## 3. Unified account entry point
One control replaces Login + Create-account. Unauthenticated → the person/avatar
(gold) navigates to the unified auth screen (login + signup + forgot). Authenticated
→ same control opens the profile/account area. Always a localized `aria-label`.
- **SwiftUI**: a single `Button { path.append(authenticated ? .profile : .auth) } label: { Image("person.crop.circle.fill") }.accessibilityLabel(labelForCurrentState)`.
- **Compose**: one `IconButton(onClick = { nav.navigate(if (authed) Profile else Auth) }) { Icon(..., contentDescription = label) }`.

## 4. Icon-control primitive
Source: `IconButton` in [`primitives.tsx`](../src/components/trivia/primitives.tsx) +
the `.icon-button` family (48px desktop / 44px touch, centered glyph, required label).
- **SwiftUI**: a reusable `IconControl(label:tone:action:)` view, fixed 44×44 frame,
  `.accessibilityLabel(label)`, glyph centered via `.frame(maxWidth:.infinity,maxHeight:.infinity)`.
- **Compose**: a `IconControl(label, tone, onClick)` wrapping `IconButton` with a 48.dp
  `Modifier.size`, `contentDescription = label`.

## 5. Header control family
All top controls (menu, language, account) share one visual family: same box,
radius, glass/gold treatment, touch target, and centered content — differing only in
tone (glass utility vs gold primary). Map to a shared `HeaderControl` style/modifier
applied to each top-bar button, so RTL/LTR never shifts a centered icon (use
leading/trailing, never left/right).

## 6. Google authentication control
Official multicolor Google "G" (never recolored/distorted) on a clean white,
high-contrast surface; localized label ("המשך עם Google" / "Continue with Google");
explicit focus, pressed, loading (spinner) and disabled states; ≥ 44/48pt target.
- **SwiftUI**: a `GoogleSignInButton` view: white background, the 4-color G asset,
  `.disabled(busy)`, a `ProgressView` swapped in for `loading`, full `.accessibilityLabel`.
- **Compose**: an `OutlinedButton` with white container color, the G `Painter`, a
  `CircularProgressIndicator` when loading, `Modifier.semantics { contentDescription = label }`.

## 7. Inline field errors
Errors are contextual and single: one message per field, associated with the input
(`aria-describedby` + `aria-invalid` on web). No stacked error paragraphs.
- **SwiftUI**: place a `Text(error).foregroundStyle(.red)` directly under the field;
  set `.accessibilityValue` / announce via `AccessibilityNotification`.
- **Compose**: `OutlinedTextField(isError = hasError, supportingText = { Text(error) })`
  — the built-in supporting-text slot is the exact analog of the web inline error.

## Rules honored
Business/validation rules live in shared functions (not CSS, not only React state);
color is never the sole signal (text + `aria-invalid` + disabled semantics); every
functional icon-only control carries a localized accessible label.
