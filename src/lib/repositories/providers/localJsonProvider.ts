import data from '@/data/questions.json';
import type { CommunitySubmission } from '@/lib/community';
import { createAudit, submissionToQuestion } from '@/lib/community';
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
import type { Question } from '@/lib/types';
import type { RepositoryProvider } from '../interfaces';

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const roleSeeds: Role[] = [
  { id: 'role-super-admin', slug: 'super_admin', name: 'Super Admin', description: 'Full platform access.', priority: 1, createdAt: now(), updatedAt: now() },
  { id: 'role-admin', slug: 'admin', name: 'Admin', description: 'Manage content and submissions.', priority: 10, createdAt: now(), updatedAt: now() },
  { id: 'role-moderator', slug: 'moderator', name: 'Moderator', description: 'Review community submissions.', priority: 30, createdAt: now(), updatedAt: now() }
];

const permissionSeeds: Permission[] = [
  'admin.users.manage',
  'admin.roles.manage',
  'questions.read',
  'questions.write',
  'submissions.read',
  'submissions.review',
  'moderation.read',
  'audit.read',
  'spam.read',
  'spam.manage',
  'notifications.write'
].map(slug => ({ id: `permission-${slug}`, slug: slug as PermissionSlug, description: slug, createdAt: now() }));

type LocalState = {
  users: User[];
  admins: Admin[];
  roles: Role[];
  permissions: Permission[];
  rolePermissions: Record<AdminRoleSlug, PermissionSlug[]>;
  submissions: CommunitySubmission[];
  approvedQuestions: ApprovedQuestion[];
  reviewQueue: ReviewQueueItem[];
  moderationResults: ModerationResultEntity[];
  auditLogs: AuditLog[];
  reputation: ContributorReputation[];
  reputationEvents: ReputationEvent[];
  antiSpamEvents: AntiSpamEvent[];
  notifications: Notification[];
};

function toApprovedQuestion(question: Question): ApprovedQuestion {
  const date = '2026-07-04T00:00:00.000Z';
  return {
    ...question,
    locale: 'he',
    isActive: true,
    publishedAt: date,
    createdAt: date,
    updatedAt: date
  };
}

function createInitialState(): LocalState {
  return {
    users: [],
    admins: [],
    roles: roleSeeds,
    permissions: permissionSeeds,
    rolePermissions: {
      super_admin: permissionSeeds.map(permission => permission.slug),
      admin: ['questions.read', 'questions.write', 'submissions.read', 'submissions.review', 'moderation.read', 'audit.read', 'spam.read'],
      moderator: ['questions.read', 'submissions.read', 'submissions.review', 'moderation.read']
    },
    submissions: [],
    approvedQuestions: (data.questions as Question[]).map(toApprovedQuestion),
    reviewQueue: [],
    moderationResults: [],
    auditLogs: [],
    reputation: [],
    reputationEvents: [],
    antiSpamEvents: [],
    notifications: []
  };
}

const localState = createInitialState();

function limit<T>(items: T[], size = 500) {
  return items.slice(0, size);
}

function findById<T extends { id: string | number }>(items: T[], itemId: string | number) {
  return items.find(item => String(item.id) === String(itemId));
}

