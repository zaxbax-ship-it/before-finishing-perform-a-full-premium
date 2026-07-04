# Advertising Architecture

The site is prepared for automated ad networks, but no ad provider is connected yet.

## Goals

- Keep gameplay uninterrupted.
- Protect Core Web Vitals by reserving space for ad slots.
- Lazy-load ad areas before they enter the viewport.
- Keep the UI provider-agnostic so Google AdSense can be added first, with future support for Google Ad Manager, Media.net and Ezoic.

## Provider Switch

Environment variables:

```env
NEXT_PUBLIC_ADS_ENABLED=false
NEXT_PUBLIC_AD_PROVIDER=none
NEXT_PUBLIC_AD_PLACEHOLDERS=true
NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=
```

Supported provider names in the architecture:

- `none`
- `adsense`
- `google-ad-manager`
- `media-net`
- `ezoic`

## Slots

Defined in `src/lib/ads/config.ts`.

Current prepared placements:

- `homepage-hero-below`
- `homepage-content`
- `categories-top`
- `categories-grid-after`
- `gameplay-sidebar`
- `gameplay-between-rounds`
- `question-result`
- `admin-top`
- `admin-sidebar`

Gameplay interruption policy:

- Ads are not shown inside answer buttons.
- Ads are not shown as blocking popups.
- Gameplay ad slots default to disabled unless explicitly enabled later.
- Question-result and between-round slots are prepared but not displayed by default.

## Components

`src/components/ads/AdSlot.tsx`

Reusable provider-agnostic slot.

`GameplayAdSlot`

Only renders placements marked as safe for gameplay.

## Performance

- Uses reserved slot height to reduce layout shift.
- Uses `IntersectionObserver` for lazy activation.
- Uses CSS containment and `content-visibility`.
- Does not load external ad scripts yet.

## Future AdSense Connection

When ready:

1. Add the approved AdSense publisher id.
2. Add a provider script loader with `next/script` and `strategy="afterInteractive"`.
3. Map each placement to real AdSense slot ids.
4. Keep `gameplay-sidebar` desktop-only unless product testing proves it does not distract players.
5. Test mobile CLS, LCP and INP before deployment.
