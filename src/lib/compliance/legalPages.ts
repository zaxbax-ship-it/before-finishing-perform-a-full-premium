import { LEGAL_LAST_UPDATED, SITE_NAME } from '@/lib/site/config';

export type LegalPageKey = 'privacy-policy' | 'terms-of-service' | 'cookie-policy' | 'about' | 'contact';

export type LegalSection = {
  heading: string;
  body: string[];
  bullets?: string[];
};

export type LegalPageContent = {
  slug: LegalPageKey;
  title: string;
  eyebrow: string;
  description: string;
  canonicalPath: string;
  sections: LegalSection[];
};

const privacyPolicy: LegalPageContent = {
  slug: 'privacy-policy',
  title: 'Privacy Policy',
  eyebrow: `Last updated: ${LEGAL_LAST_UPDATED}`,
  description:
    `${SITE_NAME} explains what data may be collected, how it is used, and how privacy controls are handled before external analytics or advertising services are enabled.`,
  canonicalPath: '/privacy-policy',
  sections: [
    {
      heading: 'Overview',
      body: [
        `${SITE_NAME} is a multilingual trivia platform with gameplay, public leaderboards, optional community submissions, and protected administrator tools. This policy describes the information we may process when people use the public website or sign in to account-based features.`
      ]
    },
    {
      heading: 'Information We Process',
      body: [
        'The platform may process gameplay results, selected display names or nicknames, language preferences, settings, submitted questions, moderation status, audit records, anti-spam signals, and account information supplied through the authentication provider.',
        'Server logs may include technical information such as IP address, user agent, request path, timestamps, security events, and error details needed to operate and protect the service.'
      ]
    },
    {
      heading: 'How Information Is Used',
      body: [
        'Information is used to provide the trivia experience, preserve user settings, operate public leaderboards, review community submissions, protect the admin area, prevent spam, improve reliability, and comply with legal or platform requirements.'
      ],
      bullets: [
        'Account and admin data is used only for authentication, authorization, security, and support.',
        'Community submissions may be reviewed by automated moderation tools and human reviewers before publication.',
        'Leaderboard data is public only when a user chooses or confirms a public display name or nickname.'
      ]
    },
    {
      heading: 'Advertising and Third-Party Vendors',
      body: [
        'Advertising networks are not connected until publisher accounts and consent controls are configured. If Google advertising services are enabled later, third-party vendors, including Google, may use cookies to serve ads based on prior visits to this and other websites.',
        'Google advertising cookies may allow Google and its partners to serve personalized or non-personalized ads. Users can manage Google ad personalization through Google Ads Settings and can learn more about industry opt-out choices through recognized advertising preference tools.'
      ]
    },
    {
      heading: 'Analytics and Measurement',
      body: [
        'Analytics providers are optional and controlled by environment configuration. When enabled, analytics data is used to understand site performance, diagnose product issues, and improve the user experience. Analytics tools must respect the active consent-management configuration where required.'
      ]
    },
    {
      heading: 'Cookies and Local Storage',
      body: [
        'The service may use essential cookies and local storage for authentication, security, preferences, gameplay continuity, rate limiting, and accessibility. Non-essential analytics or advertising storage is prepared for certified consent-management tools and should be enabled only after consent requirements are satisfied.'
      ]
    },
    {
      heading: 'Data Retention',
      body: [
        'Operational data is retained only as long as reasonably needed for account access, gameplay functionality, moderation records, fraud prevention, legal compliance, and platform integrity. Community audit records may be retained longer when needed to document moderation decisions.'
      ]
    },
    {
      heading: 'Your Choices',
      body: [
        'Users can avoid optional account features by using only public gameplay. Signed-in users may request updates to account-related information, leaderboard display names, or community submission records where technically and legally possible.'
      ]
    },
    {
      heading: 'Contact',
      body: [
        'Privacy requests should be sent through the official contact channel listed on the Contact page. Before public launch, that contact channel should be configured in production so users can reach the site operator directly.'
      ]
    }
  ]
};

const termsOfService: LegalPageContent = {
  slug: 'terms-of-service',
  title: 'Terms of Service',
  eyebrow: `Last updated: ${LEGAL_LAST_UPDATED}`,
  description:
    `The terms governing public gameplay, accounts, community submissions, moderation, fair use, and administrator access for ${SITE_NAME}.`,
  canonicalPath: '/terms-of-service',
  sections: [
    {
      heading: 'Acceptance',
      body: [
        `By using ${SITE_NAME}, you agree to these terms and to any additional rules shown inside the platform. If you do not agree, do not use the website.`
      ]
    },
    {
      heading: 'Use of the Service',
      body: [
        'The platform provides entertainment, trivia gameplay, community-submitted question workflows, and protected administration tools. You must use the service lawfully and must not interfere with its security, availability, ranking systems, moderation systems, or other users.'
      ]
    },
    {
      heading: 'Accounts and Admin Access',
      body: [
        'Certain features require authentication. Admin and editor screens are restricted to authorized users. Account holders are responsible for keeping access secure and must not share privileged access with unauthorized people.'
      ]
    },
    {
      heading: 'Community Submissions',
      body: [
        'Users may submit trivia questions where the feature is available. Submissions must be original or properly permitted, accurate to the best of the contributor’s knowledge, and suitable for a broad audience.',
        'By submitting content, you grant the site operator permission to review, edit, translate, moderate, reject, publish, and display that content as part of the platform.'
      ]
    },
    {
      heading: 'Moderation',
      body: [
        'The operator may remove, reject, or edit content that is inaccurate, duplicative, unsafe, abusive, spammy, infringing, misleading, or otherwise unsuitable. Automated assistance may be used, but final editorial control remains with authorized human administrators.'
      ]
    },
    {
      heading: 'Fair Play',
      body: [
        'Users must not manipulate leaderboards, automate abusive traffic, probe private APIs, bypass rate limits, exploit bugs, or attempt to access admin functions without permission.'
      ]
    },
    {
      heading: 'Advertising and External Services',
      body: [
        'The site may later use third-party services for advertising, analytics, payments, email, abuse prevention, authentication, and content review. Those integrations remain optional and must be configured under the relevant provider policies before they become active.'
      ]
    },
    {
      heading: 'No Warranty',
      body: [
        'The platform is provided as an entertainment and information service. Trivia content can contain errors despite moderation efforts. The service is provided without warranties to the maximum extent permitted by law.'
      ]
    }
  ]
};

