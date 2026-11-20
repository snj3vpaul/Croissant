// ESPN's public (unofficial, keyless) site API. Great coverage for North American
// leagues and the big European football leagues, with live in-game status.
import { getJSON } from './http.js';
import { ESPN_LEAGUES, leagueLabel } from '../leagues.js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const DAY = 24 * 3600e3;

function scoreOf(c) {
  const s = c?.score;
  if (s == null || s === '') return null;
  if (typeof s === 'object') return s.displayValue ?? (s.value != null ? String(s.value) : null);
  return String(s);
}

function side(c) {
  const t = c?.team ?? {};
  return {
    id: String(t.id ?? ''),
    name: t.displayName ?? t.name ?? '?',
    short: t.shortDisplayName ?? t.name ?? t.displayName,
    abbr: t.abbreviation ?? '',
    logo: t.logo ?? t.logos?.[0]?.href ?? null,
    score: scoreOf(c),
    winner: typeof c?.winner === 'boolean' ? c.winner : null,
  };
}

export function normalizeEvent(ev, sport, league) {
  const comp = ev.competitions?.[0] ?? {};
  const cs = comp.competitors ?? [];
  const home = cs.find((c) => c.homeAway === 'home') ?? cs[0];
  const away = cs.find((c) => c.homeAway === 'away') ?? cs[1];
  const st = comp.status?.type ?? ev.status?.type ?? {};
  return {
    id: String(ev.id),
    provider: 'espn',
    sport,
    league: leagueLabel(sport, league),
    start: ev.date ?? comp.date,
    state: st.state ?? (st.completed ? 'post' : 'pre'),
    detail: st.shortDetail ?? st.detail ?? st.description ?? '',
    home: side(home),
    away: side(away),
    venue: comp.venue?.fullName ?? null,
  };
}

export function normalizeTeam(t, { sport, league, label }) {
  return {
    key: `espn:${sport}/${league}:${t.id}`,
    provider: 'espn',
    sport,
    league,
    leagueLabel: label,
    id: String(t.id),
    name: t.displayName ?? t.name,
    short: t.shortDisplayName ?? t.name,
    nickname: t.name ?? null,
    location: t.location ?? null,
    abbr: t.abbreviation ?? '',
    logo: t.logos?.[0]?.href ?? null,
  };
}

async function leagueTeams(l, opts) {
  const data = await getJSON(`${BASE}/${l.sport}/${l.league}/teams?limit=500`, { ttl: DAY, ...opts });
  const raw = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return raw.map((x) => normalizeTeam(x.team ?? x, l));
}

export async function searchTeams(query, opts = {}) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = await Promise.allSettled(ESPN_LEAGUES.map((l) => leagueTeams(l, opts)));
  const teams = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return teams
    .map((t) => ({ t, score: rank(t, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((x) => x.t);
}

function rank(t, q) {
  const fields = [t.name, t.short, t.nickname, t.location, t.abbr].filter(Boolean).map((s) => s.toLowerCase());
  if (fields.some((f) => f === q)) return 3;
  if (fields.some((f) => f.startsWith(q))) return 2;
  if (fields.some((f) => f.includes(q))) return 1;
  return 0;
}

export async function getMatches(team, opts = {}) {
  const { sport, league, id } = team;
  const url = `${BASE}/${sport}/${league}/teams/${id}/schedule`;
  const urls = [url];
  // Football schedules only list played games by default; fixtures need a flag.
  if (sport === 'soccer') urls.push(`${url}?fixture=true`);

  const pages = await Promise.allSettled(urls.map((u) => getJSON(u, { ttl: 60e3, ...opts })));
  const seen = new Map();
  for (const p of pages) {
    if (p.status !== 'fulfilled') continue;
    for (const ev of p.value?.events ?? []) seen.set(String(ev.id), normalizeEvent(ev, sport, league));
  }
  let matches = [...seen.values()];

  // Schedules can lag during a game. If something should be underway, ask the
  // scoreboard for the fresh version of that event.
  const now = Date.now();
  const maybeLive = matches.filter(
    (m) => m.state === 'in' || (m.state === 'pre' && Math.abs(Date.parse(m.start) - now) < 4 * 3600e3),
  );
  if (maybeLive.length) {
    try {
      const board = await getJSON(`${BASE}/${sport}/${league}/scoreboard`, { ttl: 15e3, ...opts });
      for (const ev of board?.events ?? []) {
        if (seen.has(String(ev.id))) {
          const fresh = normalizeEvent(ev, sport, league);
          matches = matches.map((m) => (m.id === fresh.id ? fresh : m));
        }
      }
    } catch {
      /* stale is better than nothing */
    }
  }
  return matches;
}
