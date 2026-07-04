import type { RepositoryProvider } from '../interfaces';

function notConnected(method: string): never {
  throw new Error(`Database provider method "${method}" is prepared but not connected yet. Configure Supabase/PostgreSQL and replace this stub with live queries.`);
}

export function createDatabaseRepositoryProvider(): RepositoryProvider {
  return {
    kind: 'database',
    users: {
      list: async () => notConnected('users.list'),
      findById: async () => notConnected('users.findById'),
      findByAuthUserId: async () => notConnected('users.findByAuthUserId'),
      create: async () => notConnected('users.create'),
      update: async () => notConnected('users.update')
    },
    admins: {
      list: async () => notConnected('admins.list'),
      findById: async () => notConnected('admins.findById'),
      findByEmail: async () => notConnected('admins.findByEmail'),
      create: async () => notConnected('admins.create'),
      setRoles: async () => notConnected('admins.setRoles')
    },
    roles: {
      list: async () => notConnected('roles.list'),
      findBySlug: async () => notConnected('roles.findBySlug'),
      upsert: async () => notConnected('roles.upsert')
    },
    permissions: {
      list: async () => notConnected('permissions.list'),
      findBySlug: async () => notConnected('permissions.findBySlug'),
      upsert: async () => notConnected('permissions.upsert'),
      grantToRole: async () => notConnected('permissions.grantToRole'),
      listForRole: async () => notConnected('permissions.listForRole')
    },
    submissions: {
      list: async () => notConnected('submissions.list'),
      findById: async () => notConnected('submissions.findById'),
      create: async () => notConnected('submissions.create'),
      approve: async () => notConnected('submissions.approve'),
      reject: async () => notConnected('submissions.reject')
    },
    approvedQuestions: {
      list: async () => notConnected('approvedQuestions.list'),
      listGameplayQuestions: async () => notConnected('approvedQuestions.listGameplayQuestions'),
      findById: async () => notConnected('approvedQuestions.findById'),
      create: async () => notConnected('approvedQuestions.create'),
      update: async () => notConnected('approvedQuestions.update'),
      archive: async () => notConnected('approvedQuestions.archive')
    },
    reviewQueue: {
      list: async () => notConnected('reviewQueue.list'),
      enqueue: async () => notConnected('reviewQueue.enqueue'),
      removeBySubmissionId: async () => notConnected('reviewQueue.removeBySubmissionId'),
      assign: async () => notConnected('reviewQueue.assign')
    },
    moderationResults: {
      listBySubmission: async () => notConnected('moderationResults.listBySubmission'),
      create: async () => notConnected('moderationResults.create')
    },
    auditLogs: {
      list: async () => notConnected('auditLogs.list'),
      create: async () => notConnected('auditLogs.create')
    },
    reputation: {
      getContributorReputation: async () => notConnected('reputation.getContributorReputation'),
      addEvent: async () => notConnected('reputation.addEvent'),
      recalculate: async () => notConnected('reputation.recalculate')
    },
    antiSpamEvents: {
      list: async () => notConnected('antiSpamEvents.list'),
      create: async () => notConnected('antiSpamEvents.create'),
      listRecentByIdentity: async () => notConnected('antiSpamEvents.listRecentByIdentity')
    },
    notifications: {
      listForUser: async () => notConnected('notifications.listForUser'),
      listForAdmin: async () => notConnected('notifications.listForAdmin'),
      create: async () => notConnected('notifications.create'),
      markRead: async () => notConnected('notifications.markRead')
    }
  };
}
