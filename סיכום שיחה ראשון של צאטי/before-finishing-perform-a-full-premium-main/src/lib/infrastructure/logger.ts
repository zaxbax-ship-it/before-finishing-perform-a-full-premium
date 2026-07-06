export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, string | number | boolean | undefined>;

export type Logger = {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
};

function write(level: LogLevel, message: string, context: LogContext = {}) {
  if (level === 'debug' && process.env.NODE_ENV === 'production') return;
  const payload = { level, message, context, at: new Date().toISOString() };
  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else console.log(payload);
}

export function createLogger(scope: string): Logger {
  const withScope = (context: LogContext = {}) => ({ scope, ...context });
  return {
    debug: (message, context) => write('debug', message, withScope(context)),
    info: (message, context) => write('info', message, withScope(context)),
    warn: (message, context) => write('warn', message, withScope(context)),
    error: (message, context) => write('error', message, withScope(context))
  };
}
