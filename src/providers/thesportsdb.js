// TheSportsDB covers the long tail: cricket, rugby, CFL, smaller football leagues…
// Uses the free public key by default; set THESPORTSDB_KEY for a Patreon key.
import { getJSON } from './http.js';

const key = () => process.env.THESPORTSDB_KEY || '123';
const base = () => `https://www.thesportsdb.com/api/v1/json/${key()}`;

export function normalizeTeam(t) {
  return {
    key: `tsdb:${t.idTeam}`,
    provider: 'thesportsdb',
    sport: (t.strSport ?? '').toLowerCase(),
    league: t.strLeague ?? '',
    leagueLabel: t.strLeague ?? '',
    id: String(t.idTeam),
    name: t.strTeam,
    short: t.strTeamShort || t.strTeam,
    nickname: t.strTeamAlternate || null,
    location: t.strLocation || null,
    abbr: t.strTeamShort || '',
    logo: t.strBadge ?? t.strTeamBadge ?? null,
  };
}

const LIVE = new Set(['1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'IN PLAY', 'Q1', 'Q2', 'Q3', 'Q4', 'OT', 'INNINGS BREAK']);
const DONE = new Set(['FT', 'AET', 'PEN', 'MATCH FINISHED', 'FINISHED', 'AOT', 'RESULT']);

function stateOf(e) {
  const s = (e.strStatus ?? '').toUpperCase();
  if (DONE.has(s) || (s === '' && e.intHomeScore != null && e.intAwayScore != null)) return 'post';
  if (LIVE.has(s) || /^\d+'?$/.test(s)) return 'in';
  return 'pre';
}

export function normalizeEvent(e) {
  const start = e.strTimestamp
    ? new Date(e.strTimestamp.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(e.strTimestamp) ? e.strTimestamp : e.strTimestamp + 'Z').toISOString()
    : new Date(`${e.dateEvent}T${e.strTime || '00:00:00'}Z`).toISOString();
  const state = stateOf(e);
  // Cricket scores come through as text like "245/6" in strResult; numbers for everything else.
  const score = (v) => (v == null || v === '' ? null : String(v));
  return {
    id: String(e.idEvent),
    provider: 'thesportsdb',
    sport: (e.strSport ?? '').toLowerCase(),
    league: e.strLeague ?? '',
    start,
    state,
    detail: state === 'post' ? (e.strResult?.trim() || 'Final') : state === 'in' ? e.strStatus ?? 'Live' : '',
    home: { id: String(e.idHomeTeam), name: e.strHomeTeam, short: e.strHomeTeam, abbr: '', logo: e.strHomeTeamBadge ?? null, score: score(e.intHomeScore), winner: null },
    away: { id: String(e.idAwayTeam), name: e.strAwayTeam, short: e.strAwayTeam, abbr: '', logo: e.strAwayTeamBadge ?? null, score: score(e.intAwayScore), winner: null },
    venue: e.strVenue || null,
  };
}

export async function searchTeams(query, opts = {}) {
  const q = query.trim();
  if (!q) return [];
  const data = await getJSON(`${base()}/searchteams.php?t=${encodeURIComponent(q)}`, { ttl: 24 * 3600e3, ...opts });
  return (data?.teams ?? []).slice(0, 12).map(normalizeTeam);
}

export async function getMatches(team, opts = {}) {
  const [last, next] = await Promise.allSettled([
    getJSON(`${base()}/eventslast.php?id=${team.id}`, { ttl: 60e3, ...opts }),
    getJSON(`${base()}/eventsnext.php?id=${team.id}`, { ttl: 60e3, ...opts }),
  ]);
  const events = [
    ...(last.status === 'fulfilled' ? last.value?.results ?? [] : []),
    ...(next.status === 'fulfilled' ? next.value?.events ?? [] : []),
  ];
  const byId = new Map(events.map((e) => [String(e.idEvent), normalizeEvent(e)]));
  return [...byId.values()];
}
