import { getDatabaseConfig, isSupabaseConfigured } from './config';
import { createLocalCommunityRepository } from './localRepository';
import { createSupabaseCommunityRepository } from './supabaseRepository';
import type { CommunityRepository } from './schema';

export function createCommunityRepository(): CommunityRepository {
  const config = getDatabaseConfig();

  if (config.mode === 'supabase' && isSupabaseConfigured(config)) {
    return createSupabaseCommunityRepository();
  }

  return createLocalCommunityRepository();
}

export type {
  AdminPermissionSlug,
  AdminRoleSlug,
  AdminUserRecord,
  AntiSpamEventRecord,
  ApprovedQuestionRecord,
  CommunityRepository,
  CommunityRepositorySnapshot,
  ContributorRecord,
  DatabaseMode,
  ModerationResultRecord,
  ReviewDecision,
  ReviewQueueItemRecord,
  SubmitQuestionResult
} from './schema';
