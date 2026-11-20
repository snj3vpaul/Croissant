// The default brain: no model, no keys, no network beyond the score APIs.
// It understands the handful of things people actually ask about their teams.
import { perspective, formatKickoff } from '../match.js';

const INTENTS = [
  ['next', /\b(next|when|upcoming|schedule|fixture|play(ing)?|tonight|tomorrow|kick ?off|face ?off|tip ?off|start)\b/i],
  ['live', /\b(live|now|right now|currently|on now|how('s| is| are)|winning|losing)\b/i],
  ['result', /\b(win|won|lose|lost|beat|result|score|final|did|last|yesterday)\b/i],
];

export function detectIntent(text) {
  for (const [name, re] of INTENTS) if (re.test(text)) return name;
  return 'digest';
}

const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function findTeams(text, favorites) {
  const t = ` ${norm(text)} `;
  return favorites.filter((f) => {
    const names = [f.name, f.short, f.nickname, f.location, ...(f.aliases ?? [])].filter(Boolean).map(norm);
    if (names.some((n) => n.length > 2 && t.includes(` ${n} `))) return true;
    // Abbreviations only count when written in capitals ("OTT"), so "la" or "sea" don't misfire.
    return f.abbr && f.abbr.length >= 2 && new RegExp(`\\b${f.abbr}\\b`).test(text);
  });
}

const VERDICT = {
  win: ['Fresh out of the oven:', 'Golden and flaky:', 'Warm news:'],
  loss: ['A little burnt, sorry:', 'Oof, not our bake:', 'Crumbs:'],
  draw: ['Even split down the middle:'],
};
const end = (s) => (s.endsWith('.') ? s : s + '.');
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

function resultLine(m, team, tz) {
  const p = perspective(m, team.id);
  const verb = p.outcome === 'win' ? 'beat' : p.outcome === 'loss' ? 'lost to' : 'drew with';
  const score = `${p.us.score}–${p.them.score}`;
  const when = formatKickoff(m.start, tz);
  const extra = m.detail && !/^(final|ft|full time)$|\b(won|beat|drawn|tied)\b/i.test(m.detail) ? ` (${m.detail})` : '';
  return end(`${pick(VERDICT[p.outcome] ?? VERDICT.draw, Number(m.id) || 0)} ${team.name} ${verb} ${p.them.name} ${score}${extra} — ${when}`);
}

function liveLine(m, team) {
  const p = perspective(m, team.id);
  const mood = { leading: 'and leading', trailing: 'and trailing', level: 'and all square' }[p.outcome] ?? '';
  return `In the oven right now: ${team.name} vs ${p.them.name}, ${p.us.score ?? 0}–${p.them.score ?? 0} ${mood} (${m.detail}).`;
}

function nextLine(m, team, tz) {
  const p = perspective(m, team.id);
  const where = p.home ? 'host' : 'visit';
  return end(`Next up: ${team.name} ${where} ${p.them.name} on ${formatKickoff(m.start, tz)}${m.venue ? ` at ${m.venue}` : ''}`);
}

export function describe(status, intent, tz) {
  const { team, live, last, next, error } = status;
  if (error) return `I couldn't reach the scores for ${team.name} just now (${error}).`;
  const lines = [];
  if (live) lines.push(liveLine(live, team));
  if (intent === 'next') {
    lines.push(next ? nextLine(next, team, tz) : `Nothing on the schedule for ${team.name} yet.`);
  } else if (intent === 'live') {
    if (!live) lines.push(`${team.name} aren't playing right now.`, next ? nextLine(next, team, tz) : '');
  } else if (intent === 'result') {
    if (!live) lines.push(last ? resultLine(last, team, tz) : `No recent result for ${team.name}.`);
  } else {
    if (!live && last) lines.push(resultLine(last, team, tz));
    if (next) lines.push(nextLine(next, team, tz));
    if (!live && !last && !next) lines.push(`Nothing recent or upcoming for ${team.name}.`);
  }
  return lines.filter(Boolean).join(' ');
}

export function answer(question, statuses, { timezone } = {}) {
  const intent = detectIntent(question);
  const favs = statuses.map((s) => s.team);
  const wanted = findTeams(question, favs);
  const chosen = wanted.length ? statuses.filter((s) => wanted.includes(s.team)) : statuses;
  if (!statuses.length) {
    return { text: "I don't know your teams yet! Add one with `croissant add <team>` or the search box.", statuses: [] };
  }
  return { text: chosen.map((s) => describe(s, intent, timezone)).join('\n'), statuses: chosen, intent };
}
