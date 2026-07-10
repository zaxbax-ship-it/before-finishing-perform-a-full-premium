import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/config')>()),
  isAuthEnforced: vi.fn().mockReturnValue(false)
}));
vi.mock('@/lib/auth/session', () => ({ getAuthUser: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/auth/adminAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/adminAccess')>()),
  resolveAdminContextForUser: vi.fn().mockResolvedValue(null),
  openLocalAdminContext: vi.fn().mockResolvedValue({
    email: 'local-admin', displayName: 'Local Admin', roleSlugs: ['super_admin'],
    permissionSlugs: ['submissions.read', 'submissions.review'], source: 'local-open'
  })
}));

import { createMockLocalAiModerationProvider } from '@/lib/ai/moderation/providers/mockLocalProvider';
import type { CommunityDraft } from '@/lib/community';
import type { Question } from '@/lib/types';
import { POST as createSubmission } from '@/app/api/community/submissions/route';
import { PATCH as reviewSubmission } from '@/app/api/community/submissions/[id]/route';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';

const bank: Question[] = [
  { id: 'q1', category: 'מדע', difficulty: 'בינוני', question: 'מהו היסוד הקל ביותר?', options: ['מימן', 'חמצן', 'פחמן', 'ברזל'], correctIndex: 0, correctAnswer: 'מימן', explanation: '', tags: [] },
  { id: 'q2', category: 'מדע', difficulty: 'בינוני', question: 'כמה כוכבי לכת במערכת השמש?', options: ['8', '7', '9', '10'], correctIndex: 0, correctAnswer: '8', explanation: '', tags: [] },
  { id: 'q3', category: 'גאוגרפיה', difficulty: 'קל', question: 'מהי בירת צרפת?', options: ['פריז', 'לונדון', 'רומא', 'מדריד'], correctIndex: 0, correctAnswer: 'פריז', explanation: '', tags: [] },
  { id: 'q4', category: 'גאוגרפיה', difficulty: 'קל', question: 'מהי בירת ספרד?', options: ['מדריד', 'פריז', 'רומא', 'ברלין'], correctIndex: 0, correctAnswer: 'מדריד', explanation: '', tags: [] },
  { id: 'q5', category: 'ספורט', difficulty: 'קשה', question: 'כמה שחקנים בקבוצת כדורגל?', options: ['11', '10', '9', '12'], correctIndex: 0, correctAnswer: '11', explanation: '', tags: [] }
];

function seed(question: string, correctAnswer: string): CommunityDraft {
  return { question, options: [correctAnswer, '', '', ''], correctIndex: 0, category: '', difficulty: '', language: 'he', explanation: '', contributorName: '', contributorEmail: '' };
}

describe('Stage 11 AI editorial pipeline', () => {
  const provider = createMockLocalAiModerationProvider();

  it('generates exactly three distinct wrong answers and a complete game-ready question', async () => {
    const out = await provider.moderate({ draft: seed('מהי בירת איטליה', 'רומא'), existingQuestions: bank, existingSubmissions: [] });
    expect(out.generatedWrongAnswers).toHaveLength(3);
    expect(out.improvedOptions).toHaveLength(4);
    expect(new Set(out.improvedOptions.map(o => o.toLowerCase())).size).toBe(4);
    expect(out.improvedOptions[out.correctIndex]).toBe(out.correctAnswer);
    expect(out.correctAnswer).toBe('רומא');
    expect(out.category.trim().length).toBeGreaterThan(0);
    expect(out.difficulty.trim().length).toBeGreaterThan(0);
    expect(out.explanation.trim().length).toBeGreaterThan(0);
  });

  it('NEVER auto-approves — always routes to human review', async () => {
    const out = await provider.moderate({ draft: seed('מהי בירת יוון', 'אתונה'), existingQuestions: bank, existingSubmissions: [] });
    expect(out.moderation.status).toBe('needs_review');
    expect(out.moderation.status).not.toBe('auto_approved');
    expect(out.moderation.original).toEqual({ question: 'מהי בירת יוון', correctAnswer: 'אתונה' });
  });

  it('improves the question wording (adds a question mark) and normalizes the answer', async () => {
    const out = await provider.moderate({ draft: seed('מהי בירת פורטוגל', 'ליסבון.'), existingQuestions: bank, existingSubmissions: [] });
    expect(out.improvedQuestion.endsWith('?')).toBe(true);
    expect(out.correctAnswer).toBe('ליסבון');
  });

  it('detects a duplicate of an existing question', async () => {
    const out = await provider.moderate({ draft: seed('מהי בירת צרפת?', 'פריז'), existingQuestions: bank, existingSubmissions: [] });
    expect(out.qualitySignals.duplicateRisk).toBeGreaterThanOrEqual(90);
  });

  it('is deterministic for the same submission', async () => {
    const a = await provider.moderate({ draft: seed('מהי בירת גרמניה', 'ברלין'), existingQuestions: bank, existingSubmissions: [] });
    const b = await provider.moderate({ draft: seed('מהי בירת גרמניה', 'ברלין'), existingQuestions: bank, existingSubmissions: [] });
    expect(a.improvedOptions).toEqual(b.improvedOptions);
  });
});

describe('Stage 11 submission workflow — no auto-publish', () => {
  afterEach(() => vi.clearAllMocks());

  it('POST creates a needs_review submission and never publishes to the game', async () => {
    const repositories = getRepositoryProvider();
    const before = (await repositories.approvedQuestions.list({ limit: 2000 })).length;

    const request = new Request('http://localhost/api/community/submissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'מיהו מחבר האודיסאה', correctAnswer: 'הומרוס', language: 'he' })
    });
    const response = await createSubmission(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, status: 'received' });

    const after = (await repositories.approvedQuestions.list({ limit: 2000 })).length;
    expect(after).toBe(before); // nothing auto-published

    const submissions = await repositories.submissions.list({ limit: 50 });
    const created = submissions.find(s => s.moderation.original?.correctAnswer === 'הומרוס');
    expect(created?.moderation.status).toBe('needs_review');
    expect(created?.draft.options).toHaveLength(4);
  });

  it('admin approval with edits publishes the edited question', async () => {
    const repositories = getRepositoryProvider();
    const request = new Request('http://localhost/api/community/submissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'מהי בירת יפן', correctAnswer: 'טוקיו', language: 'he' })
    });
    await createSubmission(request);
    const submission = (await repositories.submissions.list({ limit: 50 })).find(s => s.moderation.original?.correctAnswer === 'טוקיו');
    expect(submission).toBeDefined();

    const editedQuestion = 'מהי עיר הבירה של יפן?';
    const patch = new Request(`http://localhost/api/community/submissions/${submission!.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', edited: { question: editedQuestion, options: ['טוקיו', 'סיאול', 'בייג׳ינג', 'בנגקוק'], correctIndex: 0, category: 'גאוגרפיה', difficulty: 'קל', explanation: 'בירת יפן היא טוקיו.' } })
    });
    const patchResponse = await reviewSubmission(patch, { params: Promise.resolve({ id: submission!.id }) });
    const patchBody = await patchResponse.json();
    expect(patchResponse.status).toBe(200);
    expect(patchBody.submission.moderation.status).toBe('approved');

    const published = (await repositories.approvedQuestions.list({ limit: 2000 })).find(q => q.question === editedQuestion);
    expect(published).toBeDefined();
    expect(published?.correctAnswer).toBe('טוקיו');
  });
});
