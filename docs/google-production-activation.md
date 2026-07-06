# Google Production Activation

This project is already prepared for:

- Google Analytics 4 page-view tracking
- Google Search Console verification
- production `robots.txt`
- production `sitemap.xml`
- canonical metadata based on the final site origin

## Vercel environment variables

Set these before enabling Google services in production:

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.example
NEXT_PUBLIC_CONTACT_EMAIL=support@your-domain.example
NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=your_google_verification_token
NEXT_PUBLIC_BING_SITE_VERIFICATION=
```

Keep these empty unless you intentionally activate them later:

```env
NEXT_PUBLIC_GTM_ID=
NEXT_PUBLIC_CLARITY_PROJECT_ID=
```

## What is already implemented

### Google Analytics 4

- Only the public GA4 measurement id is used
- No secret is exposed to the browser
- The app loads `gtag.js` only when `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4`
- The app tracks basic page views only
- Client-side App Router navigations are tracked without double-counting

### Google Search Console

- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is already wired to Next.js metadata
- Once the value is set, the verification meta tag is rendered automatically

### robots.txt

Current behavior:

- allows public pages
- disallows `/admin`
- disallows `/api/`
- disallows `/auth/`
- points search engines to the production sitemap

### sitemap.xml

Current sitemap includes:

- `/`
- `/about`
- `/contact`
- `/privacy-policy`
- `/terms-of-service`
- `/cookie-policy`

### Canonical URLs and metadata

- Root canonical is `/`
- legal and informational public pages define canonical paths
- `metadataBase` is derived from `NEXT_PUBLIC_SITE_URL`
- Open Graph and Twitter metadata use the same production origin

## Google-side setup

### Google Analytics 4

1. Create or open your GA4 property.
2. Create a Web data stream for the production domain.
3. Copy the measurement id in the form `G-XXXXXXXXXX`.
4. Add it in Vercel as `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
5. Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4`.
6. Redeploy.

### Google Search Console

1. Open Google Search Console.
2. Add the production domain as a property.
3. If using HTML meta tag verification, copy the token.
4. Add it in Vercel as `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.
5. Redeploy.
6. Click Verify in Search Console.
7. Submit `https://your-domain.example/sitemap.xml`.

## Manual production checks

1. Open the production homepage and confirm the canonical URL matches the real domain.
2. View page source and confirm the Google verification meta tag exists.
3. Open `/robots.txt` and confirm it points to the production sitemap URL.
4. Open `/sitemap.xml` and confirm every URL uses the production domain.
5. In browser DevTools, confirm `gtag/js` loads only when GA4 is enabled.
6. In GA4 Realtime, confirm a page view appears for the homepage.
7. Navigate between a few public pages and confirm additional page views appear.
