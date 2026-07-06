import type { AuditLogEntry, CommunitySubmission, ModerationResult } from '@/lib/community';
import type {
  AntiSpamEventRecord,
  ApprovedQuestionRecord,
  CommunityRepository,
  CommunityRepositorySnapshot,
  ReviewDecision,
  ReviewQueueItemRecord,
  SubmitQuestionResult
} from './schema';

type LocalRepositoryState = {
  submissions: CommunitySubmission[];
  approvedQuestions: ApprovedQuestionRecord[];
  reviewQueue: ReviewQueueItemRecord[];
  auditLogs: AuditLogEntry[];
  antiSpamEvents: AntiSpamEventRecord[];
};

const emptyState = (): LocalRepositoryState => ({
  submissions: [],
  approvedQuestions: [],
  reviewQueue: [],
  auditLogs: [],
  antiSpamEvents: []
});

export function createLocalCommunityRepository(initialState: Partial<LocalRepositoryState> = {}): CommunityRepository {
  const state: LocalRepositoryState = { ...emptyState(), ...initialState };

  return {
    mode: 'local',

    async getSnapshot(): Promise<CommunityRepositorySnapshot> {
      return {
        submissions: state.submissions,
        approvedQuestions: state.approvedQuestions,
        reviewQueue: state.reviewQueue,
        auditLogs: state.auditLogs,
        contributors: [],
        antiSpamEvents: state.antiSpamEvents
      };
    },

    async createSubmission(submission: CommunitySubmission): Promise<SubmitQuestionResult> {
      state.submissions = [submission, ...state.submissions];

      let approvedQuestion: ApprovedQuestionRecord | undefined;
      if (submission.question) {
        approvedQuestion = {
          ...submission.question,
          sourceSubmissionId: submission.id,
          locale: submission.draft.language,
          isActive: true,
          publishedAt: submission.updatedAt,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt
        };
        state.approvedQuestions = [approvedQuestion, ...state.approvedQuestions];
      }

      let queueItem: ReviewQueueItemRecord | undefined;
      if (submission.moderation.status === 'needs_review') {
        queueItem = {
          id: `queue-${submission.id}`,
          submissionId: submission.id,
          priority: Math.max(1, 100 - submission.moderation.score),
          queueReason: submission.moderation.reasons.join(' | '),
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt
        };
        state.reviewQueue = [queueItem, ...state.reviewQueue];
      }

      return { submission, approvedQuestion, queueItem };
    },

    async approveSubmission(decision: ReviewDecision): Promise<ApprovedQuestionRecord | undefined> {
      const submission = state.submissions.find(item => item.id === decision.submissionId);
      if (!submission?.question) return undefined;

      const approvedQuestion: ApprovedQuestionRecord = {
        ...submission.question,
        sourceSubmissionId: submission.id,
        locale: submission.draft.language,
        isActive: true,
        publishedAt: new Date().toISOString(),
        createdAt: submission.createdAt,
        updatedAt: new Date().toISOString()
      };

      state.approvedQuestions = state.approvedQuestions.some(item => item.id === approvedQuestion.id)
        ? state.approvedQuestions
        : [approvedQuestion, ...state.approvedQuestions];
      state.reviewQueue = state.reviewQueue.filter(item => item.submissionId !== decision.submissionId);

      return approvedQuestion;
    },

    async rejectSubmission(decision: ReviewDecision): Promise<CommunitySubmission | undefined> {
      const now = new Date().toISOString();
      let rejected: CommunitySubmission | undefined;
      state.submissions = state.submissions.map(item => {
        if (item.id !== decision.submissionId) return item;
        rejected = {
          ...item,
          updatedAt: now,
          moderation: { ...item.moderation, status: 'rejected', recommendation: decision.note || item.moderation.recommendation }
        };
        return rejected;
      });
      state.reviewQueue = state.reviewQueue.filter(item => item.submissionId !== decision.submissionId);
      return rejected;
    },

    async writeAuditLog(entry: AuditLogEntry): Promise<void> {
      state.auditLogs = [entry, ...state.auditLogs].slice(0, 500);
    },

    async recordModerationResult(submissionId: string, result: ModerationResult) {
      return {
        ...result,
        id: `moderation-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        submissionId,
        provider: 'local_rules' as const,
        createdAt: new Date().toISOString()
      };
    },

    async recordAntiSpamEvent(event: Omit<AntiSpamEventRecord, 'id' | 'createdAt'>) {
      const record: AntiSpamEventRecord = {
        ...event,
        id: `spam-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString()
      };
      state.antiSpamEvents = [record, ...state.antiSpamEvents].slice(0, 500);
      return record;
    }
  };
}
