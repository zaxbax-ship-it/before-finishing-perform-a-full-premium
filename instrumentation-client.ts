import * as Sentry from '@sentry/nextjs';
import { createSentryInitOptions } from '@/lib/infrastructure/sentry';

Sentry.init(createSentryInitOptions('client'));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
