import 'server-only';
import { createErrorReporter, type ErrorReporter } from './errorReporter';
import { getProductionConfig, type ProductionConfig } from './config';
import { createExternalAdapters, type ExternalAdapters } from './adapters';
import { createLogger, type Logger } from './logger';
import { createSecretsManager, type SecretsManager } from './secrets';

export type ServiceRegistry = {
  config: ProductionConfig;
  secrets: SecretsManager;
  logger: Logger;
  errors: ErrorReporter;
  adapters: ExternalAdapters;
};

let registry: ServiceRegistry | undefined;

export function createServiceRegistry(): ServiceRegistry {
  return {
    config: getProductionConfig(),
    secrets: createSecretsManager(),
    logger: createLogger('app'),
    errors: createErrorReporter(),
    adapters: createExternalAdapters()
  };
}

export function getServiceRegistry(): ServiceRegistry {
  registry = registry || createServiceRegistry();
  return registry;
}

export function resetServiceRegistryForTests() {
  registry = undefined;
}
