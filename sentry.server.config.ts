import * as Sentry from '@sentry/nextjs';
import { createSentryInitOptions } from '@/lib/infrastructure/sentry';

Sentry.init(createSentryInitOptions('server'));
