import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as espn from '../src/providers/espn.js';
import { teamStatus } from '../src/providers/index.js';
import { clearCache } from '../src/providers/http.js';
import { answer, detectIntent, findTeams } from '../src/brain/rules.js';
import { diff, nextDelay } from '../src/tracker.js';
import { espnSchedule, espnTeams, tsdbLast, tsdbNext, fakeFetch, SENS, INDIA } from './fixtures.js';

const fetchImpl = fakeFetch({
  '/teams/14/schedule': espnSchedule,
  '/nhl/teams?': espnTeams,
  'eventslast.php?id=134': tsdbLast,
  'eventsnext.php?id=134': tsdbNext,
});
const TZ = 'America/Toronto';

test('ESPN schedule becomes last + next', async () => {
  clearCache();
  const s = await teamStatus(SENS, { fetchImpl });
  assert.equal(s.error, null);
  assert.equal(s.last.id, '401');
  assert.equal(s.last.home.score, '4');
  assert.equal(s.next.id, '402');
  assert.equal(s.live, null);
});

test('TheSportsDB cricket result is parsed', async () => {
  clearCache();
  const s = await teamStatus(INDIA, { fetchImpl });
  assert.equal(s.last.state, 'post');
  assert.equal(s.last.detail, 'India won by 46 runs');
  assert.equal(s.next.venue, 'Adelaide Oval');
});

test('team search ranks exact nicknames first', async () => {
  clearCache();
  const teams = await espn.searchTeams('senators', { fetchImpl });
  assert.equal(teams[0].name, 'Ottawa Senators');
  assert.equal(teams[0].key, 'espn:hockey/nhl:14');
});

test('intents', () => {
  assert.equal(detectIntent('did the sens win?'), 'result');
  assert.equal(detectIntent('when do they play next'), 'next');
  assert.equal(detectIntent("how's the game going right now"), 'live');
  assert.equal(detectIntent(''), 'digest');
});

test('finds teams by alias, nickname and capital abbreviation only', () => {
  assert.deepEqual(findTeams('did the sens win', [SENS, INDIA]), [SENS]);
  assert.deepEqual(findTeams('how did India do', [SENS, INDIA]), [INDIA]);
  assert.deepEqual(findTeams('OTT score?', [SENS]), [SENS]);
  assert.deepEqual(findTeams('i ate a lott of cake', [SENS]), []);
});

test('answers "did the sens win?" from data', async () => {
  clearCache();
  const statuses = [await teamStatus(SENS, { fetchImpl }), await teamStatus(INDIA, { fetchImpl })];
  const r = answer('did the sens win?', statuses, { timezone: TZ });
  assert.equal(r.statuses.length, 1);
  assert.match(r.text, /Ottawa Senators beat Toronto Maple Leafs 4–2/);

  const next = answer('when does india play next', statuses, { timezone: TZ });
  assert.match(next.text, /India visit Australia/);

  const digest = answer('', statuses, { timezone: TZ });
  assert.equal(digest.text.split('\n').length, 2);
});

test('tracker spots kickoff, goals and the final whistle', () => {
  const live = (h, a) => ({
    id: '500', state: 'in', detail: 'P2 10:00', start: new Date().toISOString(),
    home: { id: '14', name: 'Ottawa Senators', score: String(h) }, away: { id: '21', name: 'Toronto Maple Leafs', score: String(a) },
  });
  const pre = [{ team: SENS, live: null, last: null, next: null }];
  const k = [{ team: SENS, live: live(0, 0) }];
  const g = [{ team: SENS, live: live(1, 0) }];
  const f = [{ team: SENS, live: null, last: { ...live(3, 1), state: 'post', detail: 'Final' } }];

  assert.equal(diff(pre, k)[0].type, 'kickoff');
  const goal = diff(k, g)[0];
  assert.equal(goal.type, 'score');
  assert.match(goal.text, /Ottawa Senators 1–0/);
  const fin = diff(g, f)[0];
  assert.equal(fin.type, 'final');
  assert.match(fin.text, /won 3–1/);
  assert.equal(diff(g, g).length, 0);
});

test('polls faster when something is on', () => {
  assert.equal(nextDelay([{ live: {} }]), 30e3);
  assert.equal(nextDelay([{ live: null, next: { start: new Date(Date.now() + 10 * 60e3).toISOString() } }]), 120e3);
  assert.equal(nextDelay([{ live: null, next: null }]), 900e3);
});

test('server serves the companion and config', async () => {
  process.env.CROISSANT_HOME = await mkdtemp(join(tmpdir(), 'croissant-'));
  const { startServer } = await import('../src/server.js');
  const { server, tracker, url } = await startServer({ port: 0 });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const html = await (await fetch(base + '/')).text();
    assert.match(html, /Croissant/);
    const cfg = await (await fetch(base + '/api/config')).json();
    assert.deepEqual(cfg.favorites, []);
    const bad = await fetch(base + '/api/favorites', { method: 'POST', body: JSON.stringify({ team: { provider: 'evil' } }) });
    assert.equal(bad.status, 400);
    const traversal = await fetch(base + '/..%2f..%2fetc/passwd');
    assert.notEqual(traversal.status, 200);
  } finally {
    tracker.stop();
    server.close();
  }
  assert.ok(url);
});
