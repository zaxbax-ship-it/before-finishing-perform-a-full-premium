# Production Compliance Setup

This project is prepared for external publisher, analytics, consent, and search integrations without requiring any paid service during local development.

## Public Site Identity

- `NEXT_PUBLIC_SITE_URL` must be the final HTTPS origin.
- `NEXT_PUBLIC_CONTACT_EMAIL` should be a monitored public support address before launch.

## Consent Management

Choose one certified CMP provider and configure only that provider:

- Cookiebot: `NEXT_PUBLIC_CMP_PROVIDER=cookiebot` and `NEXT_PUBLIC_COOKIEBOT_ID`
- Usercentrics: `NEXT_PUBLIC_CMP_PROVIDER=usercentrics` and `NEXT_PUBLIC_USERCENTRICS_SETTINGS_ID`
- Consentmanager: `NEXT_PUBLIC_CMP_PROVIDER=consentmanager` and `NEXT_PUBLIC_CONSENTMANAGER_ID`

Keep `NEXT_PUBLIC_CMP_PROVIDER=none` until the CMP account, domain scan, region rules, and consent categories are configured.

## Analytics

Optional public identifiers:

- Google Analytics 4: `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4` and `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Google Tag Manager: `NEXT_PUBLIC_GTM_ID`
- Microsoft Clarity: `NEXT_PUBLIC_CLARITY_PROJECT_ID`

Analytics scripts should be enabled only after the active CMP rules cover analytics consent in required regions.

## Search Verification

Optional public verification tokens:

- Google Search Console: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
- Bing Webmaster Tools: `NEXT_PUBLIC_BING_SITE_VERIFICATION`

Submit `https://your-domain.example/sitemap.xml` after the production domain is live.

## Advertising

Ad infrastructure is prepared, but no ad network is connected by default.

Required before enabling ads:

- Approved publisher account.
- Valid CMP configuration for required regions.
- Final `ads.txt` seller records supplied by the ad network.
- `NEXT_PUBLIC_ADS_ENABLED=true`
- `NEXT_PUBLIC_AD_PROVIDER=adsense` or another supported provider.
- `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` only after AdSense approval.

Do not add fake seller records or publisher ids.

## Security Headers

The project sends conservative production security headers and a report-only CSP. Keep CSP report-only until every real external integration is confirmed in production logs.
