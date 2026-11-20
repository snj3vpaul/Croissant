import * as espn from './espn.js';
import * as tsdb from './thesportsdb.js';
import { pickMatches } from '../match.js';

const PROVIDERS = { espn, thesportsdb: tsdb };

// ESPN first (live detail is better), TheSportsDB for everything ESPN doesn't carry.
export async function searchTeams(query, opts) {
  const [a, b] = await Promise.allSettled([espn.searchTeams(query, opts), tsdb.searchTeams(query, opts)]);
  const espnTeams = a.status === 'fulfilled' ? a.value : [];
  const tsdbTeams = b.status === 'fulfilled' ? b.value : [];
  const known = new Set(espnTeams.map((t) => t.name.toLowerCase()));
  return [...espnTeams, ...tsdbTeams.filter((t) => !known.has(t.name.toLowerCase()))].slice(0, 15);
}

export async function teamStatus(team, opts) {
  const provider = PROVIDERS[team.provider];
  if (!provider) throw new Error(`Unknown provider ${team.provider}`);
  try {
    const matches = await provider.getMatches(team, opts);
    return { team, ...pickMatches(matches), error: null };
  } catch (err) {
    return { team, live: null, last: null, next: null, error: String(err.message ?? err) };
  }
}

export async function allStatuses(teams, opts) {
  return Promise.all(teams.map((t) => teamStatus(t, opts)));
}
