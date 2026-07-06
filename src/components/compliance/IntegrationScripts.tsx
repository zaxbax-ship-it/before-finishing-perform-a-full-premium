import Script from 'next/script';
import type { ReactNode } from 'react';
import { getProductionConfig } from '@/lib/infrastructure/config';

export function IntegrationScripts() {
  const config = getProductionConfig();
  const scripts: ReactNode[] = [];

  if (config.consent.provider === 'cookiebot' && config.consent.cookiebotId) {
    scripts.push(
      <Script
        key="cookiebot"
        id="cookiebot-cmp"
        src="https://consent.cookiebot.com/uc.js"
        data-cbid={config.consent.cookiebotId}
        data-blockingmode="auto"
        strategy="afterInteractive"
      />
    );
  }

  if (config.consent.provider === 'usercentrics' && config.consent.usercentricsSettingsId) {
    scripts.push(
      <Script
        key="usercentrics"
        id="usercentrics-cmp"
        src="https://web.cmp.usercentrics.eu/ui/loader.js"
        data-settings-id={config.consent.usercentricsSettingsId}
        strategy="afterInteractive"
      />
    );
  }

  if (config.consent.provider === 'consentmanager' && config.consent.consentmanagerId) {
    scripts.push(
      <Script
        key="consentmanager"
        id="consentmanager-cmp"
        src={`https://cdn.consentmanager.net/delivery/autoblocking/${config.consent.consentmanagerId}.js`}
        strategy="afterInteractive"
      />
    );
  }

  if (config.analytics.provider === 'ga4' && config.analytics.gaMeasurementId) {
    scripts.push(
      <Script
        key="ga4-loader"
        id="ga4-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.analytics.gaMeasurementId)}`}
        strategy="afterInteractive"
      />
    );
    scripts.push(
      <Script
        key="ga4-init"
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${escapeScriptValue(config.analytics.gaMeasurementId)}', { anonymize_ip: true, send_page_view: false });
          `
        }}
      />
    );
  }

  if (config.analytics.gtmId) {
    scripts.push(
      <Script
        key="gtm-init"
        id="gtm-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
            j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
            f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${escapeScriptValue(config.analytics.gtmId)}');
          `
        }}
      />
    );
  }

  if (config.analytics.clarityProjectId) {
    scripts.push(
      <Script
        key="clarity-init"
        id="clarity-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${escapeScriptValue(config.analytics.clarityProjectId)}");
          `
        }}
      />
    );
  }

  return (
    <>
      <div
        hidden
        data-cmp-provider={config.consent.provider}
        data-cmp-configured={config.consent.configured ? 'true' : 'false'}
      />
      {config.analytics.gtmId && (
        <noscript>
          <iframe
            title="Google Tag Manager"
            src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(config.analytics.gtmId)}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      )}
      {scripts}
    </>
  );
}

function escapeScriptValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
