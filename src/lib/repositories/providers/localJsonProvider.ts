import 'server-only';
import data from '@/data/questions.json';
import type { CommunitySubmission } from '@/lib/community';
import { createAudit, submissionToQuestion } from '@/lib/community';
import type {
  Admin,
  AdminRoleSlug,
  AntiSpamEvent,
  ApprovedQuestion,
  AuditLog,
  ContactTicket,
  ContributorReputation,
  EntityId,
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
  MultiplayerAnswer,
  MultiplayerGame,
  MultiplayerLobby,
  MultiplayerPlayer,
  MultiplayerResult,
  MultiplayerRound
} from '@/lib/multiplayer/types';
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
import type { RepositoryProvider, SubmitScoreInput } from '../interfaces';

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
  'notifications.write',
  'rewards.read',
  'rewards.manage'
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
  leaderboard: LeaderboardEntry[];
  multiplayerLobbies: MultiplayerLobby[];
  multiplayerPlayers: MultiplayerPlayer[];
  multiplayerGames: MultiplayerGame[];
  multiplayerRounds: MultiplayerRound[];
  multiplayerAnswers: MultiplayerAnswer[];
  multiplayerResults: MultiplayerResult[];
  subscriptions: UserSubscription[];
  playerProgression: PlayerProgression[];
  entitlements: UserEntitlement[];
  transactions: PaymentTransaction[];
  contactTickets: ContactTicket[];
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
      admin: ['questions.read', 'questions.write', 'submissions.read', 'submissions.review', 'moderation.read', 'audit.read', 'spam.read', 'rewards.read', 'rewards.manage'],
      moderator: ['questions.read', 'submissions.read', 'submissions.review', 'moderation.read', 'rewards.read']
    },
    submissions: [],
    approvedQuestions: (data.questions as Question[]).map(toApprovedQuestion),
    reviewQueue: [],
    moderationResults: [],
    auditLogs: [],
    reputation: [],
    reputationEvents: [],
    antiSpamEvents: [],
    notifications: [],
    leaderboard: [],
    multiplayerLobbies: [],
    multiplayerPlayers: [],
    multiplayerGames: [],
    multiplayerRounds: [],
    multiplayerAnswers: [],
    multiplayerResults: [],
    subscriptions: [],
    playerProgression: [],
    entitlements: [],
    transactions: [],
    contactTickets: []
  };
}

const LOCAL_STATE_KEY = '__premiumTriviaLocalRepositoryState';

const localState = getSharedLocalState();

function getSharedLocalState(): LocalState {
  const globalScope = globalThis as typeof globalThis & { [LOCAL_STATE_KEY]?: LocalState };
  const state = globalScope[LOCAL_STATE_KEY] = globalScope[LOCAL_STATE_KEY] || createInitialState();
  // The global survives dev HMR module reloads, so a state object created by
  // an older module version may predate collections added since — heal
  // additive keys instead of crashing their repositories.
  state.contactTickets = state.contactTickets || [];
  return state;
}

function limit<T>(items: T[], size?: number) {
  return typeof size === 'number' ? items.slice(0, size) : items;
}

