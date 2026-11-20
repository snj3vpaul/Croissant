// Leagues Croissant knows how to look up through ESPN's public site API.
// Anything not listed here (cricket, rugby, smaller leagues…) falls back to TheSportsDB.
export const ESPN_LEAGUES = [
  { sport: 'hockey', league: 'nhl', label: 'NHL' },
  { sport: 'basketball', league: 'nba', label: 'NBA' },
  { sport: 'basketball', league: 'wnba', label: 'WNBA' },
  { sport: 'football', league: 'nfl', label: 'NFL' },
  { sport: 'baseball', league: 'mlb', label: 'MLB' },
  { sport: 'soccer', league: 'usa.1', label: 'MLS' },
  { sport: 'soccer', league: 'eng.1', label: 'Premier League' },
  { sport: 'soccer', league: 'esp.1', label: 'LaLiga' },
  { sport: 'soccer', league: 'ger.1', label: 'Bundesliga' },
  { sport: 'soccer', league: 'ita.1', label: 'Serie A' },
  { sport: 'soccer', league: 'fra.1', label: 'Ligue 1' },
  { sport: 'soccer', league: 'uefa.champions', label: 'Champions League' },
];

export function leagueLabel(sport, league) {
  return ESPN_LEAGUES.find((l) => l.sport === sport && l.league === league)?.label ?? league;
}
