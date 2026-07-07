'use client';

import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { WarningIcon } from '@/lib/design/icons';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" dir="ltr">
      <body>
        <main className="compliance-error-page">
          <section className="compliance-error-card" aria-labelledby="global-error-title">
            <div className="mx-auto mb-6 text-7xl text-gold flex justify-center"><WarningIcon size={64} aria-hidden="true" /></div>
            <h1 id="global-error-title">Something went wrong</h1>
            <p>
              The platform could not complete this request. You can try again or return to the public trivia experience.
            </p>
            <div className="compliance-error-actions">
              <button className="premium-button focus-ring" onClick={() => reset()}>
                Try again
              </button>
              <Link className="ghost-button focus-ring" href="/">
                Back to game
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
