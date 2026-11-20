// Validate a team object that arrived from a browser before we trust it.
export function cleanTeam(t) {
  if (!t || !['espn', 'thesportsdb'].includes(t.provider) || !t.id || !t.name || !t.key) {
    throw Object.assign(new Error('Not a team'), { status: 400 });
  }
  const s = (v) => (v == null ? null : String(v).slice(0, 200));
  const team = {
    key: s(t.key), provider: t.provider, sport: s(t.sport), league: s(t.league),
    leagueLabel: s(t.leagueLabel), id: s(t.id), name: s(t.name), short: s(t.short),
    nickname: s(t.nickname), location: s(t.location), abbr: s(t.abbr), logo: s(t.logo),
    aliases: Array.isArray(t.aliases) ? t.aliases.slice(0, 10).map((a) => String(a).slice(0, 50)) : [],
  };
  // ESPN ids and league slugs end up in URLs; keep them boring.
  if (!/^[\w.-]+$/.test(team.id) || (team.provider === 'espn' && !/^[a-z]+$/.test(team.sport ?? '')) ||
      (team.provider === 'espn' && !/^[\w.]+$/.test(team.league ?? ''))) {
    throw Object.assign(new Error('Not a team'), { status: 400 });
  }
  return team;
}

export function cleanTeams(list, max = 20) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, max).map(cleanTeam);
}
