import assert from 'node:assert/strict';

import { GEMINI_MODELS, generateGeminiContent } from '../api/gemini.js';
import { getLocalDayRange, loggedAtForDate, toLocalDateKey } from '../src/utils/date.js';

assert.deepEqual(GEMINI_MODELS, [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
], 'Gemini should prefer the fastest free-tier Flash-Lite model');

const originalFetch = globalThis.fetch;
const originalAbortController = globalThis.AbortController;
let requestedUrl = '';

globalThis.fetch = async (url, options) => {
  requestedUrl = String(url);
  assert.equal(options.signal instanceof AbortSignal, true);
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: 'fast response' }] } }],
    }),
  };
};

try {
  const text = await generateGeminiContent('hello');
  assert.equal(text, 'fast response');
  assert.match(requestedUrl, /models\/gemini-3\.5-flash-lite:generateContent/);
} finally {
  globalThis.fetch = originalFetch;
  globalThis.AbortController = originalAbortController;
}

const today = new Date(2026, 10, 19, 9, 30);
assert.equal(toLocalDateKey(today), '2026-11-19');
const range = getLocalDayRange('2026-11-18');
assert.equal(range.start.getFullYear(), 2026);
assert.equal(range.start.getMonth(), 10);
assert.equal(range.start.getDate(), 18);
assert.equal(range.end.getDate(), 19);

const historicalTime = loggedAtForDate('2026-11-18');
assert.equal(historicalTime.getHours(), 12);