export function createLocalJsonRepositoryProvider(state = localState): RepositoryProvider {
  const listApprovedQuestions = async (filters?: {
    limit?: number;
    category?: string;
    difficulty?: string;
    activeOnly?: boolean;
    search?: string;
  }) => limit(state.approvedQuestions.filter(question => {
    const active = filters?.activeOnly === false || question.isActive;
    const category = !filters?.category || question.category === filters.category;
    const difficulty = !filters?.difficulty || question.difficulty === filters.difficulty;
    const search = !filters?.search || question.question.toLowerCase().includes(filters.search.toLowerCase());
    return active && category && difficulty && search;
  }), filters?.limit);

  return {
    kind: 'local-json',

    users: {
      async list(options) {
        return limit(state.users, options?.limit);
      },
      async findById(userId) {
        return findById(state.users, userId);
      },
      async findByAuthUserId(authUserId) {
        return state.users.find(user => user.authUserId === authUserId);
      },
      async create(input: CreateUserDto) {
        const date = now();
        const user: User = { id: id('user'), isActive: true, createdAt: date, updatedAt: date, ...input };
        state.users = [user, ...state.users];
        return user;
      },
      async update(userId, input) {
        let updated: User | undefined;
        state.users = state.users.map(user => {
          if (user.id !== userId) return user;
          updated = { ...user, ...input, updatedAt: now() };
          return updated;
        });
        return updated;
      }
    },

    admins: {
      async list(options) {
        return limit(state.admins, options?.limit);
      },
      async findById(adminId) {
        return findById(state.admins, adminId);
      },
      async findByEmail(email) {
        return state.admins.find(admin => admin.email?.toLowerCase() === email.toLowerCase());
      },
      async create(input: CreateAdminDto) {
        const date = now();
        const permissionSlugs = Array.from(new Set(input.roleSlugs.flatMap(role => state.rolePermissions[role] || [])));
        const admin: Admin = { id: id('admin'), isActive: true, permissionSlugs, createdAt: date, updatedAt: date, ...input };
        state.admins = [admin, ...state.admins];
        return admin;
      },
      async setRoles(adminId, roles) {
        let updated: Admin | undefined;
        state.admins = state.admins.map(admin => {
          if (admin.id !== adminId) return admin;
          updated = {
            ...admin,
            roleSlugs: roles,
            permissionSlugs: Array.from(new Set(roles.flatMap(role => state.rolePermissions[role] || []))),
            updatedAt: now()
          };
          return updated;
        });
        return updated;
      }
    },

    roles: {
      async list() {
        return state.roles;
      },
      async findBySlug(slug) {
        return state.roles.find(role => role.slug === slug);
      },
      async upsert(input: UpsertRoleDto) {
        const existing = state.roles.find(role => role.slug === input.slug);
        if (existing) {
          const updated = { ...existing, ...input, updatedAt: now() };
          state.roles = state.roles.map(role => role.slug === input.slug ? updated : role);
          return updated;
        }
        const date = now();
        const role: Role = { id: id('role'), createdAt: date, updatedAt: date, ...input };
        state.roles = [role, ...state.roles];
        return role;
      }
    },

    permissions: {
      async list() {
        return state.permissions;
      },
      async findBySlug(slug) {
        return state.permissions.find(permission => permission.slug === slug);
      },
      async upsert(input: UpsertPermissionDto) {
        const existing = state.permissions.find(permission => permission.slug === input.slug);
        if (existing) {
          const updated = { ...existing, ...input };
          state.permissions = state.permissions.map(permission => permission.slug === input.slug ? updated : permission);
          return updated;
        }
        const permission: Permission = { id: id('permission'), createdAt: now(), ...input };
        state.permissions = [permission, ...state.permissions];
        return permission;
      },
      async grantToRole(roleSlug, permissionSlug) {
        state.rolePermissions[roleSlug] = Array.from(new Set([...(state.rolePermissions[roleSlug] || []), permissionSlug]));
      },
      async listForRole(roleSlug) {
        const slugs = state.rolePermissions[roleSlug] || [];
        return state.permissions.filter(permission => slugs.includes(permission.slug));
      }
    },

    submissions: {
      async list(filters) {
        return limit(state.submissions.filter(submission => {
          const matchesStatus = !filters?.status || submission.moderation.status === filters.status;
          const matchesCategory = !filters?.category || submission.draft.category === filters.category;
          const matchesSearch = !filters?.search || submission.draft.question.toLowerCase().includes(filters.search.toLowerCase());
          return matchesStatus && matchesCategory && matchesSearch;
        }), filters?.limit);
      },
      async findById(submissionId) {
        return findById(state.submissions, submissionId);
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
        state.submissions = [submission, ...state.submissions];
        if (submission.moderation.status === 'needs_review') {
          state.reviewQueue = [{
            id: id('queue'),
            submissionId: submission.id,
            priority: Math.max(1, 100 - submission.moderation.score),
            queueReason: submission.moderation.reasons.join(' | '),
            createdAt: date,
            updatedAt: date
          }, ...state.reviewQueue];
        }
        return submission;
      },
      async approve(input: ApproveSubmissionDto) {
        let updated: CommunitySubmission | undefined;
        state.submissions = state.submissions.map(submission => {
          if (submission.id !== input.submissionId) return submission;
          const question = submission.question || submissionToQuestion(submission);
          updated = {
            ...submission,
            question,
            updatedAt: now(),
            moderation: { ...submission.moderation, status: 'approved', recommendation: input.note || 'Approved by admin.' }
          };
          state.approvedQuestions = [toApprovedQuestion(question), ...state.approvedQuestions];
          return updated;
        });
        state.reviewQueue = state.reviewQueue.filter(item => item.submissionId !== input.submissionId);
        return updated;
      },
      async reject(input: RejectSubmissionDto) {
        let updated: CommunitySubmission | undefined;
        state.submissions = state.submissions.map(submission => {
          if (submission.id !== input.submissionId) return submission;
          updated = {
            ...submission,
            updatedAt: now(),
            moderation: { ...submission.moderation, status: 'rejected', recommendation: input.note || 'Rejected by admin.' }
          };
          return updated;
        });
        state.reviewQueue = state.reviewQueue.filter(item => item.submissionId !== input.submissionId);
        return updated;
      }
    },

    approvedQuestions: {
      async list(filters) {
        return listApprovedQuestions(filters);
      },
      async listGameplayQuestions(filters) {
        return (await listApprovedQuestions({ ...filters, activeOnly: true })).map(({ locale, isActive, publishedAt, createdAt, updatedAt, sourceSubmissionId, ...question }) => question);
      },
      async findById(questionId) {
        return findById(state.approvedQuestions, questionId);
      },
      async create(question) {
        state.approvedQuestions = [question, ...state.approvedQuestions];
        return question;
      },
      async update(questionId, input) {
        let updated: ApprovedQuestion | undefined;
        state.approvedQuestions = state.approvedQuestions.map(question => {
          if (String(question.id) !== String(questionId)) return question;
          updated = { ...question, ...input, updatedAt: now() };
          return updated;
        });
        return updated;
      },
      async archive(questionId) {
        state.approvedQuestions = state.approvedQuestions.map(question => String(question.id) === String(questionId)
          ? { ...question, isActive: false, updatedAt: now() }
          : question
        );
      }
    },

    reviewQueue: {
      async list(options) {
        return limit([...state.reviewQueue].sort((a, b) => a.priority - b.priority), options?.limit);
      },
      async enqueue(item) {
        state.reviewQueue = [item, ...state.reviewQueue];
        return item;
      },
      async removeBySubmissionId(submissionId) {
        state.reviewQueue = state.reviewQueue.filter(item => item.submissionId !== submissionId);
      },
      async assign(itemId, adminId) {
        let updated: ReviewQueueItem | undefined;
        state.reviewQueue = state.reviewQueue.map(item => {
          if (item.id !== itemId) return item;
          updated = { ...item, assignedTo: adminId, updatedAt: now() };
          return updated;
        });
        return updated;
      }
    },

    moderationResults: {
      async listBySubmission(submissionId) {
        return state.moderationResults.filter(result => result.submissionId === submissionId);
      },
      async create(submissionId, result) {
        const record: ModerationResultEntity = { ...result, id: id('moderation'), submissionId, provider: 'local_rules', createdAt: now() };
        state.moderationResults = [record, ...state.moderationResults];
        return record;
      }
    },

    auditLogs: {
      async list(options) {
        return limit(state.auditLogs, options?.limit);
      },
      async create(input: CreateAuditLogDto) {
        const entry = createAudit(input.action, input.targetId || input.targetType, JSON.stringify(input.details), input.actorLabel);
        state.auditLogs = [entry, ...state.auditLogs];
        return entry;
      }
    },

    reputation: {
      async getContributorReputation(contributorId) {
        return state.reputation.find(item => item.contributorId === contributorId);
      },
      async addEvent(event) {
        const record: ReputationEvent = { ...event, id: id('reputation'), createdAt: now() };
        state.reputationEvents = [record, ...state.reputationEvents];
        return record;
      },
      async recalculate(contributorId) {
        const events = state.reputationEvents.filter(event => event.contributorId === contributorId);
        const score = events.reduce((sum, event) => sum + event.delta, 0);
        const record: ContributorReputation = {
          contributorId,
          reputationScore: score,
          trustLevel: Math.max(0, Math.floor(score / 10)),
          acceptedCount: events.filter(event => event.delta > 0).length,
          rejectedCount: events.filter(event => event.delta < 0).length,
          spamCount: 0,
          updatedAt: now()
        };
        state.reputation = [record, ...state.reputation.filter(item => item.contributorId !== contributorId)];
        return record;
      }
    },

    antiSpamEvents: {
      async list(options) {
        return limit(state.antiSpamEvents, options?.limit);
      },
      async create(event) {
        const record: AntiSpamEvent = { ...event, id: id('spam'), createdAt: now() };
        state.antiSpamEvents = [record, ...state.antiSpamEvents];
        return record;
      },
      async listRecentByIdentity(identity, options) {
        return limit(state.antiSpamEvents.filter(event =>
          Boolean(identity.emailHash && event.emailHash === identity.emailHash) ||
          Boolean(identity.ipHash && event.ipHash === identity.ipHash)
        ), options?.limit);
      }
    },

    notifications: {
      async listForUser(userId, options) {
        return limit(state.notifications.filter(notification => notification.userId === userId), options?.limit);
      },
      async listForAdmin(adminId, options) {
        return limit(state.notifications.filter(notification => notification.adminUserId === adminId), options?.limit);
      },
      async create(input: CreateNotificationDto) {
        const notification: Notification = { id: id('notification'), metadata: {}, createdAt: now(), ...input };
        state.notifications = [notification, ...state.notifications];
        return notification;
      },
      async markRead(notificationId) {
        let updated: Notification | undefined;
        state.notifications = state.notifications.map(notification => {
          if (notification.id !== notificationId) return notification;
          updated = { ...notification, readAt: now() };
          return updated;
        });
        return updated;
      }
    }
  };
}
