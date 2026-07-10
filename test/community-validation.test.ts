import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_QUESTION_MIN_LENGTH,
  meaningfulLength,
  shouldShowQuestionHint,
  validateCommunityQuestion
} from '@/lib/community';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('11B — question validation rule', () => {
  it('1. a question under 35 meaningful characters is invalid', () => {
    expect(validateCommunityQuestion('short question here', 'x').questionValid).toBe(false);
  });
  it('2. whitespace is collapsed before counting', () => {
    expect(meaningfulLength('  a' + ' '.repeat(40) + 'b  ')).toBe(3); // "a b"
    expect(meaningfulLength('\n\t hello \t world \n')).toBe(11);
  });
  it('3. a question at exactly 35 characters is valid', () => {
    const q = 'x'.repeat(35);
    expect(meaningfulLength(q)).toBe(COMMUNITY_QUESTION_MIN_LENGTH);
    expect(validateCommunityQuestion(q, 'a').questionValid).toBe(true);
  });
  it('4. a non-empty one-character correct answer remains valid', () => {
    const q = 'x'.repeat(40);
    const v = validateCommunityQuestion(q, 'כ');
    expect(v.answerValid).toBe(true);
    expect(v.canSubmit).toBe(true);
    // short real-world answers stay valid
    expect(validateCommunityQuestion(q, '1948').canSubmit).toBe(true);
    expect(validateCommunityQuestion(q, 'פריז').canSubmit).toBe(true);
  });
  it('an empty/whitespace answer is invalid', () => {
    expect(validateCommunityQuestion('x'.repeat(40), '   ').answerValid).toBe(false);
  });
  it('5. submit is disabled (canSubmit=false) while the question is invalid', () => {
    expect(validateCommunityQuestion('too short', 'answer').canSubmit).toBe(false);
    expect(validateCommunityQuestion('x'.repeat(40), 'answer').canSubmit).toBe(true);
  });
});

describe('11B — validation disclosure', () => {
  it('6. the message is initially hidden (untouched)', () => {
    expect(shouldShowQuestionHint('abc', false)).toBe(false);
  });
  it('7. the message appears only after the field is touched and blurred while too short', () => {
    expect(shouldShowQuestionHint('abc', true)).toBe(true);
  });
  it('8. the message disappears when the question becomes valid', () => {
    expect(shouldShowQuestionHint('x'.repeat(35), true)).toBe(false);
  });
  it('the message stays hidden for an empty field even after blur', () => {
    expect(shouldShowQuestionHint('   ', true)).toBe(false);
  });
});

describe('11B — anonymous submission & no email', () => {
  it('9. the submission POST route requires no auth (anonymous allowed)', () => {
    const route = read('src/app/api/community/submissions/route.ts');
    const post = route.slice(route.indexOf('export async function POST'));
    expect(post.includes('guardApiPermission')).toBe(false);
  });
  it('10. the community form has no email field', () => {
    const tp = read('src/components/TriviaPlatform.tsx');
    const start = tp.indexOf('function CommunitySubmit');
    const form = tp.slice(start, tp.indexOf('function Admin(', start));
    expect(/type="email"|contributorEmail/.test(form)).toBe(false);
    expect(form.includes('community-question-input')).toBe(true);
    expect(form.includes('community-answer-input')).toBe(true);
  });
});

describe('11B — header & auth structure', () => {
  it('11. the header has exactly one unauthenticated account entry', () => {
    const src = read('src/components/trivia/chrome/PublicAuthArea.tsx');
    expect((src.match(/auth-link-button/g) || []).length).toBe(1);
    expect(src.includes('href="/signup"')).toBe(false);
    expect(src.includes('href="/login"')).toBe(true);
  });
  it('12. the unified auth screen exposes both login and signup', () => {
    const login = read('src/app/login/LoginForm.tsx');
    expect(login.includes('signInWithPassword')).toBe(true);
    expect(login.includes('href="/signup"')).toBe(true);
  });
  it('13. forgot password remains available', () => {
    const login = read('src/app/login/LoginForm.tsx');
    expect(login.includes('href="/reset-password"')).toBe(true);
  });
  it('14. the Google sign-in control has a correct accessible name', () => {
    const shell = read('src/app/auth-ui/AuthShell.tsx');
    expect(shell.includes('aria-label={label}')).toBe(true);
    expect(read('src/app/login/LoginForm.tsx').includes('label="כניסה עם Google"')).toBe(true);
  });
  it('15. icon-only controls retain accessible labels', () => {
    expect(/aria-label=\{ui\.signIn\}/.test(read('src/components/trivia/chrome/PublicAuthArea.tsx'))).toBe(true);
    expect(read('src/components/trivia/chrome/LanguageMenu.tsx').includes('aria-label={`Language:')).toBe(true);
    expect(read('src/app/auth-ui/AuthShell.tsx').includes('aria-label="חזרה"')).toBe(true);
    const header = read('src/components/trivia/screens/Header.tsx');
    expect(header.includes('aria-label={t.menu')).toBe(true);
  });
});
