import { readBooleanEnv, readEnv } from '@/lib/infrastructure/environment';
import type { AiModerationProvider } from './types';
import { createMockLocalAiModerationProvider } from './providers/mockLocalProvider';
import { createOpenAiModerationProvider } from './providers/openAiProvider';

export function createAiModerationProvider(): AiModerationProvider {
  const openAiEnabled = readBooleanEnv('OPENAI_MODERATION_ENABLED');
  const hasKey = Boolean(readEnv('OPENAI_API_KEY'));
  if (openAiEnabled && hasKey) return createOpenAiModerationProvider();
  return createMockLocalAiModerationProvider();
}
