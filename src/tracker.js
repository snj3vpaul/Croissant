// Watches your teams and turns score changes into little nudges:
// kickoff, every score change, and the final whistle.
import { EventEmitter } from 'node:events';
import { allStatuses } from './providers/index.js';
import { perspective } from './match.js';

const LIVE_POLL = 30e3;
const SOON_POLL = 2 * 60e3;
const IDLE_POLL = 15 * 60e3;

export function diff(prev, curr) {
  const events = [];
  for (const s of curr) {
    const before = prev.find((p) => p.team.key === s.team.key);
    if (!before) continue;
    const was = before.live;
    const now = s.live;
    const team = s.team;

    if (now && !was) events.push({ type: 'kickoff', team, match: now });
    if (now && was && now.id === was.id) {
      const a = `${now.home.score}-${now.away.score}`;
      const b = `${was.home.score}-${was.away.score}`;
      if (a !== b) events.push({ type: 'score', team, match: now });
    }
    if (was && !now && s.last?.id === was.id) events.push({ type: 'final', team, match: s.last });
  }
  return events.map((e) => ({ ...e, text: message(e) }));
}

export function message({ type, team, match }) {
  const p = perspective(match, team.id);
  const score = `${p.us.score ?? 0}–${p.them.score ?? 0}`;
  if (type === 'kickoff') return `🥐 ${team.name} vs ${p.them.name} just started!`;
  if (type === 'score') return `🥐 ${team.name} ${score} ${p.them.name} (${match.detail})`;
  const word = { win: 'won', loss: 'lost', draw: 'drew' }[p.outcome] ?? 'finished';
  return `🥐 Final: ${team.name} ${word} ${score} vs ${p.them.name}`;
}

export function nextDelay(statuses, now = Date.now()) {
  if (statuses.some((s) => s.live)) return LIVE_POLL;
  const soon = statuses.some((s) => s.next && Date.parse(s.next.start) - now < 30 * 60e3);
  return soon ? SOON_POLL : IDLE_POLL;
}

export class Tracker extends EventEmitter {
  constructor(getFavorites) {
    super();
    this.getFavorites = getFavorites;
    this.statuses = [];
    this.timer = null;
  }

  async tick() {
    const favs = await this.getFavorites();
    const curr = await allStatuses(favs);
    for (const e of diff(this.statuses, curr)) this.emit('update', e);
    this.statuses = curr;
    this.emit('statuses', curr);
    return curr;
  }

  start() {
    const loop = async () => {
      try {
        await this.tick();
      } catch (err) {
        this.emit('error', err);
      }
      this.timer = setTimeout(loop, nextDelay(this.statuses));
    };
    loop();
    return this;
  }

  // Call after favourites change so the next look is immediate.
  poke() {
    clearTimeout(this.timer);
    this.timer = null;
    this.start();
  }

  stop() {
    clearTimeout(this.timer);
  }
}
