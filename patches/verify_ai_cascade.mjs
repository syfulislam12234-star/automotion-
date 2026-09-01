/**
 * AI Cascade verification harness (zero-break safeguard).
 *
 * Bundles server/aiFailoverEngine.ts + server/keyStore.ts with esbuild and runs mocked
 * `fetch` scenarios that prove:
 *   1. Strict provider isolation — Gemini routes never receive Llama/OpenAI model strings.
 *   2. HTTP 429 (quota) → instant key cooldown + rotation, no retry storm.
 *   3. HTTP 404 (model not found) → instant key+model pair cooldown.
 *   4. System fallback AI key pool when every user key fails.
 *
 * Run: node patches/verify_ai_cascade.mjs
 */

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TMP = path.join(ROOT, 'patches', '.verify_tmp');

let passed = 0;
let failed = 0;
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const entry = path.join(TMP, 'entry.ts');
  fs.writeFileSync(
    entry,
    "export { FailoverEngine } from '../../server/aiFailoverEngine';\nexport { GlobalApiKeyStore } from '../../server/keyStore';\n",
  );

  const outfile = path.join(TMP, 'engine.mjs');
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'silent',
  });

  // --- Mocked global fetch (the bundled engine resolves `fetch` at call time) ---
  const calls = [];
  let behavior = () => ({ status: 500, payload: {} });
  globalThis.fetch = async (url, init) => {
    const urlText = String(url);
    const rawBody = init && typeof init.body === 'string' ? init.body : '{}';
    let body = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = {};
    }
    const headers = (init && init.headers) || {};
    const authorization = typeof headers.Authorization === 'string' ? headers.Authorization : '';
    calls.push({ url: urlText, body, authorization });
    const result = behavior(urlText, body, authorization);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.payload,
    };
  };
  const geminiModelFromUrl = (url) => decodeURIComponent((url.match(/\/models\/([^:?]+):/) || [])[1] || '');
  const geminiKeyFromUrl = (url) => decodeURIComponent((url.match(/[?&]key=([^&]+)/) || [])[1] || '');
  const groqModelFromBody = (body) => String(body?.model || '');

  const { FailoverEngine, GlobalApiKeyStore } = await import(`file://${outfile.replace(/\\/g, '/')}`);

  const GEMINI_OK = (text) => ({ status: 200, payload: { candidates: [{ content: { parts: [{ text }] } }] } });
  const GROQ_OK = (text) => ({ status: 200, payload: { choices: [{ message: { content: text } }] } });
  const GEMINI_CALLS = () => calls.filter((call) => call.url.includes('generativelanguage.googleapis.com'));
  const GROQ_CALLS = () => calls.filter((call) => call.url.includes('api.groq.com'));

  // Register stable groq keys so every scenario has a working landing provider.
  GlobalApiKeyStore.register('groq', 'gsk_stable_groq_key_0001', 'runtime');
  GlobalApiKeyStore.register('groq', 'gsk_stable_groq_key_0002', 'runtime');

  // ---------------------------------------------------------------- Scenario 1
  console.log('\n[1] Strict isolation — Gemini routes only receive Gemini identifiers');
  GlobalApiKeyStore.register('google', 'AIza_isolation_user_key_1', 'runtime');
  calls.length = 0;
  behavior = (url) => {
    if (url.includes('generativelanguage')) return GEMINI_OK('gemini-ok');
    if (url.includes('api.groq.com')) return GROQ_OK('groq-ok');
    return { status: 404, payload: {} };
  };
  const iso = await FailoverEngine.generate(
    [{ role: 'user', content: 'hello' }],
    { preferredProvider: 'google', preferredModel: 'llama-3.3-70b-versatile', maxModelsPerRoute: 3 },
  );
  check('request served by Google Gemini route', iso?.providerId === 'google', JSON.stringify(iso?.providerId));
  check('Gemini response model is a valid Gemini id', /^gemini-[a-z0-9.\-]+$/.test(iso?.model || ''), iso?.model);
  check('NO Llama/OpenAI string ever sent to Gemini', GEMINI_CALLS().every((call) => /^gemini-[a-z0-9.\-]+$/.test(geminiModelFromUrl(call.url))), JSON.stringify(GEMINI_CALLS().map((call) => geminiModelFromUrl(call.url))));
  check('preferred Llama model silently dropped', iso?.model === 'gemini-2.5-flash', iso?.model);

  // ---------------------------------------------------------------- Scenario 2
  console.log('\n[2] Strict isolation — Groq routes only receive Groq identifiers');
  calls.length = 0;
  const groqIso = await FailoverEngine.generate(
    [{ role: 'user', content: 'hello' }],
    { preferredProvider: 'groq', preferredModel: 'gemini-2.5-flash', maxModelsPerRoute: 3 },
  );
  check('request served by Groq route', groqIso?.providerId === 'groq', JSON.stringify(groqIso?.providerId));
  check('Groq response model is a valid Groq id', ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-8b-8192', 'mixtral-8x7b-32768'].includes(groqIso?.model || ''), groqIso?.model);
  check('NO Gemini string ever sent to Groq', GROQ_CALLS().every((call) => !/gemini/i.test(groqModelFromBody(call.body))), JSON.stringify(GROQ_CALLS().map((call) => groqModelFromBody(call.body))));

  // ---------------------------------------------------------------- Scenario 3
  console.log('\n[3] HTTP 429 quota → instant key cooldown + clean provider rotation');
  GlobalApiKeyStore.register('google', 'AIza_quota_dead_key_0001', 'runtime');
  calls.length = 0;
  behavior = (url) => {
    if (url.includes('generativelanguage')) return { status: 429, payload: { error: { message: 'Resource exhausted (quota)' } } };
    if (url.includes('api.groq.com')) return GROQ_OK('groq-after-429');
    return { status: 404, payload: {} };
  };
  const q1 = await FailoverEngine.generate([{ role: 'user', content: 'hello' }], { preferredProvider: 'google' });
  const geminiCallsAfter429 = GEMINI_CALLS().length;
  check('user request still answered (rotated to Groq)', q1?.providerId === 'groq' && q1?.text === 'groq-after-429', JSON.stringify(q1?.providerId));
  check('no retry storm — one attempt per key, then instant rotation', geminiCallsAfter429 === 2, String(geminiCallsAfter429));
  const q2 = await FailoverEngine.generate([{ role: 'user', content: 'hello again' }], { preferredProvider: 'google' });
  check('quota-cooled keys skipped in memory on the next request (zero latency)', GEMINI_CALLS().length === geminiCallsAfter429, `before=${geminiCallsAfter429} after=${GEMINI_CALLS().length}`);
  check('second request served without the dead key', q2?.providerId === 'groq', JSON.stringify(q2?.providerId));

  // ---------------------------------------------------------------- Scenario 4
  console.log('\n[4] HTTP 404 model-not-found → key+model pair cooldown, key stays usable');
  GlobalApiKeyStore.register('google', 'AIza_pair404_key_0001', 'runtime');
  calls.length = 0;
  behavior = (url) => {
    if (url.includes('generativelanguage')) return { status: 404, payload: { error: { message: 'models/... is not found for API version v1beta' } } };
    if (url.includes('api.groq.com')) return GROQ_OK('groq-after-404');
    return { status: 500, payload: {} };
  };
  const p1 = await FailoverEngine.generate([{ role: 'user', content: 'hello' }], { preferredProvider: 'google', maxModelsPerRoute: 3 });
  const geminiCallsAfter404 = GEMINI_CALLS().length;
  const triedModels = GEMINI_CALLS().map((call) => geminiModelFromUrl(call.url));
  check('rotation landed on Groq after Gemini 404s', p1?.providerId === 'groq', JSON.stringify(p1?.providerId));
  check('each available Gemini key+model pair tried exactly once (no duplicate retries)', geminiCallsAfter404 === 3 && new Set(triedModels).size === 3, `${geminiCallsAfter404} calls, models=${JSON.stringify(triedModels)}`);
  const p2 = await FailoverEngine.generate([{ role: 'user', content: 'hello' }], { preferredProvider: 'google', maxModelsPerRoute: 3 });
  check('404-cooled key+model pairs skipped instantly next time', GEMINI_CALLS().length === geminiCallsAfter404, `before=${geminiCallsAfter404} after=${GEMINI_CALLS().length}`);
  check('pair cooldown did not poison the whole route (zero-break)', p2?.providerId === 'groq', JSON.stringify(p2?.providerId));

  // ---------------------------------------------------------------- Scenario 5
  console.log('\n[5] System fallback AI key pool when every user key fails');
  for (const name of ['GEMINI_API_KEY', 'GOOGLE_AI_KEY', 'GOOGLE_API_KEY', 'GROQ_API_KEY']) delete process.env[name];
  const SYSTEM_KEY = 'AIza_system_fallback_key_01';
  process.env.GEMINI_API_KEY = SYSTEM_KEY;
  calls.length = 0;
  behavior = (url) => {
    if (url.includes('generativelanguage')) {
      return geminiKeyFromUrl(url) === SYSTEM_KEY ? GEMINI_OK('system-fallback-ok') : { status: 429, payload: {} };
    }
    if (url.includes('api.groq.com')) return { status: 429, payload: {} };
    return { status: 500, payload: {} };
  };
  const sys = await FailoverEngine.generate([{ role: 'user', content: 'hello' }], { preferredProvider: 'google', maxModelsPerRoute: 3 });
  check('all user keys failing → system fallback pool served the request', Boolean(sys?.text), JSON.stringify(sys?.providerName || null));
  check('result tagged as system fallback', /system fallback/i.test(sys?.providerName || ''), sys?.providerName);
  const systemCalls = GEMINI_CALLS().filter((call) => geminiKeyFromUrl(call.url) === SYSTEM_KEY);
  check('system env key actually used with a valid Gemini model', systemCalls.length > 0 && /^gemini-/.test(geminiModelFromUrl(systemCalls[0].url)), String(systemCalls.length));
  delete process.env.GEMINI_API_KEY;

  // ---------------------------------------------------------------- Scenario 6
  console.log('\n[6] Pool diagnostics snapshot still healthy');
  const snapshot = FailoverEngine.getPoolSnapshot();
  check('snapshot exposes routes', Array.isArray(snapshot?.routes) && snapshot.routes.length > 0, String(snapshot?.routes?.length));
  check('snapshot exposes key counts', Number.isInteger(snapshot?.totalKeys) && snapshot.totalKeys > 0, String(snapshot?.totalKeys));

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error('Harness crashed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      fs.rmSync(TMP, { recursive: true, force: true });
    } catch {}
  });
