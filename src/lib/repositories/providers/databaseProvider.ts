import type { CommunitySubmission, ModerationResult } from '@/lib/community';
import { createAudit, submissionToQuestion } from '@/lib/community';
import { readEnv } from '@/lib/infrastructure/environment';
import type {
  Admin,
  AdminRoleSlug,
  AntiSpamEvent,
  ApprovedQuestion,
  AuditLog,
  ContributorReputation,
  EntityId,
  ModerationResultEntity,
  Notification,
  Permission,
  PermissionSlug,
  ReputationEvent,
  ReviewQueueItem,
  Role,
  User
} from '@/lib/domain/models';
import type {
  ApproveSubmissionDto,
  CreateAdminDto,
  CreateAuditLogDto,
  CreateNotificationDto,
  CreateSubmissionDto,
  CreateUserDto,
  RejectSubmissionDto,
  UpsertPermissionDto,
  UpsertRoleDto
} from '@/lib/domain/dtos';
import type { Locale, Question, QuestionTranslation } from '@/lib/types';
import type { ListOptions, QuestionFilters, RepositoryProvider, SubmissionFilters } from '../interfaces';

type JsonRecord = Record<string, unknown>;

type SupabaseRow = JsonRecord & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

type SupabaseClientConfig = {
  url: string;
  serviceRoleKey: string;
};

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomUUID()}`;

function getSupabaseConfig(): SupabaseClientConfig {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase database provider requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url: url.replace(/\/$/, ''), serviceRoleKey };
}

class SupabaseRestClient {
  constructor(private readonly config: SupabaseClientConfig) {}

  private endpoint(table: string, query?: string) {
    return `${this.config.url}/rest/v1/${table}${query ? `?${query}` : ''}`;
  }

  private headers(extra?: HeadersInit): HeadersInit {
    return {
      apikey: this.config.serviceRoleKey,
      Authorization: `Bearer ${this.config.serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...extra
    };
  }

  private async request<T>(table: string, init: RequestInit, query?: string): Promise<T> {
    const response = await fetch(this.endpoint(table, query), {
      ...init,
      headers: this.headers(init.headers),
      cache: 'no-store'
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Supabase ${table} request failed: ${response.status} ${message}`);
    }

    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  list<T extends SupabaseRow>(table: string, query = 'select=*') {
    return this.request<T[]>(table, { method: 'GET' }, query);
  }

  insert<T extends SupabaseRow>(table: string, payload: JsonRecord) {
    return this.request<T[]>(table, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { Prefer: 'return=representation' }
    }, 'select=*').then(rows => rows[0]);
  }

  update<T extends SupabaseRow>(table: string, query: string, payload: JsonRecord) {
    return this.request<T[]>(table, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      headers: { Prefer: 'return=representation' }
    }, `${query}&select=*`).then(rows => rows[0]);
  }

  remove(table: string, query: string) {
    return this.request<void>(table, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    }, query);
  }
}

function encode(value: string | number | boolean) {
  return encodeURIComponent(String(value));
}

function eq(column: string, value: string | number | boolean) {
  return `${column}=eq.${encode(value)}`;
}

function limitQuery(options?: ListOptions) {
  return options?.limit ? `&limit=${Math.max(1, options.limit)}` : '';
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function boolValue(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === 'number' ? value : fallback;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mapUser(row: SupabaseRow): User {
  return {
    id: stringValue(row.id),
    authUserId: stringValue(row.auth_user_id) || undefined,
    emailHash: stringValue(row.email_hash) || undefined,
    displayName: stringValue(row.display_name),
    locale: stringValue(row.locale, 'he') as Locale,
    isActive: boolValue(row.is_active, true),
    lastSeenAt: stringValue(row.last_seen_at) || undefined,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function userPayload(input: CreateUserDto | Partial<CreateUserDto & { isActive: boolean }>) {
  return {
    auth_user_id: input.authUserId,
    email_hash: input.emailHash,
    display_name: input.displayName,
    locale: input.locale,
    is_active: 'isActive' in input ? input.isActive : undefined,
    updated_at: now()
  };
}

function mapAdmin(row: SupabaseRow): Admin {
  return {
    id: stringValue(row.id),
    authUserId: stringValue(row.auth_user_id) || undefined,
    email: stringValue(row.email) || undefined,
    displayName: stringValue(row.display_name),
    isActive: boolValue(row.is_active, true),
    roleSlugs: textArray(row.role_slugs) as AdminRoleSlug[],
    permissionSlugs: textArray(row.permission_slugs) as PermissionSlug[],
    lastSeenAt: stringValue(row.last_seen_at) || undefined,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function adminPayload(input: CreateAdminDto | Partial<Admin>) {
  return {
    auth_user_id: input.authUserId,
    email: input.email,
    display_name: input.displayName,
    role_slugs: input.roleSlugs,
    permission_slugs: 'permissionSlugs' in input ? input.permissionSlugs : undefined,
    is_active: 'isActive' in input ? input.isActive : undefined,
    updated_at: now()
  };
}

function mapRole(row: SupabaseRow): Role {
  return {
    id: stringValue(row.id),
    slug: stringValue(row.slug) as AdminRoleSlug,
    name: stringValue(row.name),
    description: stringValue(row.description),
    priority: numberValue(row.priority),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function mapPermission(row: SupabaseRow): Permission {
  return {
    id: stringValue(row.id),
    slug: stringValue(row.slug) as PermissionSlug,
    description: stringValue(row.description),
    createdAt: stringValue(row.created_at)
  };
}

function mapSubmission(row: SupabaseRow): CommunitySubmission {
  const question = row.question ? recordValue(row.question) as Question : undefined;
  return {
    id: stringValue(row.id),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    draft: recordValue(row.draft) as CommunitySubmission['draft'],
    moderation: recordValue(row.moderation) as CommunitySubmission['moderation'],
    question
  };
}

function submissionPayload(submission: CommunitySubmission) {
  return {
    id: submission.id,
    draft: submission.draft,
    moderation: submission.moderation,
    question: submission.question,
    created_at: submission.createdAt,
    updated_at: submission.updatedAt
  };
}

function mapApprovedQuestion(row: SupabaseRow): ApprovedQuestion {
  return {
    id: stringValue(row.id),
    sourceSubmissionId: stringValue(row.source_submission_id) || undefined,
    locale: stringValue(row.locale, 'he') as Locale,
    category: stringValue(row.category),
    difficulty: stringValue(row.difficulty),
    question: stringValue(row.question),
    options: textArray(row.options),
    correctIndex: numberValue(row.correct_index),
    correctAnswer: stringValue(row.correct_answer) || undefined,
    explanation: stringValue(row.explanation) || undefined,
    tags: textArray(row.tags),
    translations: recordValue(row.translations) as Partial<Record<Locale, QuestionTranslation>>,
    isActive: boolValue(row.is_active, true),
    publishedAt: stringValue(row.published_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function approvedQuestionPayload(question: ApprovedQuestion): JsonRecord {
  return {
    id: String(question.id),
    source_submission_id: question.sourceSubmissionId,
    locale: question.locale,
    category: question.category,
    difficulty: question.difficulty,
    question: question.question,
    options: question.options,
    correct_index: question.correctIndex,
    correct_answer: question.correctAnswer,
    explanation: question.explanation,
    tags: question.tags || [],
    translations: question.translations || {},
    is_active: question.isActive,
    published_at: question.publishedAt,
    created_at: question.createdAt,
    updated_at: question.updatedAt
  };
}

function partialApprovedQuestionPayload(question: Partial<ApprovedQuestion>): JsonRecord {
  return {
    source_submission_id: question.sourceSubmissionId,
    locale: question.locale,
    category: question.category,
    difficulty: question.difficulty,
    question: question.question,
    options: question.options,
    correct_index: question.correctIndex,
    correct_answer: question.correctAnswer,
    explanation: question.explanation,
    tags: question.tags,
    translations: question.translations,
    is_active: question.isActive,
    published_at: question.publishedAt,
    updated_at: now()
  };
}

function mapQueueItem(row: SupabaseRow): ReviewQueueItem {
  return {
    id: stringValue(row.id),
    submissionId: stringValue(row.submission_id),
    priority: numberValue(row.priority),
    assignedTo: stringValue(row.assigned_to) || undefined,
    lockedBy: stringValue(row.locked_by) || undefined,
    lockedUntil: stringValue(row.locked_until) || undefined,
    queueReason: stringValue(row.queue_reason),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function queuePayload(item: ReviewQueueItem): JsonRecord {
  return {
    id: item.id,
    submission_id: item.submissionId,
    priority: item.priority,
    assigned_to: item.assignedTo,
    locked_by: item.lockedBy,
    locked_until: item.lockedUntil,
    queue_reason: item.queueReason,
    created_at: item.createdAt,
    updated_at: item.updatedAt
  };
}

function mapModerationResult(row: SupabaseRow): ModerationResultEntity {
  return {
    id: stringValue(row.id),
    submissionId: stringValue(row.submission_id),
    status: stringValue(row.status) as ModerationResultEntity['status'],
    score: numberValue(row.score),
    recommendation: stringValue(row.recommendation),
    reasons: textArray(row.reasons),
    normalizedQuestion: stringValue(row.normalized_question),
    normalizedOptions: textArray(row.normalized_options),
    explanation: stringValue(row.explanation),
    duplicateQuestionId: stringValue(row.duplicate_question_id) || undefined,
    provider: stringValue(row.provider, 'manual') as ModerationResultEntity['provider'],
    model: stringValue(row.model) || undefined,
    rawResponse: row.raw_response,
    createdAt: stringValue(row.created_at)
  };
}

function moderationPayload(submissionId: EntityId, result: ModerationResult): JsonRecord {
  return {
    id: id('moderation'),
    submission_id: submissionId,
    status: result.status,
    score: result.score,
    recommendation: result.recommendation,
    reasons: result.reasons,
    normalized_question: result.normalizedQuestion,
    normalized_options: result.normalizedOptions,
    explanation: result.explanation,
    duplicate_question_id: result.duplicateQuestionId ? String(result.duplicateQuestionId) : undefined,
    provider: 'manual',
    created_at: now()
  };
}

function mapAuditLog(row: SupabaseRow): AuditLog {
  return {
    id: stringValue(row.id),
    createdAt: stringValue(row.created_at),
    actor: stringValue(row.actor_label),
    action: stringValue(row.action),
    target: stringValue(row.target_id) || stringValue(row.target_type),
    details: JSON.stringify(row.details || {})
  };
}

function mapReputation(row: SupabaseRow): ContributorReputation {
  return {
    contributorId: stringValue(row.contributor_id),
    reputationScore: numberValue(row.reputation_score),
    trustLevel: numberValue(row.trust_level),
    acceptedCount: numberValue(row.accepted_count),
    rejectedCount: numberValue(row.rejected_count),
    spamCount: numberValue(row.spam_count),
    updatedAt: stringValue(row.updated_at)
  };
}

function mapReputationEvent(row: SupabaseRow): ReputationEvent {
  return {
    id: stringValue(row.id),
    contributorId: stringValue(row.contributor_id),
    submissionId: stringValue(row.submission_id) || undefined,
    delta: numberValue(row.delta),
    reason: stringValue(row.reason),
    createdAt: stringValue(row.created_at)
  };
}

function mapAntiSpamEvent(row: SupabaseRow): AntiSpamEvent {
  return {
    id: stringValue(row.id),
    eventType: stringValue(row.event_type) as AntiSpamEvent['eventType'],
    contributorId: stringValue(row.contributor_id) || undefined,
    submissionId: stringValue(row.submission_id) || undefined,
    ipHash: stringValue(row.ip_hash) || undefined,
    userAgentHash: stringValue(row.user_agent_hash) || undefined,
    emailHash: stringValue(row.email_hash) || undefined,
    severity: numberValue(row.severity),
    details: recordValue(row.details),
    createdAt: stringValue(row.created_at)
  };
}

function mapNotification(row: SupabaseRow): Notification {
  return {
    id: stringValue(row.id),
    userId: stringValue(row.user_id) || undefined,
    adminUserId: stringValue(row.admin_user_id) || undefined,
    locale: stringValue(row.locale, 'he') as Locale,
    channel: stringValue(row.channel, 'in_app') as Notification['channel'],
    type: stringValue(row.type),
    title: stringValue(row.title),
    body: stringValue(row.body),
    metadata: recordValue(row.metadata),
    readAt: stringValue(row.read_at) || undefined,
    createdAt: stringValue(row.created_at)
  };
}

function toGameplayQuestion(question: ApprovedQuestion): Question {
  const {
    locale,
    isActive,
    publishedAt,
    createdAt,
    updatedAt,
    sourceSubmissionId,
    ...gameplayQuestion
  } = question;
  void locale;
  void isActive;
  void publishedAt;
  void createdAt;
  void updatedAt;
  void sourceSubmissionId;
  return gameplayQuestion;
}

export function createDatabaseRepositoryProvider(): RepositoryProvider {
  const client = new SupabaseRestClient(getSupabaseConfig());

  async function permissionsForRoles(roleSlugs: AdminRoleSlug[]) {
    if (roleSlugs.length === 0) return [];
    const query = `select=permission_slug&role_slug=in.(${roleSlugs.map(encode).join(',')})`;
    const rows = await client.list<SupabaseRow>('role_permissions', query);
    return Array.from(new Set(rows.map(row => stringValue(row.permission_slug) as PermissionSlug).filter(Boolean)));
  }

  async function listApprovedQuestions(filters?: QuestionFilters) {
    const query = [
      'select=*',
      filters?.activeOnly === false ? undefined : 'is_active=eq.true',
      filters?.category ? eq('category', filters.category) : undefined,
      filters?.difficulty ? eq('difficulty', filters.difficulty) : undefined,
      filters?.search ? `question=ilike.*${encode(filters.search)}*` : undefined,
      'order=created_at.desc'
    ].filter(Boolean).join('&') + limitQuery(filters);
    const rows = await client.list<SupabaseRow>('approved_questions', query);
    return rows.map(mapApprovedQuestion);
  }

  return {
    kind: 'database',
    users: {
      async list(options) {
        const rows = await client.list<SupabaseRow>('users', `select=*&order=created_at.desc${limitQuery(options)}`);
        return rows.map(mapUser);
      },
      async findById(userId) {
        const rows = await client.list<SupabaseRow>('users', `select=*&${eq('id', userId)}&limit=1`);
        return rows[0] ? mapUser(rows[0]) : undefined;
      },
      async findByAuthUserId(authUserId) {
        const rows = await client.list<SupabaseRow>('users', `select=*&${eq('auth_user_id', authUserId)}&limit=1`);
        return rows[0] ? mapUser(rows[0]) : undefined;
      },
      async create(input) {
        const row = await client.insert<SupabaseRow>('users', { id: id('user'), created_at: now(), ...userPayload(input), is_active: true });
        return mapUser(row);
      },
      async update(userId, input) {
        const row = await client.update<SupabaseRow>('users', eq('id', userId), userPayload(input));
        return row ? mapUser(row) : undefined;
      }
    },
    admins: {
      async list(options) {
        const rows = await client.list<SupabaseRow>('admins', `select=*&order=created_at.desc${limitQuery(options)}`);
        return rows.map(mapAdmin);
      },
      async findById(adminId) {
        const rows = await client.list<SupabaseRow>('admins', `select=*&${eq('id', adminId)}&limit=1`);
        return rows[0] ? mapAdmin(rows[0]) : undefined;
      },
      async findByEmail(email) {
        const rows = await client.list<SupabaseRow>('admins', `select=*&${eq('email', email.toLowerCase())}&limit=1`);
        return rows[0] ? mapAdmin(rows[0]) : undefined;
      },
      async create(input: CreateAdminDto) {
        const permissionSlugs = await permissionsForRoles(input.roleSlugs);
        const row = await client.insert<SupabaseRow>('admins', {
          id: id('admin'),
          created_at: now(),
          ...adminPayload({ ...input, email: input.email?.toLowerCase(), permissionSlugs }),
          is_active: true
        });
        return mapAdmin(row);
      },
      async setRoles(adminId, roles) {
        const permissionSlugs = await permissionsForRoles(roles);
        const row = await client.update<SupabaseRow>('admins', eq('id', adminId), adminPayload({ roleSlugs: roles, permissionSlugs }));
        return row ? mapAdmin(row) : undefined;
      }
    },
    roles: {
      async list() {
        const rows = await client.list<SupabaseRow>('roles', 'select=*&order=priority.asc');
        return rows.map(mapRole);
      },
      async findBySlug(slug) {
        const rows = await client.list<SupabaseRow>('roles', `select=*&${eq('slug', slug)}&limit=1`);
        return rows[0] ? mapRole(rows[0]) : undefined;
      },
      async upsert(input: UpsertRoleDto) {
        const existing = await this.findBySlug(input.slug);
        if (existing) {
          const row = await client.update<SupabaseRow>('roles', eq('slug', input.slug), { ...input, updated_at: now() });
          return mapRole(row);
        }
        const row = await client.insert<SupabaseRow>('roles', { id: id('role'), ...input, created_at: now(), updated_at: now() });
        return mapRole(row);
      }
    },
    permissions: {
      async list() {
        const rows = await client.list<SupabaseRow>('permissions', 'select=*&order=slug.asc');
        return rows.map(mapPermission);
      },
      async findBySlug(slug) {
        const rows = await client.list<SupabaseRow>('permissions', `select=*&${eq('slug', slug)}&limit=1`);
        return rows[0] ? mapPermission(rows[0]) : undefined;
      },
      async upsert(input: UpsertPermissionDto) {
        const existing = await this.findBySlug(input.slug);
        if (existing) {
          const row = await client.update<SupabaseRow>('permissions', eq('slug', input.slug), { description: input.description });
          return mapPermission(row);
        }
        const row = await client.insert<SupabaseRow>('permissions', { id: id('permission'), ...input, created_at: now() });
        return mapPermission(row);
      },
      async grantToRole(roleSlug, permissionSlug) {
        const rows = await client.list<SupabaseRow>('role_permissions', `select=*&${eq('role_slug', roleSlug)}&${eq('permission_slug', permissionSlug)}&limit=1`);
        if (!rows[0]) {
          await client.insert<SupabaseRow>('role_permissions', { role_slug: roleSlug, permission_slug: permissionSlug, created_at: now() });
        }
      },
      async listForRole(roleSlug) {
        const rows = await client.list<SupabaseRow>('role_permissions', `select=permission_slug&${eq('role_slug', roleSlug)}`);
        const slugs = rows.map(row => stringValue(row.permission_slug)).filter(Boolean);
        if (!slugs.length) return [];
        const permissions = await client.list<SupabaseRow>('permissions', `select=*&slug=in.(${slugs.map(encode).join(',')})`);
        return permissions.map(mapPermission);
      }
    },
    submissions: {
      async list(filters?: SubmissionFilters) {
        const query = [
          'select=*',
          filters?.status ? `moderation->>status=eq.${encode(filters.status)}` : undefined,
          filters?.category ? `draft->>category=eq.${encode(filters.category)}` : undefined,
          filters?.search ? `draft->>question=ilike.*${encode(filters.search)}*` : undefined,
          'order=created_at.desc'
        ].filter(Boolean).join('&') + limitQuery(filters);
        const rows = await client.list<SupabaseRow>('question_submissions', query);
        return rows.map(mapSubmission);
      },
      async findById(submissionId) {
        const rows = await client.list<SupabaseRow>('question_submissions', `select=*&${eq('id', submissionId)}&limit=1`);
        return rows[0] ? mapSubmission(rows[0]) : undefined;
      },
      async create(input: CreateSubmissionDto) {
        const date = now();
        let submission: CommunitySubmission = {
          id: id('submission'),
          createdAt: date,
          updatedAt: date,
          draft: input.draft,
          moderation: input.moderation
        };
        if (input.moderation.status === 'auto_approved') {
          submission = { ...submission, question: submissionToQuestion(submission) };
        }
        const row = await client.insert<SupabaseRow>('question_submissions', submissionPayload(submission));
        if (submission.moderation.status === 'needs_review') {
          await client.insert<SupabaseRow>('review_queue', queuePayload({
            id: id('queue'),
            submissionId: submission.id,
            priority: Math.max(1, 100 - submission.moderation.score),
            queueReason: submission.moderation.reasons.join(' | '),
            createdAt: date,
            updatedAt: date
          }));
        }
        return mapSubmission(row);
      },
      async approve(input: ApproveSubmissionDto) {
        const submission = await this.findById(input.submissionId);
        if (!submission) return undefined;
        const question = submission.question || submissionToQuestion(submission);
        const updatedModeration = { ...submission.moderation, status: 'approved' as const, recommendation: input.note || 'Approved by admin.' };
        const updated = await client.update<SupabaseRow>('question_submissions', eq('id', input.submissionId), {
          moderation: updatedModeration,
          question,
          updated_at: now()
        });
        await client.insert<SupabaseRow>('approved_questions', approvedQuestionPayload({
          ...question,
          id: String(question.id),
          sourceSubmissionId: submission.id,
          locale: submission.draft.language,
          isActive: true,
          publishedAt: now(),
          createdAt: now(),
          updatedAt: now()
        }));
        await client.remove('review_queue', eq('submission_id', input.submissionId));
        return mapSubmission(updated);
      },
      async reject(input: RejectSubmissionDto) {
        const submission = await this.findById(input.submissionId);
        if (!submission) return undefined;
        const updated = await client.update<SupabaseRow>('question_submissions', eq('id', input.submissionId), {
          moderation: { ...submission.moderation, status: 'rejected' as const, recommendation: input.note || 'Rejected by admin.' },
          updated_at: now()
        });
        await client.remove('review_queue', eq('submission_id', input.submissionId));
        return mapSubmission(updated);
      }
    },
    approvedQuestions: {
      list: listApprovedQuestions,
      async listGameplayQuestions(filters) {
        return (await listApprovedQuestions({ ...filters, activeOnly: true })).map(toGameplayQuestion);
      },
      async findById(questionId) {
        const rows = await client.list<SupabaseRow>('approved_questions', `select=*&${eq('id', questionId)}&limit=1`);
        return rows[0] ? mapApprovedQuestion(rows[0]) : undefined;
      },
      async create(question) {
        const row = await client.insert<SupabaseRow>('approved_questions', approvedQuestionPayload(question));
        return mapApprovedQuestion(row);
      },
      async update(questionId, question) {
        const existing = await this.findById(questionId);
        if (!existing) return undefined;
        const row = await client.update<SupabaseRow>('approved_questions', eq('id', questionId), partialApprovedQuestionPayload(question));
        return row ? mapApprovedQuestion(row) : undefined;
      },
      async archive(questionId) {
        await client.update<SupabaseRow>('approved_questions', eq('id', questionId), { is_active: false, updated_at: now() });
      }
    },
    reviewQueue: {
      async list(options) {
        const rows = await client.list<SupabaseRow>('review_queue', `select=*&order=priority.asc${limitQuery(options)}`);
        return rows.map(mapQueueItem);
      },
      async enqueue(item) {
        const row = await client.insert<SupabaseRow>('review_queue', queuePayload(item));
        return mapQueueItem(row);
      },
      async removeBySubmissionId(submissionId) {
        await client.remove('review_queue', eq('submission_id', submissionId));
      },
      async assign(itemId, adminId) {
        const row = await client.update<SupabaseRow>('review_queue', eq('id', itemId), { assigned_to: adminId, updated_at: now() });
        return row ? mapQueueItem(row) : undefined;
      }
    },
    moderationResults: {
      async listBySubmission(submissionId) {
        const rows = await client.list<SupabaseRow>('moderation_results', `select=*&${eq('submission_id', submissionId)}&order=created_at.desc`);
        return rows.map(mapModerationResult);
      },
      async create(submissionId, result) {
        const row = await client.insert<SupabaseRow>('moderation_results', moderationPayload(submissionId, result));
        return mapModerationResult(row);
      }
    },
    auditLogs: {
      async list(options) {
        const rows = await client.list<SupabaseRow>('audit_logs', `select=*&order=created_at.desc${limitQuery(options)}`);
        return rows.map(mapAuditLog);
      },
      async create(input: CreateAuditLogDto) {
        const audit = createAudit(input.action, input.targetId || input.targetType, JSON.stringify(input.details), input.actorLabel);
        const row = await client.insert<SupabaseRow>('audit_logs', {
          id: audit.id,
          created_at: audit.createdAt,
          actor_admin_user_id: input.actorAdminUserId,
          actor_label: input.actorLabel,
          action: input.action,
          target_type: input.targetType,
          target_id: input.targetId,
          details: input.details
        });
        return mapAuditLog(row);
      }
    },
    reputation: {
      async getContributorReputation(contributorId) {
        const rows = await client.list<SupabaseRow>('contributor_reputation', `select=*&${eq('contributor_id', contributorId)}&limit=1`);
        return rows[0] ? mapReputation(rows[0]) : undefined;
      },
      async addEvent(event) {
        const row = await client.insert<SupabaseRow>('reputation_events', {
          id: id('reputation'),
          contributor_id: event.contributorId,
          submission_id: event.submissionId,
          delta: event.delta,
          reason: event.reason,
          created_at: now()
        });
        return mapReputationEvent(row);
      },
      async recalculate(contributorId) {
        const rows = await client.list<SupabaseRow>('reputation_events', `select=*&${eq('contributor_id', contributorId)}`);
        const events = rows.map(mapReputationEvent);
        const score = events.reduce((sum, event) => sum + event.delta, 0);
        const payload = {
          contributor_id: contributorId,
          reputation_score: score,
          trust_level: Math.max(0, Math.floor(score / 10)),
          accepted_count: events.filter(event => event.delta > 0).length,
          rejected_count: events.filter(event => event.delta < 0).length,
          spam_count: 0,
          updated_at: now()
        };
        const existing = await this.getContributorReputation(contributorId);
        const row = existing
          ? await client.update<SupabaseRow>('contributor_reputation', eq('contributor_id', contributorId), payload)
          : await client.insert<SupabaseRow>('contributor_reputation', payload);
        return mapReputation(row);
      }
    },
    antiSpamEvents: {
      async list(options) {
        const rows = await client.list<SupabaseRow>('anti_spam_events', `select=*&order=created_at.desc${limitQuery(options)}`);
        return rows.map(mapAntiSpamEvent);
      },
      async create(event) {
        const row = await client.insert<SupabaseRow>('anti_spam_events', {
          id: id('spam'),
          event_type: event.eventType,
          contributor_id: event.contributorId,
          submission_id: event.submissionId,
          ip_hash: event.ipHash,
          user_agent_hash: event.userAgentHash,
          email_hash: event.emailHash,
          severity: event.severity,
          details: event.details,
          created_at: now()
        });
        return mapAntiSpamEvent(row);
      },
      async listRecentByIdentity(identity, options) {
        const filters = [
          identity.emailHash ? eq('email_hash', identity.emailHash) : undefined,
          identity.ipHash ? eq('ip_hash', identity.ipHash) : undefined
        ].filter(Boolean);
        if (!filters.length) return [];
        const rows = await client.list<SupabaseRow>('anti_spam_events', `select=*&or=(${filters.join(',')})&order=created_at.desc${limitQuery(options)}`);
        return rows.map(mapAntiSpamEvent);
      }
    },
    notifications: {
      async listForUser(userId, options) {
        const rows = await client.list<SupabaseRow>('notifications', `select=*&${eq('user_id', userId)}&order=created_at.desc${limitQuery(options)}`);
        return rows.map(mapNotification);
      },
      async listForAdmin(adminId, options) {
        const rows = await client.list<SupabaseRow>('notifications', `select=*&${eq('admin_user_id', adminId)}&order=created_at.desc${limitQuery(options)}`);
        return rows.map(mapNotification);
      },
      async create(input: CreateNotificationDto) {
        const row = await client.insert<SupabaseRow>('notifications', {
          id: id('notification'),
          user_id: input.userId,
          admin_user_id: input.adminUserId,
          locale: input.locale,
          channel: input.channel,
          type: input.type,
          title: input.title,
          body: input.body,
          metadata: input.metadata || {},
          created_at: now()
        });
        return mapNotification(row);
      },
      async markRead(notificationId) {
        const row = await client.update<SupabaseRow>('notifications', eq('id', notificationId), { read_at: now() });
        return row ? mapNotification(row) : undefined;
      }
    }
  };
}
