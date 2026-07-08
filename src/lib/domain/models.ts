import type { AuditLogEntry, CommunitySubmission, ModerationResult } from '@/lib/community';
import type { Locale, Question } from '@/lib/types';

export type EntityId = string;
export type ISODateTime = string;

export type User = {
  id: EntityId;
  authUserId?: EntityId;
  emailHash?: string;
  displayName: string;
  locale: Locale;
  isActive: boolean;
  lastSeenAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type AdminRoleSlug = 'super_admin' | 'admin' | 'moderator';

export type PermissionSlug =
  | 'admin.users.manage'
  | 'admin.roles.manage'
  | 'questions.read'
  | 'questions.write'
  | 'submissions.read'
  | 'submissions.review'
  | 'moderation.read'
  | 'audit.read'
  | 'spam.read'
  | 'spam.manage'
  | 'notifications.write';

export type Role = {
  id: EntityId;
  slug: AdminRoleSlug;
  name: string;
  description: string;
  priority: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type Permission = {
  id: EntityId;
  slug: PermissionSlug;
  description: string;
  createdAt: ISODateTime;
};

export type Admin = {
  id: EntityId;
  authUserId?: EntityId;
  email?: string;
  displayName: string;
  isActive: boolean;
  roleSlugs: AdminRoleSlug[];
  permissionSlugs: PermissionSlug[];
  lastSeenAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ApprovedQuestion = Question & {
  sourceSubmissionId?: EntityId;
  locale: Locale;
  isActive: boolean;
  publishedAt: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ReviewQueueItem = {
  id: EntityId;
  submissionId: EntityId;
  priority: number;
  assignedTo?: EntityId;
  lockedBy?: EntityId;
  lockedUntil?: ISODateTime;
  queueReason: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ModerationResultEntity = ModerationResult & {
  id: EntityId;
  submissionId: EntityId;
  provider: 'local_rules' | 'openai' | 'manual' | 'import';
  model?: string;
  rawResponse?: unknown;
  createdAt: ISODateTime;
};

export type ContributorReputation = {
  contributorId: EntityId;
  reputationScore: number;
  trustLevel: number;
  acceptedCount: number;
  rejectedCount: number;
  spamCount: number;
  updatedAt: ISODateTime;
};

export type ReputationEvent = {
  id: EntityId;
  contributorId: EntityId;
  submissionId?: EntityId;
  delta: number;
  reason: string;
  createdAt: ISODateTime;
};

export type AntiSpamEvent = {
  id: EntityId;
  eventType: 'rate_limit' | 'duplicate' | 'toxic_content' | 'invalid_payload' | 'blocked_identity' | 'manual_flag';
  contributorId?: EntityId;
  submissionId?: EntityId;
  ipHash?: string;
  userAgentHash?: string;
  emailHash?: string;
  severity: number;
  details: Record<string, unknown>;
  createdAt: ISODateTime;
};

export type Notification = {
  id: EntityId;
  userId?: EntityId;
  adminUserId?: EntityId;
  locale: Locale;
  channel: 'in_app' | 'email' | 'webhook';
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  readAt?: ISODateTime;
  createdAt: ISODateTime;
};

export type LeaderboardEntry = {
  id: EntityId;
  /** Unique public nickname (case-insensitive uniqueness). */
  nickname: string;
  /** Optional display name fallback shown when moderation hides a nickname. */
  displayName?: string;
  /** Supabase auth user id when the score was submitted by a logged-in user. */
  authUserId?: EntityId;
  bestPrize: number;
  bestCorrectCount: number;
  gamesCount: number;
  /** Set by admins when a nickname is moderated; hidden from the public board. */
  isHidden?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type QuestionSubmission = CommunitySubmission;
export type AuditLog = AuditLogEntry;

export type UserSubscription = {
  id: EntityId;
  userId: EntityId;
  provider: 'stripe' | 'lemon_squeezy' | 'apple_pay' | 'google_pay';
  providerSubscriptionId: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'unpaid';
  endsAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type UserEntitlement = {
  id: EntityId;
  userId: EntityId;
  type: string;
  source: 'subscription' | 'one_time' | 'admin';
  status: 'active' | 'revoked';
  endsAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type PaymentTransaction = {
  id: EntityId;
  userId?: EntityId;
  provider: 'stripe' | 'lemon_squeezy' | 'apple_pay' | 'google_pay';
  providerOrderId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  details: Record<string, unknown>;
  createdAt: ISODateTime;
};

/**
 * A player's persisted progression (XP, level, achievements). `playerKey` is
 * the authenticated user id when signed in, or the anonymous device id — the
 * same identity model the leaderboard and multiplayer already use.
 */
export type PlayerProgression = {
  id: EntityId;
  playerKey: string;
  xp: number;
  level: number;
  gamesPlayed: number;
  unlockedAchievements: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};
