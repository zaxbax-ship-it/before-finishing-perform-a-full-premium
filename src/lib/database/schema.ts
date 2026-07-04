import type { Locale, Question } from '@/lib/types';
import type { AuditLogEntry, CommunitySubmission, ModerationResult, SubmissionStatus } from '@/lib/community';

export type DatabaseMode = 'local' | 'supabase';

export type AdminRoleSlug = 'super_admin' | 'admin' | 'moderator';

export type AdminPermissionSlug =
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

export type AdminUserRecord = {
  id: string;
  authUserId?: string;
  email?: string;
  displayName: string;
  isActive: boolean;
  roles: AdminRoleSlug[];
  permissions: AdminPermissionSlug[];
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ContributorRecord = {
  id: string;
  emailHash?: string;
  displayName: string;
  preferredLocale: Locale;
  reputationScore: number;
  trustLevel: number;
  acceptedCount: number;
  rejectedCount: number;
  spamCount: number;
  lastSubmissionAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewQueueItemRecord = {
  id: string;
  submissionId: string;
  priority: number;
  assignedTo?: string;
  lockedBy?: string;
  lockedUntil?: string;
  queueReason: string;
  createdAt: string;
  updatedAt: string;
};

export type ApprovedQuestionRecord = Question & {
  sourceSubmissionId?: string;
  locale: Locale;
  isActive: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ModerationResultRecord = ModerationResult & {
  id: string;
  submissionId: string;
  provider: 'local_rules' | 'openai' | 'manual' | 'import';
  model?: string;
  rawResponse?: unknown;
  createdAt: string;
};

export type AntiSpamEventRecord = {
  id: string;
  eventType: 'rate_limit' | 'duplicate' | 'toxic_content' | 'invalid_payload' | 'blocked_identity' | 'manual_flag';
  contributorId?: string;
  submissionId?: string;
  ipHash?: string;
  userAgentHash?: string;
  emailHash?: string;
  severity: number;
  details: Record<string, unknown>;
  createdAt: string;
};

export type CommunityRepositorySnapshot = {
  submissions: CommunitySubmission[];
  approvedQuestions: ApprovedQuestionRecord[];
  reviewQueue: ReviewQueueItemRecord[];
  auditLogs: AuditLogEntry[];
  contributors: ContributorRecord[];
  antiSpamEvents: AntiSpamEventRecord[];
};

export type SubmitQuestionResult = {
  submission: CommunitySubmission;
  approvedQuestion?: ApprovedQuestionRecord;
  queueItem?: ReviewQueueItemRecord;
};

export type ReviewDecision = {
  submissionId: string;
  status: Extract<SubmissionStatus, 'approved' | 'auto_approved' | 'rejected'>;
  adminUserId?: string;
  note?: string;
};

export type CommunityRepository = {
  mode: DatabaseMode;
  getSnapshot(): Promise<CommunityRepositorySnapshot>;
  createSubmission(submission: CommunitySubmission): Promise<SubmitQuestionResult>;
  approveSubmission(decision: ReviewDecision): Promise<ApprovedQuestionRecord | undefined>;
  rejectSubmission(decision: ReviewDecision): Promise<CommunitySubmission | undefined>;
  writeAuditLog(entry: AuditLogEntry): Promise<void>;
  recordModerationResult(submissionId: string, result: ModerationResult): Promise<ModerationResultRecord>;
  recordAntiSpamEvent(event: Omit<AntiSpamEventRecord, 'id' | 'createdAt'>): Promise<AntiSpamEventRecord>;
};
