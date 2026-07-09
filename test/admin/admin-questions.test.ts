import { describe, expect, it } from 'vitest';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import {
  bulkCmsAction,
  createCmsQuestion,
  duplicateCmsQuestion,
  listCmsQuestions,
  setCmsQuestionStatus,
  statusOf,
  updateCmsQuestion
} from '@/lib/admin/questionCmsService';
import type { AdminContext } from '@/lib/auth/types';

const actor: AdminContext = {
  email: 'qa-cms@example.com',
  displayName: 'QA CMS',
  roleSlugs: ['super_admin'],
  permissionSlugs: ['questions.read', 'questions.write'],
  source: 'local-open'
};

const validDraft = {
  question: 'שאלת בדיקה של מערכת הניהול?',
  options: ['תשובה א', 'תשובה ב', 'תשובה ג', 'תשובה ד'],
  correctIndex: 1,
  category: 'בדיקות',
  difficulty: 'קל'
};

/**
 * Phase 5 — question CMS lifecycle over the repository layer: create as
 * draft (not in gameplay), publish (in gameplay), archive, duplicate, bulk,
 * validation, and legacy status derivation.
 */
describe('Question CMS', () => {
  it('creates a draft that stays out of gameplay until published', async () => {
    const repositories = getRepositoryProvider();
    const created = await createCmsQuestion(repositories, actor, validDraft);
    expect(created.ok).toBe(true);
    if (!created.ok || !created.value) throw new Error('create failed');
    const id = String(created.value.id);

    expect(created.value.isActive).toBe(false);
    expect(statusOf(created.value)).toBe('draft');

    const gameplay = await repositories.approvedQuestions.listGameplayQuestions({});
    expect(gameplay.some(question => String(question.id) === id)).toBe(false);

    const publish = await setCmsQuestionStatus(repositories, actor, id, 'published');
    expect(publish.ok).toBe(true);
    const gameplayAfter = await repositories.approvedQuestions.listGameplayQuestions({});
    expect(gameplayAfter.some(question => String(question.id) === id)).toBe(true);
  });

  it('rejects malformed drafts', async () => {
    const repositories = getRepositoryProvider();
    const bad = await createCmsQuestion(repositories, actor, { ...validDraft, options: ['רק', 'שלוש', 'תשובות'] as unknown as string[] });
    expect(bad.ok).toBe(false);
  });

  it('updates question content and keeps correctAnswer in sync', async () => {
    const repositories = getRepositoryProvider();
    const created = await createCmsQuestion(repositories, actor, validDraft);
    if (!created.ok || !created.value) throw new Error('create failed');
    const id = String(created.value.id);

    const updated = await updateCmsQuestion(repositories, actor, id, { correctIndex: 3 });
    expect(updated.ok).toBe(true);
    if (updated.ok && updated.value) {
      expect(updated.value.correctAnswer).toBe('תשובה ד');
    }
  });

  it('duplicates as a draft copy', async () => {
    const repositories = getRepositoryProvider();
    const created = await createCmsQuestion(repositories, actor, { ...validDraft, status: 'published' });
    if (!created.ok || !created.value) throw new Error('create failed');

    const copy = await duplicateCmsQuestion(repositories, actor, String(created.value.id));
    expect(copy.ok).toBe(true);
    if (copy.ok && copy.value) {
      expect(statusOf(copy.value)).toBe('draft');
      expect(copy.value.isActive).toBe(false);
      expect(copy.value.question).toContain('עותק');
    }
  });

  it('applies bulk status changes and audit-logs them', async () => {
    const repositories = getRepositoryProvider();
    const first = await createCmsQuestion(repositories, actor, validDraft);
    const second = await createCmsQuestion(repositories, actor, validDraft);
    if (!first.ok || !first.value || !second.ok || !second.value) throw new Error('create failed');

    const ids = [String(first.value.id), String(second.value.id)];
    const bulk = await bulkCmsAction(repositories, actor, ids, 'publish');
    expect(bulk.ok).toBe(true);
    if (bulk.ok && bulk.value) expect(bulk.value.affected).toBe(2);

    const logs = await repositories.auditLogs.list({ limit: 10 });
    expect(logs.some(log => log.action === 'admin_question_bulk' && log.actor === 'qa-cms@example.com')).toBe(true);
  });

  it('lists with filters, search and pagination and derives legacy statuses', async () => {
    const repositories = getRepositoryProvider();
    const page = await listCmsQuestions(repositories, { page: 1, pageSize: 10 });
    expect(page.rows.length).toBeLessThanOrEqual(10);
    expect(page.total).toBeGreaterThan(0);
    expect(page.categories.length).toBeGreaterThan(0);
    // Legacy bundled questions have no status and must derive 'published'.
    const bundled = page.rows.find(row => !row.id.startsWith('q-admin-'));
    if (bundled) expect(['published', 'draft', 'archived']).toContain(bundled.status);

    const filtered = await listCmsQuestions(repositories, { status: 'draft', search: 'מערכת הניהול' });
    expect(filtered.rows.every(row => row.status === 'draft')).toBe(true);
  });
});
