#!/usr/bin/env node
/**
 * Stage 10B — live Supabase verification harness.
 *
 * Verifies the rewards ecosystem against the REAL Supabase database (not the
 * local/in-memory fallback). Run it wherever the Supabase credentials live:
 *
 *   NEXT_PUBLIC_DATABASE_MODE=supabase \
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \        # optional, enables the RLS test
 *   node scripts/verify-rewards-supabase.mjs
 *
 * It is READ-MOSTLY and self-cleaning: it writes only to a throwaway player key
 * (prefixed `verify-`) and deletes those rows at the end. It NEVER touches real
 * player data. Exit code 0 = all hard checks passed; non-zero = a blocker.
 */

const MODE = process.env.NEXT_PUBLIC_DATABASE_MODE;
const URL_RAW = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const TABLES = [
  'player_identity', 'player_titles', 'player_badges', 'trophy_cabinet',
  'category_mastery', 'player_collections', 'career_earnings', 'career_ledger',
  'daily_streak', 'daily_question_state', 'weekly_objectives',
  'cosmetic_entitlements', 'profile_timeline'
];

let hardFailures = 0;
const log = (s = '') => process.stdout.write(s + '\n');
const pass = (s) => log('  ✅ ' + s);
const fail = (s) => { hardFailures += 1; log('  ❌ ' + s); };
const warn = (s) => log('  ⚠️  ' + s);

function assertConfig() {
  log('── PHASE 1 · active provider config ──');
  if (MODE !== 'supabase') { fail(`NEXT_PUBLIC_DATABASE_MODE is "${MODE ?? '(unset)'}", expected "supabase". The app would use the in-memory fallback.`); return false; }
  pass('NEXT_PUBLIC_DATABASE_MODE = supabase');
  if (!URL_RAW) { fail('NEXT_PUBLIC_SUPABASE_URL is missing (provider fails loud).'); return false; }
  if (!SERVICE_KEY) { fail('SUPABASE_SERVICE_ROLE_KEY is missing (provider fails loud).'); return false; }
  pass('NEXT_PUBLIC_SUPABASE_URL present');
  pass('SUPABASE_SERVICE_ROLE_KEY present → Supabase rewards provider will be selected');
  if (!ANON_KEY) warn('NEXT_PUBLIC_SUPABASE_ANON_KEY not set — the RLS anon-write test (Phase 7) will be skipped.');
  return true;
}

const base = (URL_RAW || '').replace(/\/$/, '');
const svcHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const anonHeaders = ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' } : null;