const cookiePolicy: LegalPageContent = {
  slug: 'cookie-policy',
  title: 'Cookie Policy',
  eyebrow: `Last updated: ${LEGAL_LAST_UPDATED}`,
  description:
    `${SITE_NAME} explains essential storage, optional analytics, optional advertising storage, and the prepared consent-management approach.`,
  canonicalPath: '/cookie-policy',
  sections: [
    {
      heading: 'Overview',
      body: [
        'Cookies, local storage, and similar technologies may be used to keep the website secure, remember preferences, support gameplay, authenticate users, prevent abuse, and measure performance.'
      ]
    },
    {
      heading: 'Essential Storage',
      body: [
        'Essential storage supports login sessions, admin authorization, security protections, rate limiting, language choice, gameplay state, and accessibility-related preferences. These technologies are needed for core functionality.'
      ]
    },
    {
      heading: 'Analytics Storage',
      body: [
        'Google Analytics 4, Google Tag Manager, Microsoft Clarity, or other analytics tools can be enabled later through environment variables. These tools must be activated only with the correct consent configuration where applicable.'
      ]
    },
    {
      heading: 'Advertising Storage',
      body: [
        'Google AdSense, Google Ad Manager, Media.net, Ezoic, or other advertising providers can be connected later. Advertising storage must remain controlled by a certified consent-management platform in regions where consent is required.'
      ]
    },
    {
      heading: 'Consent Management',
      body: [
        'The codebase is prepared for certified CMP providers such as Cookiebot, Usercentrics, and Consentmanager. The active CMP provider and account identifiers are controlled by environment variables so consent scripts can be enabled without changing application code.'
      ]
    },
    {
      heading: 'Managing Choices',
      body: [
        'When a certified CMP is connected, users will be able to review and update consent choices through the CMP interface. Browser controls can also block or delete cookies, although doing so may affect login, preferences, or gameplay continuity.'
      ]
    }
  ]
};

const aboutPage: LegalPageContent = {
  slug: 'about',
  title: `About ${SITE_NAME}`,
  eyebrow: 'Production readiness and editorial standards',
  description:
    `${SITE_NAME} is a premium quiz-show style trivia platform built for multilingual gameplay, moderated community growth, and responsible publisher operations.`,
  canonicalPath: '/about',
  sections: [
    {
      heading: 'What This Platform Is',
      body: [
        `${SITE_NAME} is a premium trivia experience designed around fast gameplay, clear questions, elegant multilingual presentation, public leaderboards, and protected editorial workflows.`
      ]
    },
    {
      heading: 'Editorial Standards',
      body: [
        'Questions should be accurate, understandable, non-duplicative, and appropriate for a broad public audience. Community content is reviewed through moderation workflows before it can become part of the approved question pool.'
      ]
    },
    {
      heading: 'Technology Approach',
      body: [
        'The platform is prepared for local JSON operation, Supabase/PostgreSQL production storage, protected admin roles, AI-assisted moderation, responsive ad slots, optional analytics, and future consent-controlled advertising integrations.'
      ]
    },
    {
      heading: 'Publisher Standards',
      body: [
        'The public website is structured to be crawlable, easy to navigate, mobile responsive, and ready for privacy disclosures, consent-management tools, analytics configuration, and advertising review.'
      ]
    }
  ]
};

const contactPage: LegalPageContent = {
  slug: 'contact',
  title: 'Contact',
  eyebrow: 'Support, privacy, editorial and business requests',
  description:
    `How to contact the operator of ${SITE_NAME} for privacy requests, content questions, moderation issues, partnership inquiries, and publisher review matters.`,
  canonicalPath: '/contact',
  sections: [
    {
      heading: 'Contact Topics',
      body: [
        'Use the official contact channel for privacy requests, account questions, accessibility feedback, content corrections, moderation appeals, partnership inquiries, advertising review questions, and security concerns.'
      ]
    },
    {
      heading: 'Response Expectations',
      body: [
        'Requests should include the page or feature involved, the relevant account email if applicable, a clear description of the issue, and any safe supporting details. Sensitive information such as passwords, private keys, or payment details should never be sent.'
      ]
    },
    {
      heading: 'Before Launch',
      body: [
        'A public support address should be configured in production through NEXT_PUBLIC_CONTACT_EMAIL so visitors, advertisers, and reviewers can reach the operator through a stable channel.'
      ]
    }
  ]
};

export const LEGAL_PAGES: Record<LegalPageKey, LegalPageContent> = {
  'privacy-policy': privacyPolicy,
  'terms-of-service': termsOfService,
  'cookie-policy': cookiePolicy,
  about: aboutPage,
  contact: contactPage
};
