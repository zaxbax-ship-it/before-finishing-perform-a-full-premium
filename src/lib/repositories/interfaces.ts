import type { CommunitySubmission, ModerationResult } from '@/lib/community';
import type { Question } from '@/lib/types';
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

export type ListOptions = {
  limit?: number;
  cursor?: string;
};

export type QuestionFilters = ListOptions & {
  category?: string;
  difficulty?: string;
  activeOnly?: boolean;
  search?: string;
};

export type SubmissionFilters = ListOptions & {
  status?: CommunitySubmission['moderation']['status'];
  category?: string;
  contributorId?: EntityId;
  search?: string;
};

export interface UsersRepository {
  list(options?: ListOptions): Promise<User[]>;
  findById(id: EntityId): Promise<User | undefined>;
  findByAuthUserId(authUserId: EntityId): Promise<User | undefined>;
  create(input: CreateUserDto): Promise<User>;
  update(id: EntityId, input: Partial<CreateUserDto & { isActive: boolean }>): Promise<User | undefined>;
}

export interface AdminsRepository {
  list(options?: ListOptions): Promise<Admin[]>;
  findById(id: EntityId): Promise<Admin | undefined>;
  findByEmail(email: string): Promise<Admin | undefined>;
  create(input: CreateAdminDto): Promise<Admin>;
  setRoles(adminId: EntityId, roles: AdminRoleSlug[]): Promise<Admin | undefined>;
}

export interface RolesRepository {
  list(): Promise<Role[]>;
  findBySlug(slug: AdminRoleSlug): Promise<Role | undefined>;
  upsert(input: UpsertRoleDto): Promise<Role>;
}

export interface PermissionsRepository {
  list(): Promise<Permission[]>;
  findBySlug(slug: PermissionSlug): Promise<Permission | undefined>;
  upsert(input: UpsertPermissionDto): Promise<Permission>;
  grantToRole(roleSlug: AdminRoleSlug, permissionSlug: PermissionSlug): Promise<void>;
  listForRole(roleSlug: AdminRoleSlug): Promise<Permission[]>;
}

export interface QuestionSubmissionsRepository {
  list(filters?: SubmissionFilters): Promise<CommunitySubmission[]>;
  findById(id: EntityId): Promise<CommunitySubmission | undefined>;
  create(input: CreateSubmissionDto): Promise<CommunitySubmission>;
  approve(input: ApproveSubmissionDto): Promise<CommunitySubmission | undefined>;
  reject(input: RejectSubmissionDto): Promise<CommunitySubmission | undefined>;
}

export interface ApprovedQuestionsRepository {
  list(filters?: QuestionFilters): Promise<ApprovedQuestion[]>;
  listGameplayQuestions(filters?: QuestionFilters): Promise<Question[]>;
  findById(id: EntityId): Promise<ApprovedQuestion | undefined>;
  create(question: ApprovedQuestion): Promise<ApprovedQuestion>;
  update(id: EntityId, question: Partial<ApprovedQuestion>): Promise<ApprovedQuestion | undefined>;
  archive(id: EntityId): Promise<void>;
}

export interface ReviewQueueRepository {
  list(options?: ListOptions): Promise<ReviewQueueItem[]>;
  enqueue(item: ReviewQueueItem): Promise<ReviewQueueItem>;
  removeBySubmissionId(submissionId: EntityId): Promise<void>;
  assign(itemId: EntityId, adminId: EntityId): Promise<ReviewQueueItem | undefined>;
}

export interface ModerationResultsRepository {
  listBySubmission(submissionId: EntityId): Promise<ModerationResultEntity[]>;
  create(submissionId: EntityId, result: ModerationResult): Promise<ModerationResultEntity>;
}

export interface AuditLogsRepository {
  list(options?: ListOptions): Promise<AuditLog[]>;
  create(input: CreateAuditLogDto): Promise<AuditLog>;
}

export interface ReputationRepository {
  getContributorReputation(contributorId: EntityId): Promise<ContributorReputation | undefined>;
  addEvent(event: Omit<ReputationEvent, 'id' | 'createdAt'>): Promise<ReputationEvent>;
  recalculate(contributorId: EntityId): Promise<ContributorReputation>;
}

export interface AntiSpamEventsRepository {
  list(options?: ListOptions): Promise<AntiSpamEvent[]>;
  create(event: Omit<AntiSpamEvent, 'id' | 'createdAt'>): Promise<AntiSpamEvent>;
  listRecentByIdentity(identity: { emailHash?: string; ipHash?: string }, options?: ListOptions): Promise<AntiSpamEvent[]>;
}

export interface NotificationsRepository {
  listForUser(userId: EntityId, options?: ListOptions): Promise<Notification[]>;
  listForAdmin(adminId: EntityId, options?: ListOptions): Promise<Notification[]>;
  create(input: CreateNotificationDto): Promise<Notification>;
  markRead(id: EntityId): Promise<Notification | undefined>;
}

export type RepositoryProviderKind = 'local-json' | 'database';

export type RepositoryProvider = {
  kind: RepositoryProviderKind;
  users: UsersRepository;
  admins: AdminsRepository;
  roles: RolesRepository;
  permissions: PermissionsRepository;
  submissions: QuestionSubmissionsRepository;
  approvedQuestions: ApprovedQuestionsRepository;
  reviewQueue: ReviewQueueRepository;
  moderationResults: ModerationResultsRepository;
  auditLogs: AuditLogsRepository;
  reputation: ReputationRepository;
  antiSpamEvents: AntiSpamEventsRepository;
  notifications: NotificationsRepository;
};
