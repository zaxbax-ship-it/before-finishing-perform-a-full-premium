# Analytics and Search Readiness

The app supports optional Google Analytics 4 page view tracking and Search Console verification without requiring any secret browser credentials.

## Environment variables

```env
NEXT_PUBLIC_ANALYTICS_PROVIDER=none
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_BING_SITE_VERIFICATION=
```

## Google Analytics 4

- Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4`
- Set `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`
- Only the public measurement id is used
- No GA secret or server credential is required
- The app tracks basic page views only
- If GA4 is not configured, the app continues working normally

Implementation notes:

- the GA script loads only when GA4 is explicitly enabled
- initial and client-side route page views are tracked safely in the App Router
- `send_page_view` is disabled in the base config so page views are emitted by one dedicated client component, avoiding double counting

## Search Console

Search verification is already wired through Next.js metadata:

- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
- `NEXT_PUBLIC_BING_SITE_VERIFICATION`

Once configured, Next.js renders the verification meta tags automatically in the document head.
