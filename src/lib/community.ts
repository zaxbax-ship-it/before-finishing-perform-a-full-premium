import type { Locale, Question } from './types';

export type SubmissionStatus = 'auto_approved' | 'needs_review' | 'rejected';
export type AdminRole = 'super_admin' | 'admin' | 'moderator';

export type CommunityDraft = {
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
  difficulty: string;
  language: Locale;
  explanation: string;
  contributorName: string;
  contributorEmail: string;
};

export type ModerationResult = {
  status: SubmissionStatus;
  score: number;
  recommendation: string;
  reasons: string[];
  normalizedQuestion: string;
  normalizedOptions: string[];
  explanation: string;
  duplicateQuestionId?: string | number;
};

export type CommunitySubmission = {
  id: string;
  createdAt: string;
  updatedAt: string;
  draft: CommunityDraft;
  moderation: ModerationResult;
  question?: Question;
};

export type AuditLogEntry = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  target: string;
  details: string;
};

const toxicTerms = ['נאצי', 'קללה', 'טיפש', 'fuck', 'shit', 'nazi', 'قتل', 'убить'];

export function emptyCommunityDraft(locale: Locale, category = 'ידע כללי'): CommunityDraft {
  return {
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    category,
    difficulty: 'בינוני',
    language: locale,
    explanation: '',
    contributorName: '',
    contributorEmail: ''
  };
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value: string) {
  return cleanText(value).toLowerCase().replace(/[?!.,;:"'׳״]/g, '');
}

function wordCount(value: string) {
  return cleanText(value).split(/\s+/).filter(Boolean).length;
}

export function generateExplanation(draft: CommunityDraft) {
  const answer = draft.options[draft.correctIndex] || '';
  const base = `התשובה הנכונה היא ${answer}. השאלה בודקת ידע ממוקד בנושא ${draft.category}, וההסבר הקצר עוזר לזכור את העובדה המרכזית גם בסיבוב הבא.`;
  return base.split(/\s+/).slice(0, 75).join(' ');
}

export function runLocalModeration(draft: CommunityDraft, questions: Question[], submissions: CommunitySubmission[]): ModerationResult {
  const normalizedQuestion = cleanText(draft.question);
  const normalizedOptions = draft.options.map(cleanText);
  const reasons: string[] = [];
  let score = 92;

  if (normalizedQuestion.length < 12 || !normalizedQuestion.includes('?')) {
    score -= 18;
    reasons.push('Question should be clear and phrased as a question.');
  }

  if (normalizedOptions.some(option => option.length < 1)) {
    score -= 25;
    reasons.push('All four answer choices are required.');
  }

  const uniqueOptions = new Set(normalizedOptions.map(normalizeComparable));
  if (uniqueOptions.size !== 4) {
    score -= 28;
    reasons.push('Answer choices must be unique.');
  }

  if (draft.correctIndex < 0 || draft.correctIndex > 3) {
    score -= 30;
    reasons.push('A valid correct answer must be selected.');
  }

  const questionKey = normalizeComparable(normalizedQuestion);
  const duplicate = questions.find(question => normalizeComparable(question.question) === questionKey)
    || submissions.find(item => normalizeComparable(item.draft.question) === questionKey)?.question;
  if (duplicate) {
    score -= 35;
    reasons.push('A very similar question already exists.');
  }

  const joined = `${normalizedQuestion} ${normalizedOptions.join(' ')}`.toLowerCase();
  if (toxicTerms.some(term => joined.includes(term))) {
    score -= 45;
    reasons.push('Potentially toxic or unsafe wording detected.');
  }

  if (wordCount(draft.explanation) > 80) {
    score -= 10;
    reasons.push('Explanation is longer than 80 words.');
  }

  const previousContributorApprovals = submissions.filter(item =>
    item.draft.contributorEmail &&
    item.draft.contributorEmail === draft.contributorEmail &&
    item.moderation.status === 'auto_approved'
  ).length;
  score += Math.min(6, previousContributorApprovals * 2);

  const finalScore = Math.max(0, Math.min(99, score));
  const status: SubmissionStatus = finalScore >= 78 ? 'auto_approved' : finalScore >= 45 ? 'needs_review' : 'rejected';
  const explanation = cleanText(draft.explanation) || generateExplanation({ ...draft, options: normalizedOptions, question: normalizedQuestion });

  return {
    status,
    score: finalScore,
    recommendation: status === 'auto_approved'
      ? 'Approve automatically and publish now.'
      : status === 'needs_review'
        ? 'Send to manual review before publishing.'
        : 'Reject until the submitter improves the content.',
    reasons: reasons.length ? reasons : ['No major issues detected by the local moderation engine.'],
    normalizedQuestion,
    normalizedOptions,
    explanation,
    duplicateQuestionId: duplicate?.id
  };
}

export function submissionToQuestion(submission: CommunitySubmission): Question {
  const draft = submission.draft;
  const moderation = submission.moderation;
  const options = moderation.normalizedOptions;
  return {
    id: `community-${submission.id}`,
    category: draft.category,
    difficulty: draft.difficulty,
    question: moderation.normalizedQuestion,
    options,
    correctIndex: draft.correctIndex,
    correctAnswer: options[draft.correctIndex],
    explanation: moderation.explanation,
    tags: ['community', draft.language, draft.category]
  };
}

export function createAudit(action: string, target: string, details: string, actor = 'local-admin'): AuditLogEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    actor,
    action,
    target,
    details
  };
}
