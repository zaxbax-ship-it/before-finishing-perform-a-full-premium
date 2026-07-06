# Roadmap From Here

## Immediate Next Step
Performance audit only:
- Initial JS bundle size
- Route bundle sizes
- Dynamic imports
- Code splitting
- Large dependencies
- Images
- Fonts
- CSS payload
- Hydration cost
- Core Web Vitals risks

Suggested prompt:
```text
IMPORTANT — Performance Audit Only

First synchronize with the latest repository state.

Do NOT modify code unless a fix is extremely small.

Perform a complete performance audit.

Inspect:
- Initial JavaScript bundle size
- Route bundle sizes
- Dynamic imports
- Code splitting
- Unused client components
- Large dependencies
- Images
- Fonts
- CSS payload
- Hydration cost
- Initial network requests
- Largest Contentful Paint risks
- Core Web Vitals risks

Do NOT optimize yet unless the fix is trivial.

Run:
npm run build

Analyze the build output.

Final report:
1. Initial bundle sizes.
2. Largest bundles.
3. Largest client components.
4. Largest dependencies.
5. Biggest optimization opportunities.
6. Estimated performance gain for each.
7. Risk level.
8. Recommended implementation order.
```

## Then
1. GA4.
2. GTM.
3. Microsoft Clarity.
4. Sentry/monitoring.
5. CMP.
6. Search Console.
7. Domain.
8. OpenAI cost/security audit.
9. Translation pipeline.
10. AdSense.
11. Beta.
12. Launch.
