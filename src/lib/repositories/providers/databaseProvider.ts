import 'server-only';
import type { CommunitySubmission, ModerationResult } from '@/lib/community';
import { createAudit, submissionToQuestion } from '@/lib/community';
import { readEnv } from '@/lib/infrastructure/environment';
import type {
  Admin,
  AdminRoleSlug,
  AntiSpamEvent,
  ApprovedQuestion,
  AuditLog,
  ContactTicket,
  ContributorReputation,
  EntityId,
  ISODateTime,
  LeaderboardEntry,
  ModerationResultEntity,
  Notification,
  PaymentTransaction,
  Permission,
  PermissionSlug,
  PlayerProgression,
  ReputationEvent,
  ReviewQueueItem,
  Role,
  User,
  UserEntitlement,
  UserSubscription
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
import type {
  MultiplayerAnswer,
  MultiplayerGame,
  MultiplayerLifelineInventory,
  MultiplayerLifelineUse,
  MultiplayerLobby,
  MultiplayerPlayer,
  MultiplayerResult,
  MultiplayerRound
} from '@/lib/multiplayer/types';
import type { ListOptions, QuestionFilters, RepositoryProvider, SubmissionFilters, SubmitScoreInput } from '../interfaces';

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
let databaseLeaderboardFallback: LeaderboardEntry[] = [];

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

function logicEq(column: string, value: string | number | boolean) {
  return `${column}.eq.${encode(value)}`;
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

function multiplayerLifelinesValue(value: unknown): MultiplayerLifelineInventory {
  const record = recordValue(value);
  return {
    fifty_fifty: numberValue(record.fifty_fifty, 1),
    audience: numberValue(record.audience, 1),
    friend: numberValue(record.friend, 1)
  };
}

function multiplayerLifelineUsesValue(value: unknown): MultiplayerLifelineUse[] {
  return Array.isArray(value) ? value as MultiplayerLifelineUse[] : [];
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

function mapProgression(row: SupabaseRow): PlayerProgression {
  return {
    id: stringValue(row.id),
    playerKey: stringValue(row.player_key),
    xp: Number(row.xp) || 0,
    level: Number(row.level) || 1,
    gamesPlayed: Number(row.games_played) || 0,
    unlockedAchievements: Array.isArray(row.unlocked_achievements) ? (row.unlocked_achievements as string[]) : [],
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function mapSubscription(row: SupabaseRow): UserSubscription {
  return {
    id: stringValue(row.id),
    userId: stringValue(row.user_id),
    provider: stringValue(row.provider) as any,
    providerSubscriptionId: stringValue(row.provider_subscription_id),
    status: stringValue(row.status) as any,
    endsAt: stringValue(row.ends_at) || undefined,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function subscriptionPayload(input: Omit<UserSubscription, 'createdAt' | 'updatedAt'> & { createdAt?: ISODateTime; updatedAt?: ISODateTime }) {
  return {
    id: input.id,
    user_id: input.userId,
    provider: input.provider,
    provider_subscription_id: input.providerSubscriptionId,
    status: input.status,
    ends_at: input.endsAt,
    created_at: input.createdAt,
    updated_at: input.updatedAt
  };
}

function mapEntitlement(row: SupabaseRow): UserEntitlement {
  return {
    id: stringValue(row.id),
    userId: stringValue(row.user_id),
    type: stringValue(row.type),
    source: stringValue(row.source) as any,
    status: stringValue(row.status) as any,
    endsAt: stringValue(row.ends_at) || undefined,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function entitlementPayload(input: Omit<UserEntitlement, 'createdAt' | 'updatedAt'> & { createdAt?: ISODateTime; updatedAt?: ISODateTime }) {
  return {
    id: input.id,
    user_id: input.userId,
    type: input.type,
    source: input.source,
    status: input.status,
    ends_at: input.endsAt,
    created_at: input.createdAt,
    updated_at: input.updatedAt
  };
}

function mapTransaction(row: SupabaseRow): PaymentTransaction {
  return {
    id: stringValue(row.id),
    userId: stringValue(row.user_id) || undefined,
    provider: stringValue(row.provider) as any,
    providerOrderId: stringValue(row.provider_order_id) || undefined,
    amount: typeof row.amount === 'number' ? row.amount : Number(row.amount || 0),
    currency: stringValue(row.currency, 'USD'),
    status: stringValue(row.status) as any,
    details: (row.details as Record<string, unknown>) || {},
    createdAt: stringValue(row.created_at)
  };
}

function transactionPayload(input: Omit<PaymentTransaction, 'id' | 'createdAt'>) {
  return {
    user_id: input.userId,
    provider: input.provider,
    provider_order_id: input.providerOrderId,
    amount: input.amount,
    currency: input.currency,
    status: input.status,
    details: input.details
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
    status: (stringValue(row.status) || undefined) as ApprovedQuestion['status'],
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
    status: question.status,
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
    status: question.status,
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
    provider: result.aiProvider === 'openai' ? 'openai' : result.aiProvider === 'mock-local' ? 'local_rules' : 'manual',
    raw_response: {
      aiRecommendation: result.aiRecommendation,
      aiConfidence: result.aiConfidence,
      improvedQuestion: result.improvedQuestion,
      improvedOptions: result.improvedOptions,
      factCheck: result.factCheck,
      qualitySignals: result.qualitySignals
    },
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

function normalizeNickname(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 20);
}

function nicknameKey(value: string) {
  return normalizeNickname(value).toLocaleLowerCase('en-US');
}

function sortLeaderboard(entries: LeaderboardEntry[]) {
  return [...entries].sort((first, second) =>
    second.bestPrize - first.bestPrize ||
    second.bestCorrectCount - first.bestCorrectCount ||
    new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  );
}

function mapLeaderboardEntry(row: SupabaseRow): LeaderboardEntry {
  return {
    id: stringValue(row.id),
    nickname: stringValue(row.nickname),
    displayName: stringValue(row.display_name) || undefined,
    authUserId: stringValue(row.auth_user_id) || undefined,
    bestPrize: numberValue(row.best_prize),
    bestCorrectCount: numberValue(row.best_correct_count),
    gamesCount: numberValue(row.games_count),
    isHidden: boolValue(row.is_hidden),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function mapContactTicket(row: SupabaseRow): ContactTicket {
  const notes = Array.isArray(row.notes) ? row.notes as Array<Record<string, unknown>> : [];
  return {
    id: stringValue(row.id),
    status: stringValue(row.status, 'open') as ContactTicket['status'],
    priority: stringValue(row.priority, 'normal') as ContactTicket['priority'],
    assigneeEmail: stringValue(row.assignee_email) || undefined,
    requesterName: stringValue(row.requester_name),
    requesterEmail: stringValue(row.requester_email),
    subject: stringValue(row.subject),
    body: stringValue(row.body),
    notes: notes.map(note => ({
      id: String(note.id || ''),
      authorEmail: String(note.authorEmail || ''),
      body: String(note.body || ''),
      createdAt: String(note.createdAt || '')
    })),
    sourceNotificationId: stringValue(row.source_notification_id) || undefined,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function mapMultiplayerLobby(row: SupabaseRow): MultiplayerLobby {
  return {
    id: stringValue(row.id),
    status: stringValue(row.status, 'waiting') as MultiplayerLobby['status'],
    visibility: stringValue(row.visibility, 'public') as MultiplayerLobby['visibility'],
    maxPlayers: numberValue(row.max_players, 2) as MultiplayerLobby['maxPlayers'],
    locale: stringValue(row.locale, 'he') as Locale,
    category: stringValue(row.category) || undefined,
    hostPlayerId: stringValue(row.host_player_id) || undefined,
    gameId: stringValue(row.game_id) || undefined,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    expiresAt: stringValue(row.expires_at)
  };
}

function multiplayerLobbyPayload(lobby: Partial<MultiplayerLobby>): JsonRecord {
  return {
    id: lobby.id,
    status: lobby.status,
    visibility: lobby.visibility,
    max_players: lobby.maxPlayers,
    locale: lobby.locale,
    category: lobby.category,
    host_player_id: lobby.hostPlayerId,
    game_id: lobby.gameId,
    created_at: lobby.createdAt,
    updated_at: lobby.updatedAt,
    expires_at: lobby.expiresAt
  };
}

function mapMultiplayerPlayer(row: SupabaseRow): MultiplayerPlayer {
  return {
    id: stringValue(row.id),
    lobbyId: stringValue(row.lobby_id),
    gameId: stringValue(row.game_id) || undefined,
    authUserId: stringValue(row.auth_user_id) || undefined,
    anonymousId: stringValue(row.anonymous_id),
    nickname: stringValue(row.nickname),
    displayName: stringValue(row.display_name) || undefined,
    connectionTokenHash: stringValue(row.connection_token_hash),
    lifelines: multiplayerLifelinesValue(row.lifelines),
    lifelineUses: multiplayerLifelineUsesValue(row.lifeline_uses),
    spentPrize: numberValue(row.spent_prize),
    position: numberValue(row.position, 1),
    isConnected: boolValue(row.is_connected, true),
    joinedAt: stringValue(row.joined_at),
    lastSeenAt: stringValue(row.last_seen_at),
    disconnectedAt: stringValue(row.disconnected_at) || undefined
  };
}

function multiplayerPlayerPayload(player: Partial<MultiplayerPlayer>): JsonRecord {
  return {
    id: player.id,
    lobby_id: player.lobbyId,
    game_id: player.gameId,
    auth_user_id: player.authUserId,
    anonymous_id: player.anonymousId,
    nickname: player.nickname,
    display_name: player.displayName,
    connection_token_hash: player.connectionTokenHash,
    lifelines: player.lifelines,
    lifeline_uses: player.lifelineUses,
    spent_prize: player.spentPrize,
    position: player.position,
    is_connected: player.isConnected,
    joined_at: player.joinedAt,
    last_seen_at: player.lastSeenAt,
    disconnected_at: player.disconnectedAt
  };
}

function mapMultiplayerGame(row: SupabaseRow): MultiplayerGame {
  return {
    id: stringValue(row.id),
    lobbyId: stringValue(row.lobby_id),
    status: stringValue(row.status, 'waiting') as MultiplayerGame['status'],
    questionIds: textArray(row.question_ids),
    currentRoundIndex: numberValue(row.current_round_index),
    startedAt: stringValue(row.started_at) || undefined,
    finishedAt: stringValue(row.finished_at) || undefined,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function multiplayerGamePayload(game: Partial<MultiplayerGame>): JsonRecord {
  return {
    id: game.id,
    lobby_id: game.lobbyId,
    status: game.status,
    question_ids: game.questionIds,
    current_round_index: game.currentRoundIndex,
    started_at: game.startedAt,
    finished_at: game.finishedAt,
    created_at: game.createdAt,
    updated_at: game.updatedAt
  };
}

function mapMultiplayerRound(row: SupabaseRow): MultiplayerRound {
  return {
    id: stringValue(row.id),
    gameId: stringValue(row.game_id),
    roundNumber: numberValue(row.round_number),
    questionId: stringValue(row.question_id),
    questionSnapshot: recordValue(row.question_snapshot) as MultiplayerRound['questionSnapshot'],
    prize: numberValue(row.prize),
    status: stringValue(row.status, 'pending') as MultiplayerRound['status'],
    startsAt: stringValue(row.starts_at),
    endsAt: stringValue(row.ends_at),
    winnerPlayerId: stringValue(row.winner_player_id) || undefined,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at)
  };
}

function multiplayerRoundPayload(round: Partial<MultiplayerRound>): JsonRecord {
  return {
    id: round.id,
    game_id: round.gameId,
    round_number: round.roundNumber,
    question_id: round.questionId,
    question_snapshot: round.questionSnapshot,
    prize: round.prize,
    status: round.status,
    starts_at: round.startsAt,
    ends_at: round.endsAt,
    winner_player_id: round.winnerPlayerId,
    created_at: round.createdAt,
    updated_at: round.updatedAt
  };
}

function mapMultiplayerAnswer(row: SupabaseRow): MultiplayerAnswer {
  return {
    id: stringValue(row.id),
    gameId: stringValue(row.game_id),
    roundId: stringValue(row.round_id),
    playerId: stringValue(row.player_id),
    answerIndex: numberValue(row.answer_index),
    isCorrect: boolValue(row.is_correct),
    responseTimeMs: numberValue(row.response_time_ms),
    awardedPrize: numberValue(row.awarded_prize),
    submittedAt: stringValue(row.submitted_at)
  };
}

function multiplayerAnswerPayload(answer: MultiplayerAnswer): JsonRecord {
  return {
    id: answer.id,
    game_id: answer.gameId,
    round_id: answer.roundId,
    player_id: answer.playerId,
    answer_index: answer.answerIndex,
    is_correct: answer.isCorrect,
    response_time_ms: answer.responseTimeMs,
    awarded_prize: answer.awardedPrize,
    submitted_at: answer.submittedAt
  };
}

function mapMultiplayerResult(row: SupabaseRow): MultiplayerResult {
  return {
    id: stringValue(row.id),
    gameId: stringValue(row.game_id),
    playerId: stringValue(row.player_id),
    rank: numberValue(row.rank),
    totalPrize: numberValue(row.total_prize),
    correctAnswers: numberValue(row.correct_answers),
    averageResponseTimeMs: numberValue(row.average_response_time_ms),
    createdAt: stringValue(row.created_at)
  };
}

function multiplayerResultPayload(result: MultiplayerResult): JsonRecord {
  return {
    id: result.id,
    game_id: result.gameId,
    player_id: result.playerId,
    rank: result.rank,
    total_prize: result.totalPrize,
    correct_answers: result.correctAnswers,
    average_response_time_ms: result.averageResponseTimeMs,
    created_at: result.createdAt
  };
}

function upsertLeaderboardFallback(input: SubmitScoreInput) {
  const nickname = normalizeNickname(input.nickname);
  const key = nicknameKey(nickname);
  const existing = databaseLeaderboardFallback.find(entry => nicknameKey(entry.nickname) === key);
  const date = now();

  if (existing) {
    if (input.authUserId && existing.authUserId && existing.authUserId !== input.authUserId) {
      return { status: 'nickname_taken' as const };
    }

    const updated: LeaderboardEntry = {
      ...existing,
      nickname,
      displayName: input.displayName || existing.displayName,
      authUserId: existing.authUserId || input.authUserId,
      bestPrize: input.claimOnly ? existing.bestPrize : Math.max(existing.bestPrize, input.prize),
      bestCorrectCount: input.claimOnly ? existing.bestCorrectCount : Math.max(existing.bestCorrectCount, input.correctCount),
      gamesCount: input.claimOnly ? existing.gamesCount : existing.gamesCount + 1,
      updatedAt: date
    };
    databaseLeaderboardFallback = databaseLeaderboardFallback.map(entry => entry.id === existing.id ? updated : entry);
    return { status: 'ok' as const, entry: updated };
  }

  const entry: LeaderboardEntry = {
    id: id('leaderboard'),
    nickname,
    displayName: input.displayName,
    authUserId: input.authUserId,
    bestPrize: input.claimOnly ? 0 : input.prize,
    bestCorrectCount: input.claimOnly ? 0 : input.correctCount,
    gamesCount: input.claimOnly ? 0 : 1,
    isHidden: false,
    createdAt: date,
    updatedAt: date
  };
  databaseLeaderboardFallback = [entry, ...databaseLeaderboardFallback];
  return { status: 'ok' as const, entry };
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
        const question = input.editedQuestion || submission.question || submissionToQuestion(submission);
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
      async list(options) {
        const rows = await client.list<SupabaseRow>('notifications', `select=*&order=created_at.desc${limitQuery({ limit: options?.limit ?? 200 })}`);
        return rows.map(mapNotification);
      },
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
    },
    leaderboard: {
      async listAll(options) {
        const rows = await client.list<SupabaseRow>('leaderboard_entries', `select=*&order=best_prize.desc,updated_at.desc${limitQuery({ limit: options?.limit ?? 200 })}`);
        return rows.map(mapLeaderboardEntry);
      },
      async listTop(options) {
        try {
          const query = `select=*&is_hidden=eq.false&order=best_prize.desc,best_correct_count.desc,updated_at.desc${limitQuery({ limit: options?.limit ?? 25 })}`;
          const rows = await client.list<SupabaseRow>('leaderboard_entries', query);
          return rows.map(mapLeaderboardEntry);
        } catch {
          return sortLeaderboard(databaseLeaderboardFallback.filter(entry => !entry.isHidden)).slice(0, options?.limit ?? 25);
        }
      },
      async submitScore(input) {
        const nickname = normalizeNickname(input.nickname);
        const key = nicknameKey(nickname);

        try {
          const rows = await client.list<SupabaseRow>('leaderboard_entries', `select=*&${eq('nickname_key', key)}&limit=1`);
          const existing = rows[0] ? mapLeaderboardEntry(rows[0]) : undefined;
          const date = now();

          if (existing) {
            if (input.authUserId && existing.authUserId && existing.authUserId !== input.authUserId) {
              return { status: 'nickname_taken' as const };
            }

            const row = await client.update<SupabaseRow>('leaderboard_entries', eq('id', existing.id), {
              nickname,
              display_name: input.displayName || existing.displayName,
              auth_user_id: existing.authUserId || input.authUserId,
              best_prize: input.claimOnly ? existing.bestPrize : Math.max(existing.bestPrize, input.prize),
              best_correct_count: input.claimOnly ? existing.bestCorrectCount : Math.max(existing.bestCorrectCount, input.correctCount),
              games_count: input.claimOnly ? existing.gamesCount : existing.gamesCount + 1,
              updated_at: date
            });
            return { status: 'ok' as const, entry: mapLeaderboardEntry(row) };
          }

          const row = await client.insert<SupabaseRow>('leaderboard_entries', {
            id: id('leaderboard'),
            nickname,
            nickname_key: key,
            display_name: input.displayName,
            auth_user_id: input.authUserId,
            best_prize: input.claimOnly ? 0 : input.prize,
            best_correct_count: input.claimOnly ? 0 : input.correctCount,
            games_count: input.claimOnly ? 0 : 1,
            is_hidden: false,
            created_at: date,
            updated_at: date
          });
          return { status: 'ok' as const, entry: mapLeaderboardEntry(row) };
        } catch {
          return upsertLeaderboardFallback(input);
        }
      },
      async setHidden(nickname, hidden) {
        const key = nicknameKey(nickname);
        try {
          const rows = await client.list<SupabaseRow>('leaderboard_entries', `select=*&${eq('nickname_key', key)}&limit=1`);
          if (!rows[0]) return undefined;
          const row = await client.update<SupabaseRow>('leaderboard_entries', eq('id', stringValue(rows[0].id)), {
            is_hidden: hidden,
            updated_at: now()
          });
          return row ? mapLeaderboardEntry(row) : undefined;
        } catch {
          let updated: LeaderboardEntry | undefined;
          databaseLeaderboardFallback = databaseLeaderboardFallback.map(entry => {
            if (nicknameKey(entry.nickname) !== key) return entry;
            updated = { ...entry, isHidden: hidden, updatedAt: now() };
            return updated;
          });
          return updated;
        }
      }
    },
    multiplayer: {
      async listPlayersForIdentity(identity) {
        const filters: string[] = [];
        if (identity.authUserId) filters.push(`auth_user_id.eq.${encodeURIComponent(identity.authUserId)}`);
        if (identity.anonymousId) filters.push(`anonymous_id.eq.${encodeURIComponent(identity.anonymousId)}`);
        if (filters.length === 0) return [];
        const rows = await client.list<SupabaseRow>('multiplayer_players', `select=*&or=(${filters.join(',')})&order=joined_at.desc&limit=200`);
        return rows.map(mapMultiplayerPlayer);
      },
      async listLobbies(options) {
        const rows = await client.list<SupabaseRow>('multiplayer_lobbies', `select=*&order=updated_at.desc${limitQuery({ limit: options?.limit ?? 100 })}`);
        return rows.map(mapMultiplayerLobby);
      },
      async listGames(options) {
        const rows = await client.list<SupabaseRow>('multiplayer_games', `select=*&order=created_at.desc${limitQuery({ limit: options?.limit ?? 100 })}`);
        return rows.map(mapMultiplayerGame);
      },
      async listOpenLobbies(options) {
        const query = `select=*&visibility=eq.public&status=in.(waiting,ready)&order=updated_at.desc${limitQuery({ limit: options?.limit ?? 20 })}`;
        const rows = await client.list<SupabaseRow>('multiplayer_lobbies', query);
        return rows.map(mapMultiplayerLobby);
      },
      async findLobby(lobbyId) {
        const rows = await client.list<SupabaseRow>('multiplayer_lobbies', `select=*&${eq('id', lobbyId)}&limit=1`);
        return rows[0] ? mapMultiplayerLobby(rows[0]) : undefined;
      },
      async createLobby(lobby) {
        const row = await client.insert<SupabaseRow>('multiplayer_lobbies', multiplayerLobbyPayload(lobby));
        return mapMultiplayerLobby(row);
      },
      async updateLobby(lobbyId, input) {
        const row = await client.update<SupabaseRow>('multiplayer_lobbies', eq('id', lobbyId), multiplayerLobbyPayload(input));
        return row ? mapMultiplayerLobby(row) : undefined;
      },
      async createPlayer(player) {
        const row = await client.insert<SupabaseRow>('multiplayer_players', multiplayerPlayerPayload(player));
        return mapMultiplayerPlayer(row);
      },
      async listPlayers(lobbyId) {
        const rows = await client.list<SupabaseRow>('multiplayer_players', `select=*&${eq('lobby_id', lobbyId)}&order=position.asc`);
        return rows.map(mapMultiplayerPlayer);
      },
      async findPlayer(playerId) {
        const rows = await client.list<SupabaseRow>('multiplayer_players', `select=*&${eq('id', playerId)}&limit=1`);
        return rows[0] ? mapMultiplayerPlayer(rows[0]) : undefined;
      },
      async findPlayerByIdentity(lobbyId, identity) {
        const filters = [
          identity.authUserId
            ? { query: eq('auth_user_id', identity.authUserId), logic: logicEq('auth_user_id', identity.authUserId) }
            : undefined,
          identity.anonymousId
            ? { query: eq('anonymous_id', identity.anonymousId), logic: logicEq('anonymous_id', identity.anonymousId) }
            : undefined
        ].filter((filter): filter is { query: string; logic: string } => Boolean(filter));
        if (!filters.length) return undefined;
        const identityQuery = filters.length === 1
          ? filters[0].query
          : `or=(${filters.map(filter => filter.logic).join(',')})`;
        const rows = await client.list<SupabaseRow>('multiplayer_players', `select=*&${eq('lobby_id', lobbyId)}&${identityQuery}&limit=1`);
        return rows[0] ? mapMultiplayerPlayer(rows[0]) : undefined;
      },
      async updatePlayer(playerId, input) {
        const row = await client.update<SupabaseRow>('multiplayer_players', eq('id', playerId), multiplayerPlayerPayload(input));
        return row ? mapMultiplayerPlayer(row) : undefined;
      },
      async createGame(game) {
        const row = await client.insert<SupabaseRow>('multiplayer_games', multiplayerGamePayload(game));
        return mapMultiplayerGame(row);
      },
      async findGame(gameId) {
        const rows = await client.list<SupabaseRow>('multiplayer_games', `select=*&${eq('id', gameId)}&limit=1`);
        return rows[0] ? mapMultiplayerGame(rows[0]) : undefined;
      },
      async findGameByLobby(lobbyId) {
        const rows = await client.list<SupabaseRow>('multiplayer_games', `select=*&${eq('lobby_id', lobbyId)}&limit=1`);
        return rows[0] ? mapMultiplayerGame(rows[0]) : undefined;
      },
      async updateGame(gameId, input) {
        const row = await client.update<SupabaseRow>('multiplayer_games', eq('id', gameId), multiplayerGamePayload(input));
        return row ? mapMultiplayerGame(row) : undefined;
      },
      async createRounds(rounds) {
        const created = await Promise.all(rounds.map(round => client.insert<SupabaseRow>('multiplayer_rounds', multiplayerRoundPayload(round))));
        return created.map(mapMultiplayerRound);
      },
      async listRounds(gameId) {
        const rows = await client.list<SupabaseRow>('multiplayer_rounds', `select=*&${eq('game_id', gameId)}&order=round_number.asc`);
        return rows.map(mapMultiplayerRound);
      },
      async findRound(roundId) {
        const rows = await client.list<SupabaseRow>('multiplayer_rounds', `select=*&${eq('id', roundId)}&limit=1`);
        return rows[0] ? mapMultiplayerRound(rows[0]) : undefined;
      },
      async updateRound(roundId, input) {
        const row = await client.update<SupabaseRow>('multiplayer_rounds', eq('id', roundId), multiplayerRoundPayload(input));
        return row ? mapMultiplayerRound(row) : undefined;
      },
      async createAnswer(answer) {
        const row = await client.insert<SupabaseRow>('multiplayer_answers', multiplayerAnswerPayload(answer));
        return mapMultiplayerAnswer(row);
      },
      async listAnswers(gameId) {
        const rows = await client.list<SupabaseRow>('multiplayer_answers', `select=*&${eq('game_id', gameId)}&order=submitted_at.asc`);
        return rows.map(mapMultiplayerAnswer);
      },
      async findAnswer(roundId, playerId) {
        const rows = await client.list<SupabaseRow>('multiplayer_answers', `select=*&${eq('round_id', roundId)}&${eq('player_id', playerId)}&limit=1`);
        return rows[0] ? mapMultiplayerAnswer(rows[0]) : undefined;
      },
      async createResults(results) {
        const created = await Promise.all(results.map(result => client.insert<SupabaseRow>('multiplayer_results', multiplayerResultPayload(result))));
        return created.map(mapMultiplayerResult);
      },
      async listResults(gameId) {
        const rows = await client.list<SupabaseRow>('multiplayer_results', `select=*&${eq('game_id', gameId)}&order=rank.asc`);
        return rows.map(mapMultiplayerResult);
      }
    },
    progression: {
      async list(options) {
        const rows = await client.list<SupabaseRow>('player_progression', `select=*&order=updated_at.desc${limitQuery({ limit: options?.limit ?? 500 })}`);
        return rows.map(mapProgression);
      },
      async find(playerKey) {
        const rows = await client.list<SupabaseRow>('player_progression', `select=*&${eq('player_key', playerKey)}&limit=1`);
        return rows[0] ? mapProgression(rows[0]) : undefined;
      },
      async save(progression) {
        const date = now();
        const payload = {
          player_key: progression.playerKey,
          xp: progression.xp,
          level: progression.level,
          games_played: progression.gamesPlayed,
          unlocked_achievements: progression.unlockedAchievements,
          updated_at: date
        };
        const existing = await this.find(progression.playerKey);
        if (existing) {
          const row = await client.update<SupabaseRow>('player_progression', eq('player_key', progression.playerKey), payload);
          return mapProgression(row);
        }
        const row = await client.insert<SupabaseRow>('player_progression', { ...payload, id: id('prog'), created_at: date });
        return mapProgression(row);
      }
    },
    contactTickets: {
      async list(filters) {
        const parts = ['select=*'];
        if (filters?.status) parts.push(`status=eq.${encodeURIComponent(filters.status)}`);
        if (filters?.priority) parts.push(`priority=eq.${encodeURIComponent(filters.priority)}`);
        if (filters?.search) {
          const term = encodeURIComponent(`%${filters.search}%`);
          parts.push(`or=(subject.ilike.${term},body.ilike.${term},requester_name.ilike.${term},requester_email.ilike.${term})`);
        }
        parts.push('order=created_at.desc');
        const rows = await client.list<SupabaseRow>('contact_tickets', `${parts.join('&')}${limitQuery({ limit: filters?.limit ?? 200 })}`);
        return rows.map(mapContactTicket);
      },
      async findById(ticketId) {
        const rows = await client.list<SupabaseRow>('contact_tickets', `select=*&${eq('id', ticketId)}&limit=1`);
        return rows[0] ? mapContactTicket(rows[0]) : undefined;
      },
      async create(input) {
        const row = await client.insert<SupabaseRow>('contact_tickets', {
          id: input.id,
          status: input.status,
          priority: input.priority,
          assignee_email: input.assigneeEmail,
          requester_name: input.requesterName,
          requester_email: input.requesterEmail,
          subject: input.subject,
          body: input.body,
          notes: [],
          source_notification_id: input.sourceNotificationId
        });
        return mapContactTicket(row);
      },
      async update(ticketId, input) {
        const row = await client.update<SupabaseRow>('contact_tickets', eq('id', ticketId), {
          status: input.status,
          priority: input.priority,
          assignee_email: input.assigneeEmail,
          updated_at: now()
        });
        return row ? mapContactTicket(row) : undefined;
      },
      async addNote(ticketId, note) {
        const existing = await client.list<SupabaseRow>('contact_tickets', `select=*&${eq('id', ticketId)}&limit=1`);
        if (!existing[0]) return undefined;
        const notes = Array.isArray(existing[0].notes) ? existing[0].notes as unknown[] : [];
        const row = await client.update<SupabaseRow>('contact_tickets', eq('id', ticketId), {
          notes: [...notes, { id: `note-${Date.now()}`, authorEmail: note.authorEmail, body: note.body, createdAt: now() }],
          updated_at: now()
        });
        return row ? mapContactTicket(row) : undefined;
      }
    },

    payments: {
      async listTransactions(options) {
        const rows = await client.list<SupabaseRow>('payment_transactions', `select=*&order=created_at.desc${limitQuery({ limit: options?.limit ?? 200 })}`);
        return rows.map(mapTransaction);
      },
      async listSubscriptions(options) {
        const rows = await client.list<SupabaseRow>('user_subscriptions', `select=*&order=created_at.desc${limitQuery({ limit: options?.limit ?? 200 })}`);
        return rows.map(mapSubscription);
      },
      async findSubscription(id) {
        const rows = await client.list<SupabaseRow>('user_subscriptions', `select=*&${eq('id', id)}&limit=1`);
        return rows[0] ? mapSubscription(rows[0]) : undefined;
      },
      async findSubscriptionByProviderId(provider, providerSubscriptionId) {
        const rows = await client.list<SupabaseRow>('user_subscriptions', `select=*&${eq('provider', provider)}&${eq('provider_subscription_id', providerSubscriptionId)}&limit=1`);
        return rows[0] ? mapSubscription(rows[0]) : undefined;
      },
      async findSubscriptionByUserId(userId) {
        const rows = await client.list<SupabaseRow>('user_subscriptions', `select=*&${eq('user_id', userId)}&limit=1`);
        return rows[0] ? mapSubscription(rows[0]) : undefined;
      },
      async saveSubscription(subscription) {
        const existing = await this.findSubscription(subscription.id);
        const date = now();
        if (existing) {
          const payload = subscriptionPayload({
            ...existing,
            ...subscription,
            updatedAt: date
          });
          const row = await client.update<SupabaseRow>('user_subscriptions', eq('id', subscription.id), payload);
          return mapSubscription(row);
        } else {
          const idVal = subscription.id || id('sub');
          const payload = subscriptionPayload({
            ...subscription,
            id: idVal,
            createdAt: subscription.createdAt || date,
            updatedAt: subscription.updatedAt || date
          });
          const row = await client.insert<SupabaseRow>('user_subscriptions', payload);
          return mapSubscription(row);
        }
      },
      async listEntitlementsByUserId(userId) {
        const rows = await client.list<SupabaseRow>('user_entitlements', `select=*&${eq('user_id', userId)}`);
        return rows.map(mapEntitlement);
      },
      async findEntitlement(id) {
        const rows = await client.list<SupabaseRow>('user_entitlements', `select=*&${eq('id', id)}&limit=1`);
        return rows[0] ? mapEntitlement(rows[0]) : undefined;
      },
      async saveEntitlement(entitlement) {
        const existing = await this.findEntitlement(entitlement.id);
        const date = now();
        if (existing) {
          const payload = entitlementPayload({
            ...existing,
            ...entitlement,
            updatedAt: date
          });
          const row = await client.update<SupabaseRow>('user_entitlements', eq('id', entitlement.id), payload);
          return mapEntitlement(row);
        } else {
          const idVal = entitlement.id || id('ent');
          const payload = entitlementPayload({
            ...entitlement,
            id: idVal,
            createdAt: entitlement.createdAt || date,
            updatedAt: entitlement.updatedAt || date
          });
          const row = await client.insert<SupabaseRow>('user_entitlements', payload);
          return mapEntitlement(row);
        }
      },
      async createTransaction(transaction) {
        const payload = transactionPayload(transaction);
        const row = await client.insert<SupabaseRow>('payment_transactions', {
          ...payload,
          id: id('tx'),
          created_at: now()
        });
        return mapTransaction(row);
      },
      async listTransactionsByUserId(userId) {
        const rows = await client.list<SupabaseRow>('payment_transactions', `select=*&${eq('user_id', userId)}&order=created_at.desc`);
        return rows.map(mapTransaction);
      }
    }
  };
}
