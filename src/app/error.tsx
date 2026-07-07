'use client';

import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { WarningIcon } from '@/lib/design/icons';

export default function AppError({
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
    <main className="compliance-error-page" dir="ltr" lang="en">
      <section className="compliance-error-card" aria-labelledby="app-error-title">
        <div className="mx-auto mb-6 text-7xl text-gold flex justify-center"><WarningIcon size={64} aria-hidden="true" /></div>
        <h1 id="app-error-title">The page needs a refresh</h1>
        <p>
          A temporary error interrupted this view. Try again, or return to the main trivia experience.
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
  );
}
