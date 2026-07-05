import Link from 'next/link';
import type { LegalPageContent } from '@/lib/compliance/legalPages';
import { getPublicContactEmail, SITE_NAME } from '@/lib/site/config';

type LegalPageProps = {
  page: LegalPageContent;
};

export function LegalPage({ page }: LegalPageProps) {
  const contactEmail = getPublicContactEmail();

  return (
    <main className="compliance-page" dir="ltr" lang="en" aria-labelledby="legal-page-title">
      <section className="compliance-hero">
        <Link href="/" className="compliance-back-link">
          Back to game
        </Link>
        <p className="compliance-eyebrow">{page.eyebrow}</p>
        <h1 id="legal-page-title">{page.title}</h1>
        <p className="compliance-description">{page.description}</p>
      </section>

      <div className="compliance-layout">
        <aside className="compliance-toc" aria-label="Page sections">
          <strong>{SITE_NAME}</strong>
          {page.sections.map(section => (
            <a key={section.heading} href={`#${toAnchor(section.heading)}`}>
              {section.heading}
            </a>
          ))}
        </aside>

        <article className="compliance-card">
          {page.slug === 'contact' && (
            <section className="compliance-contact-strip" aria-label="Official contact channel">
              <span>Official contact channel</span>
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
              ) : (
                <strong>Configure NEXT_PUBLIC_CONTACT_EMAIL before public launch.</strong>
              )}
            </section>
          )}

          {page.sections.map(section => (
            <section key={section.heading} id={toAnchor(section.heading)} className="compliance-section">
              <h2>{section.heading}</h2>
              {section.body.map(paragraph => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}

function toAnchor(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
