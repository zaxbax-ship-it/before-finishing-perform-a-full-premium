import { createLogger } from './logger';
import { captureSentryException } from './sentry';

export type ErrorReport = {
  error: unknown;
  context?: Record<string, unknown>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
};

export type ErrorReporter = {
  capture(report: ErrorReport): void;
};

const logger = createLogger('error-reporter');

export function createErrorReporter(): ErrorReporter {
  return {
    capture({ error, context = {}, severity = 'medium' }) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(message, { severity, area: String(context.area || 'unknown') });
      captureSentryException(error, { severity, ...context });
    }
  };
}