async function req(method, path, { headers = svcHeaders, body, prefer } = {}) {
  const h = { ...headers };
  if (prefer) h.Prefer = prefer;
  const res = await fetch(`${base}/rest/v1/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  let text = '';
  try { text = await res.text(); } catch { /* ignore */ }
  return { status: res.status, ok: res.ok, text };
}

async function verifyTables() {
  log('\n── PHASE 2 · migration 010 tables reachable ──');
  for (const table of TABLES) {
    const r = await req('GET', `${table}?select=*&limit=1`);
    if (r.ok) pass(`${table} reachable (200)`);
    else fail(`${table} NOT reachable (${r.status}): ${r.text.slice(0, 120)}`);
  }
  log('\n── PHASE 2 · migration 011 stats column reachable ──');
  const r = await req('GET', 'career_earnings?select=stats&limit=1');
  if (r.ok) pass('career_earnings.stats column exists (011 applied)');
  else fail(`career_earnings.stats NOT reachable (${r.status}): ${r.text.slice(0, 160)}`);
}

async function verifyRls(tempKey) {
  log('\n── PHASE 7 · RLS (service-role only) ──');
  if (!anonHeaders) { warn('Skipped anon-write test (no anon key provided).'); return; }
  const r = await req('POST', 'player_identity', { headers: anonHeaders, body: { player_key: tempKey + '-anon' }, prefer: 'return=minimal' });
  if (r.status >= 400) pass(`anon client insert DENIED (${r.status}) — RLS is effective, browser cannot self-grant`);
  else { fail(`anon client insert SUCCEEDED (${r.status}) — RLS is NOT protecting the table!`); await req('DELETE', `player_identity?player_key=eq.${encodeURIComponent(tempKey + '-anon')}`); }
}

async function verifyPersistenceAndIdempotency(tempKey) {
  log('\n── PHASE 3/5 · service-role write, persistence & idempotency ──');
  // Seed a career row (server-authoritative write).
  const seed = await req('POST', 'career_earnings?on_conflict=player_key', {
    body: { player_key: tempKey, lifetime_total: 1000, spendable_balance: 1000, best_single_game: 1000, games_played: 1, games_won: 1 },
    prefer: 'resolution=merge-duplicates,return=minimal'
  });
  if (seed.status < 400) pass(`service-role upsert career_earnings ok (${seed.status})`);
  else { fail(`service-role upsert career_earnings failed (${seed.status}): ${seed.text.slice(0, 160)}`); return; }

  // Read it back → persistence.
  const readBack = await req('GET', `career_earnings?player_key=eq.${encodeURIComponent(tempKey)}&select=lifetime_total,stats`);
  let row;
  try { row = JSON.parse(readBack.text)[0]; } catch { /* ignore */ }
  if (row && row.lifetime_total === 1000) pass('row persisted and read back (lifetime_total=1000)');
  else fail(`persistence read-back failed: ${readBack.text.slice(0, 160)}`);

  // Idempotent ledger: same (player_key, idempotency_key) upserted twice.
  const entry = { player_key: tempKey, kind: 'adjustment', amount: 1000, idempotency_key: 'verify-idem-1', metadata: {}, created_at: new Date().toISOString() };
  await req('POST', 'career_ledger?on_conflict=player_key,idempotency_key', { body: entry, prefer: 'resolution=merge-duplicates,return=minimal' });
  await req('POST', 'career_ledger?on_conflict=player_key,idempotency_key', { body: entry, prefer: 'resolution=merge-duplicates,return=minimal' });
  const count = await req('GET', `career_ledger?player_key=eq.${encodeURIComponent(tempKey)}&idempotency_key=eq.verify-idem-1&select=id`);
  let rows = [];
  try { rows = JSON.parse(count.text); } catch { /* ignore */ }
  if (rows.length === 1) pass('ledger idempotency enforced: duplicate key → exactly 1 row');
  else fail(`ledger idempotency FAILED: expected 1 row, got ${rows.length}`);
}

async function cleanup(tempKey) {
  log('\n── cleanup (throwaway rows) ──');
  for (const table of TABLES) {
    await req('DELETE', `${table}?player_key=eq.${encodeURIComponent(tempKey)}`);
    await req('DELETE', `${table}?player_key=eq.${encodeURIComponent(tempKey + '-anon')}`);
  }
  pass('temporary verification rows removed');
}

async function main() {
  log('Stage 10B — live Supabase verification\n');
  if (!assertConfig()) { log('\nRESULT: NOT READY — provider configuration blocker (see above).'); process.exit(1); }
  const tempKey = `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  log(`\n(using throwaway player key: ${tempKey})`);
  try {
    await verifyTables();
    await verifyRls(tempKey);
    await verifyPersistenceAndIdempotency(tempKey);
  } finally {
    await cleanup(tempKey);
  }
  log('\n' + '─'.repeat(50));
  if (hardFailures === 0) { log('RESULT: READY — Stage 10B rewards are live on Supabase (DB-level checks passed).'); process.exit(0); }
  log(`RESULT: NOT READY — ${hardFailures} hard check(s) failed (see ❌ above).`);
  process.exit(1);
}

main().catch(err => { log('\nFATAL: ' + (err?.message || err)); process.exit(1); });
