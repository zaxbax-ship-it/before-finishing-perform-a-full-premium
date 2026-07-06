# AdSense Verification Script Support

The platform can now load the optional Google AdSense bootstrap / site verification script without creating any ad placements.

## Environment variable

```env
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-4935350853753304
```

## Behavior

- The script loads only when `NEXT_PUBLIC_ADSENSE_CLIENT_ID` is configured.
- No ad placements are created.
- No gameplay, multiplayer, auth, or database logic is affected.
- The script is injected through the existing `IntegrationScripts` pattern.

## Rendered script

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4935350853753304" crossorigin="anonymous"></script>
```

## Manual checks

1. Set `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-4935350853753304`.
2. Start the app or deploy it.
3. Open the page source or DevTools Elements panel.
4. Confirm the AdSense script tag is present once.
5. In the Network tab, confirm `adsbygoogle.js` loads successfully.
6. Confirm no ad slots appear on the page yet.
