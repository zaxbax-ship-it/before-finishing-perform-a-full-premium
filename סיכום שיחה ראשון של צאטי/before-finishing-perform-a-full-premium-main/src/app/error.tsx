'use client';

import Link from 'next/link';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="compliance-error-page" dir="ltr" lang="en">
      <section className="compliance-error-card" aria-labelledby="app-error-title">
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
