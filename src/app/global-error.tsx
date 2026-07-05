'use client';

import Link from 'next/link';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <main className="compliance-error-page">
          <section className="compliance-error-card" aria-labelledby="global-error-title">
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
