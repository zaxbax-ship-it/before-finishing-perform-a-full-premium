import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), browsing-topics=()"
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms https://*.clarity.ms https://consent.cookiebot.com https://*.usercentrics.eu https://*.consentmanager.net https://pagead2.googlesyndication.com https://securepubads.g.doubleclick.net https://www.googletagservices.com https://fundingchoicesmessages.google.com",
      "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms https://c.bing.com https://pagead2.googlesyndication.com https://securepubads.g.doubleclick.net https://*.ingest.sentry.io",
      "frame-src 'self' https://www.googletagmanager.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://fundingchoicesmessages.google.com",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests"
    ].join("; ")
  }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: projectRoot
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};
export default nextConfig;
