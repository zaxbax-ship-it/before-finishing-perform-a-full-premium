import type { CommunityDraft, ModerationResult } from '@/lib/community';
import type { Locale, Question } from '@/lib/types';
import type { AdminRoleSlug, EntityId, PermissionSlug } from './models';

export type PageDataDto = {
  questions: Question[];
  totalAvailableQuestions: number;
};

export type CreateUserDto = {
  authUserId?: EntityId;
  emailHash?: string;
  displayName: string;
  locale: Locale;
};

export type CreateAdminDto = {
  authUserId?: EntityId;
  email?: string;
  displayName: string;
  roleSlugs: AdminRoleSlug[];
};

export type UpsertRoleDto = {
  slug: AdminRoleSlug;
  name: string;
  description: string;
  priority: number;
};

export type UpsertPermissionDto = {
  slug: PermissionSlug;
  description: string;
};

export type CreateSubmissionDto = {
  draft: CommunityDraft;
  moderation: ModerationResult;
  ipHash?: string;
  userAgentHash?: string;
};

export type ApproveSubmissionDto = {
  submissionId: EntityId;
  adminUserId?: EntityId;
  note?: string;
  /** Admin edits applied before publishing (Stage 11 edit-before-publish). */
  editedQuestion?: Question;
};

export type RejectSubmissionDto = {
  submissionId: EntityId;
  adminUserId?: EntityId;
  note?: string;
};

export type CreateAuditLogDto = {
  actorAdminUserId?: EntityId;
  actorLabel: string;
  action: string;
  targetType: string;
  targetId?: EntityId;
  details: Record<string, unknown>;
};

export type CreateNotificationDto = {
  userId?: EntityId;
  adminUserId?: EntityId;
  locale: Locale;
  channel: 'in_app' | 'email' | 'webhook';
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export type CreateCheckoutSessionDto = {
  provider: 'stripe' | 'lemon_squeezy';
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId?: EntityId;
  userEmail?: string;
  metadata?: Record<string, unknown>;
};

