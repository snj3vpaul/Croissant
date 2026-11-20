import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTeam } from '../src/team.js';
import { espnSchedule, SENS } from './fixtures.js';

function fakeRes() {
  return { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
}

test('cleanTeam rejects junk and URL tricks', () => {
  assert.throws(() => cleanTeam({ provider: 'evil' }));
  assert.throws(() => cleanTeam({ ...SENS, id: '14/../../x' }));
  assert.throws(() => cleanTeam({ ...SENS, league: 'nhl?x=1' }));
  assert.equal(cleanTeam(SENS).name, 'Ottawa Senators');
});

test('hosted /api/status and /api/ask answer for browser-held teams', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => ({ ok: true, status: 200, json: async () => (String(url).includes('/teams/14/schedule') ? structuredClone(espnSchedule) : {}) });
  try {
    const status = (await import('../api/status.js')).default;
    const res = fakeRes();
    await status({ method: 'POST', url: '/api/status', body: { teams: [SENS] } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body)[0].last.id, '401');

    const ask = (await import('../api/ask.js')).default;
    const r2 = fakeRes();
    await ask({ method: 'POST', url: '/api/ask', body: { question: 'did the sens win', teams: [SENS], timezone: 'America/Toronto' } }, r2);
    assert.match(JSON.parse(r2.body).text, /beat Toronto Maple Leafs 4–2/);

    const r3 = fakeRes();
    await status({ method: 'POST', url: '/api/status', body: { teams: [{ provider: 'evil' }] } }, r3);
    assert.equal(r3.statusCode, 400);
  } finally {
    globalThis.fetch = real;
  }
});