function findById<T extends { id: string | number }>(items: T[], itemId: string | number) {
  return items.find(item => String(item.id) === String(itemId));
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

function upsertLocalLeaderboardScore(state: LocalState, input: SubmitScoreInput) {
  const nickname = normalizeNickname(input.nickname);
  const key = nicknameKey(nickname);
  const existing = state.leaderboard.find(entry => nicknameKey(entry.nickname) === key);
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

    state.leaderboard = state.leaderboard.map(entry => entry.id === existing.id ? updated : entry);
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

  state.leaderboard = [entry, ...state.leaderboard];
  return { status: 'ok' as const, entry };
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
          const question = input.editedQuestion || submission.question || submissionToQuestion(submission);
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
      async list(options) {
        const all = [...state.notifications]
          .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
        return limit(all, options?.limit ?? 200);
      },
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
    },

    leaderboard: {
      async listAll(options) {
        const all = [...state.leaderboard]
          .sort((first, second) => second.bestPrize - first.bestPrize);
        return limit(all, options?.limit ?? 200);
      },
      async listTop(options) {
        return limit(sortLeaderboard(state.leaderboard.filter(entry => !entry.isHidden)), options?.limit ?? 25);
      },
      async submitScore(input) {
        return upsertLocalLeaderboardScore(state, input);
      },
      async setHidden(nickname, hidden) {
        const key = nicknameKey(nickname);
        let updated: LeaderboardEntry | undefined;
        state.leaderboard = state.leaderboard.map(entry => {
          if (nicknameKey(entry.nickname) !== key) return entry;
          updated = { ...entry, isHidden: hidden, updatedAt: now() };
          return updated;
        });
        return updated;
      }
    },

    multiplayer: {
      async listPlayersForIdentity(identity) {
        return state.multiplayerPlayers.filter(player =>
          (identity.authUserId && player.authUserId === identity.authUserId) ||
          (identity.anonymousId && player.anonymousId === identity.anonymousId)
        );
      },
      async listLobbies(options) {
        const all = [...state.multiplayerLobbies]
          .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime());
        return limit(all, options?.limit ?? 100);
      },
      async listGames(options) {
        const all = [...state.multiplayerGames]
          .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
        return limit(all, options?.limit ?? 100);
      },
      async listOpenLobbies(options) {
        const open = state.multiplayerLobbies
          .filter(lobby => lobby.visibility === 'public' && (lobby.status === 'waiting' || lobby.status === 'ready'))
          .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime());
        return limit(open, options?.limit ?? 20);
      },
      async findLobby(lobbyId) {
        return findById(state.multiplayerLobbies, lobbyId);
      },
      async createLobby(lobby) {
        state.multiplayerLobbies = [lobby, ...state.multiplayerLobbies];
        return lobby;
      },
      async updateLobby(lobbyId, input) {
        let updated: MultiplayerLobby | undefined;
        state.multiplayerLobbies = state.multiplayerLobbies.map(lobby => {
          if (lobby.id !== lobbyId) return lobby;
          updated = { ...lobby, ...input, updatedAt: input.updatedAt || now() };
          return updated;
        });
        return updated;
      },
      async createPlayer(player) {
        state.multiplayerPlayers = [...state.multiplayerPlayers, player];
        return player;
      },
      async listPlayers(lobbyId) {
        return state.multiplayerPlayers
          .filter(player => player.lobbyId === lobbyId)
          .sort((first, second) => first.position - second.position);
      },
      async findPlayer(playerId) {
        return findById(state.multiplayerPlayers, playerId);
      },
      async findPlayerByIdentity(lobbyId, identity) {
        return state.multiplayerPlayers.find(player =>
          player.lobbyId === lobbyId &&
          ((identity.authUserId && player.authUserId === identity.authUserId) ||
            (identity.anonymousId && player.anonymousId === identity.anonymousId))
        );
      },
      async updatePlayer(playerId, input) {
        let updated: MultiplayerPlayer | undefined;
        state.multiplayerPlayers = state.multiplayerPlayers.map(player => {
          if (player.id !== playerId) return player;
          updated = { ...player, ...input, lastSeenAt: input.lastSeenAt || player.lastSeenAt };
          return updated;
        });
        return updated;
      },
      async createGame(game) {
        state.multiplayerGames = [game, ...state.multiplayerGames];
        return game;
      },
      async findGame(gameId) {
        return findById(state.multiplayerGames, gameId);
      },
      async findGameByLobby(lobbyId) {
        return state.multiplayerGames.find(game => game.lobbyId === lobbyId);
      },
      async updateGame(gameId, input) {
        let updated: MultiplayerGame | undefined;
        state.multiplayerGames = state.multiplayerGames.map(game => {
          if (game.id !== gameId) return game;
          updated = { ...game, ...input, updatedAt: input.updatedAt || now() };
          return updated;
        });
        return updated;
      },
      async createRounds(rounds) {
        state.multiplayerRounds = [...state.multiplayerRounds, ...rounds];
        return rounds;
      },
      async listRounds(gameId) {
        return state.multiplayerRounds
          .filter(round => round.gameId === gameId)
          .sort((first, second) => first.roundNumber - second.roundNumber);
      },
      async findRound(roundId) {
        return findById(state.multiplayerRounds, roundId);
      },
      async updateRound(roundId, input) {
        let updated: MultiplayerRound | undefined;
        state.multiplayerRounds = state.multiplayerRounds.map(round => {
          if (round.id !== roundId) return round;
          updated = { ...round, ...input, updatedAt: input.updatedAt || now() };
          return updated;
        });
        return updated;
      },
      async createAnswer(answer) {
        const existing = state.multiplayerAnswers.find(item => item.roundId === answer.roundId && item.playerId === answer.playerId);
        if (existing) return existing;
        if (answer.isCorrect && answer.awardedPrize > 0 && state.multiplayerAnswers.some(item => item.roundId === answer.roundId && item.awardedPrize > 0)) {
          const withoutPrize = { ...answer, awardedPrize: 0 };
          state.multiplayerAnswers = [...state.multiplayerAnswers, withoutPrize];
          return withoutPrize;
        }
        state.multiplayerAnswers = [...state.multiplayerAnswers, answer];
        return answer;
      },
      async listAnswers(gameId) {
        return state.multiplayerAnswers.filter(answer => answer.gameId === gameId);
      },
      async findAnswer(roundId, playerId) {
        return state.multiplayerAnswers.find(answer => answer.roundId === roundId && answer.playerId === playerId);
      },
      async createResults(results) {
        const existingGameIds = new Set(results.map(result => result.gameId));
        state.multiplayerResults = [
          ...state.multiplayerResults.filter(result => !existingGameIds.has(result.gameId)),
          ...results
        ];
        return results;
      },
      async listResults(gameId) {
        return state.multiplayerResults
          .filter(result => result.gameId === gameId)
          .sort((first, second) => first.rank - second.rank);
      }
    },
    progression: {
      async list(options) {
        const all = [...state.playerProgression]
          .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime());
        return limit(all, options?.limit ?? 500);
      },
      async find(playerKey) {
        return state.playerProgression.find(item => item.playerKey === playerKey);
      },
      async save(progression) {
        const date = new Date().toISOString();
        const existing = state.playerProgression.find(item => item.playerKey === progression.playerKey);
        const record: PlayerProgression = {
          ...progression,
          id: existing?.id || progression.id || `prog-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          createdAt: existing?.createdAt || progression.createdAt || date,
          updatedAt: date
        };
        state.playerProgression = [record, ...state.playerProgression.filter(item => item.playerKey !== progression.playerKey)];
        return record;
      }
    },
    contactTickets: {
      async list(filters) {
        let tickets = [...state.contactTickets];
        if (filters?.status) tickets = tickets.filter(ticket => ticket.status === filters.status);
        if (filters?.priority) tickets = tickets.filter(ticket => ticket.priority === filters.priority);
        if (filters?.search) {
          const search = filters.search.toLowerCase();
          tickets = tickets.filter(ticket =>
            ticket.subject.toLowerCase().includes(search) ||
            ticket.body.toLowerCase().includes(search) ||
            ticket.requesterName.toLowerCase().includes(search) ||
            ticket.requesterEmail.toLowerCase().includes(search)
          );
        }
        tickets.sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
        return limit(tickets, filters?.limit ?? 200);
      },
      async findById(ticketId) {
        return state.contactTickets.find(ticket => ticket.id === ticketId);
      },
      async create(input) {
        const timestamp = now();
        const ticket: ContactTicket = {
          ...input,
          id: input.id || `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          notes: [],
          createdAt: timestamp,
          updatedAt: timestamp
        };
        state.contactTickets = [ticket, ...state.contactTickets];
        return ticket;
      },
      async update(ticketId, input) {
        let updated: ContactTicket | undefined;
        state.contactTickets = state.contactTickets.map(ticket => {
          if (ticket.id !== ticketId) return ticket;
          updated = { ...ticket, ...input, updatedAt: now() };
          return updated;
        });
        return updated;
      },
      async addNote(ticketId, note) {
        let updated: ContactTicket | undefined;
        state.contactTickets = state.contactTickets.map(ticket => {
          if (ticket.id !== ticketId) return ticket;
          updated = {
            ...ticket,
            notes: [...ticket.notes, { id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, authorEmail: note.authorEmail, body: note.body, createdAt: now() }],
            updatedAt: now()
          };
          return updated;
        });
        return updated;
      }
    },

    payments: {
      async listTransactions(options) {
        const all = [...state.transactions]
          .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
        return limit(all, options?.limit ?? 200);
      },
      async listSubscriptions(options) {
        const all = [...state.subscriptions]
          .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
        return limit(all, options?.limit ?? 200);
      },
      async findSubscription(id) {
        return state.subscriptions.find(sub => sub.id === id);
      },
      async findSubscriptionByProviderId(provider, providerSubscriptionId) {
        return state.subscriptions.find(sub => sub.provider === provider && sub.providerSubscriptionId === providerSubscriptionId);
      },
      async findSubscriptionByUserId(userId) {
        return state.subscriptions.find(sub => sub.userId === userId);
      },
      async saveSubscription(subscription) {
        const existing = state.subscriptions.find(sub => sub.id === subscription.id);
        const date = now();
        if (existing) {
          const updated: UserSubscription = {
            ...existing,
            ...subscription,
            updatedAt: date
          };
          state.subscriptions = state.subscriptions.map(sub => sub.id === subscription.id ? updated : sub);
          return updated;
        } else {
          const created: UserSubscription = {
            ...subscription,
            id: subscription.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            createdAt: subscription.createdAt || date,
            updatedAt: subscription.updatedAt || date
          };
          state.subscriptions = [created, ...state.subscriptions];
          return created;
        }
      },
      async listEntitlementsByUserId(userId) {
        return state.entitlements.filter(ent => ent.userId === userId);
      },
      async findEntitlement(id) {
        return state.entitlements.find(ent => ent.id === id);
      },
      async saveEntitlement(entitlement) {
        const existing = state.entitlements.find(ent => ent.id === entitlement.id);
        const date = now();
        if (existing) {
          const updated: UserEntitlement = {
            ...existing,
            ...entitlement,
            updatedAt: date
          };
          state.entitlements = state.entitlements.map(ent => ent.id === entitlement.id ? updated : ent);
          return updated;
        } else {
          const created: UserEntitlement = {
            ...entitlement,
            id: entitlement.id || `ent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            createdAt: entitlement.createdAt || date,
            updatedAt: entitlement.updatedAt || date
          };
          state.entitlements = [created, ...state.entitlements];
          return created;
        }
      },
      async createTransaction(transaction) {
        const created: PaymentTransaction = {
          ...transaction,
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          createdAt: now()
        };
        state.transactions = [created, ...state.transactions];
        return created;
      },
      async listTransactionsByUserId(userId) {
        return state.transactions.filter(tx => tx.userId === userId);
      }
    }
  };
}
