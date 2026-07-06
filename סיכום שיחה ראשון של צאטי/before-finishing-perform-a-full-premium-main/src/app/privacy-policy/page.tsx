import type { Metadata } from 'next';
import { LegalPage } from '@/components/compliance/LegalPage';
import { LEGAL_PAGES } from '@/lib/compliance/legalPages';

const page = LEGAL_PAGES['privacy-policy'];

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: { canonical: page.canonicalPath }
};

export default function PrivacyPolicyPage() {
  return <LegalPage page={page} />;
}
