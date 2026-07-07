# Design System Tokens & Mobile UI Parity

This document outlines the standardized design tokens of the Trivia Platform, defining spacing, typography, colors, animations, z-indexes, and details on how these tokens map directly to native SwiftUI (iOS) and Jetpack Compose (Android) interfaces.

---

## 1. Color System

| Token Name | Web Value | SwiftUI (iOS) | Jetpack Compose (Android) |
| --- | --- | --- | --- |
| `--bg` | `#030612` | `Color(hex: "030612")` | `Color(0xFF030612)` |
| `--ink` | `#f8fbff` | `Color(hex: "f8fbff")` | `Color(0xFFf8fbff)` |
| `--muted` | `#b8c6e4` | `Color(hex: "b8c6e4")` | `Color(0xFFb8c6e4)` |
| `--gold` | `#f7ca67` | `Color(hex: "f7ca67")` | `Color(0xFFf7ca67)` |
| `--azure` | `#45c2ff` | `Color(hex: "45c2ff")` | `Color(0xFF45c2ff)` |
| `--violet` | `#7d6cff` | `Color(hex: "7d6cff")` | `Color(0xFF7d6cff)` |
| `--success` | `#55f0b5` | `Color(hex: "55f0b5")` | `Color(0xFF55f0b5)` |
| `--danger` | `#ff6172` | `Color(hex: "ff6172")` | `Color(0xFFff6172)` |

---

## 2. Spacing Tokens

To maintain layout proportions across viewports and screen densities, spacing is locked to standardized steps:

| Token Name | Web Rem | Equivalent (pt / dp) | SwiftUI | Jetpack Compose |
| --- | --- | --- | --- | --- |
| `--space-xxs` | `0.25rem` | `4pt` | `4` | `4.dp` |
| `--space-xs` | `0.5rem` | `8pt` | `8` | `8.dp` |
| `--space-sm` | `0.75rem` | `12pt` | `12` | `12.dp` |
| `--space-md` | `1.0rem` | `16pt` | `16` | `16.dp` |
| `--space-lg` | `1.5rem` | `24pt` | `24` | `24.dp` |
| `--space-xl` | `2.0rem` | `32pt` | `32` | `32.dp` |
| `--space-xxl` | `3.0rem` | `48pt` | `48` | `48.dp` |

---

## 3. Typography Sizing

Font sizes map naturally to native dynamic type styles to ensure accessibility resizing works cleanly:

| Token Name | Web Size | SwiftUI Style | Jetpack Compose Style |
| --- | --- | --- | --- |
| `--text-xs` | `0.75rem` | `.caption2` | `MaterialTheme.typography.labelSmall` |
| `--text-sm` | `0.875rem` | `.caption` | `MaterialTheme.typography.bodySmall` |
| `--text-base` | `1.0rem` | `.body` | `MaterialTheme.typography.bodyMedium` |
| `--text-lg` | `1.125rem` | `.callout` | `MaterialTheme.typography.bodyLarge` |
| `--text-xl` | `1.25rem` | `.headline` | `MaterialTheme.typography.titleMedium` |
| `--text-2xl` | `1.5rem` | `.title3` | `MaterialTheme.typography.titleLarge` |
| `--text-3xl` | `1.875rem` | `.title2` | `MaterialTheme.typography.headlineSmall` |
| `--text-4xl` | `2.25rem` | `.title` | `MaterialTheme.typography.headlineMedium` |
| `--text-5xl` | `3.0rem` | `.largeTitle` | `MaterialTheme.typography.displaySmall` |
| `--text-6xl` | `3.75rem` | `.largeTitle` (Scaled) | `MaterialTheme.typography.displayMedium` |

---

## 4. Border Radius (Rounded Corners)

| Token Name | Web Value | SwiftUI ClipShape | Jetpack Compose Shape |
| --- | --- | --- | --- |
| `--radius-xs` | `6px` | `RoundedRectangle(cornerRadius: 6)` | `RoundedCornerShape(6.dp)` |
| `--radius-sm` | `12px` | `RoundedRectangle(cornerRadius: 12)` | `RoundedCornerShape(12.dp)` |
| `--radius-md` | `16px` | `RoundedRectangle(cornerRadius: 16)` | `RoundedCornerShape(16.dp)` |
| `--radius-lg` | `20px` | `RoundedRectangle(cornerRadius: 20)` | `RoundedCornerShape(20.dp)` |
| `--radius-xl` | `24px` | `RoundedRectangle(cornerRadius: 24)` | `RoundedCornerShape(24.dp)` |
| `--radius-2xl` | `28px` | `RoundedRectangle(cornerRadius: 28)` | `RoundedCornerShape(28.dp)` |
| `--radius-3xl` | `32px` | `RoundedRectangle(cornerRadius: 32)` | `RoundedCornerShape(32.dp)` |
| `--radius-4xl` | `36px` | `RoundedRectangle(cornerRadius: 36)` | `RoundedCornerShape(36.dp)` |
| `--radius-full` | `9999px` | `Capsule()` | `CircleShape` |

---

## 5. Animation & Transition Timing

Transitions use standard durations and curve controls:

| Token Name | Duration | Web Easing Curve | SwiftUI Easing | Jetpack Compose Easing |
| --- | --- | --- | --- | --- |
| `Fast` | `0.15s` | `cubic-bezier(0.4, 0, 0.2, 1)` | `.easeInOut(duration: 0.15)` | `FastOutSlowInEasing` (150ms) |
| `Normal` | `0.24s` | `cubic-bezier(0.4, 0, 0.2, 1)` | `.easeInOut(duration: 0.24)` | `FastOutSlowInEasing` (240ms) |
| `Slow` | `0.28s` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | `.interpolatingSpring(stiffness: 120, damping: 14)` | `SpringSpec` (dampingRatio = 0.75) |

---

## 6. Z-Index Layer Hierarchy

Z-index levels correspond to navigation and presentation layer hierarchies:

| Token Name | Z-Index Value | SwiftUI Layout | Jetpack Compose Layout |
| --- | --- | --- | --- |
| `--z-base` | `1` | Default rendering | Default rendering |
| `--z-content` | `2` | Above base background | ZIndexModifier(2f) |
| `--z-navbar` | `50` | Tab bar overlays | Overlay layers |
| `--z-drawer` | `60` | Sheet presentations | Drawer controllers |
| `--z-dropdown` | `80` | Popover anchors | Dropdown menus |
| `--z-modal` | `100` | Fullscreen cover sheets | Dialogue boxes |
