import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="compliance-error-page" dir="ltr" lang="en">
      <section className="compliance-error-card" aria-labelledby="not-found-title">
        <h1 id="not-found-title">Page not found</h1>
        <p>
          The page you requested is not available. You can return to the trivia game or review the public site information below.
        </p>
        <div className="compliance-error-actions">
          <Link className="premium-button focus-ring" href="/">
            Back to game
          </Link>
          <Link className="ghost-button focus-ring" href="/about">
            About the platform
          </Link>
        </div>
      </section>
    </main>
  );
}
