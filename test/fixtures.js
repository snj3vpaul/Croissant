// Trimmed-down copies of the real API shapes.
const team = (id, name, abbr, short) => ({ id, displayName: name, abbreviation: abbr, shortDisplayName: short });

export const espnSchedule = {
  events: [
    {
      id: '401',
      date: '2026-11-17T00:00Z',
      competitions: [{
        status: { type: { state: 'post', completed: true, shortDetail: 'Final' } },
        venue: { fullName: 'Canadian Tire Centre' },
        competitors: [
          { homeAway: 'home', team: team('14', 'Ottawa Senators', 'OTT', 'Senators'), score: { value: 4, displayValue: '4' }, winner: true },
          { homeAway: 'away', team: team('21', 'Toronto Maple Leafs', 'TOR', 'Maple Leafs'), score: { value: 2, displayValue: '2' }, winner: false },
        ],
      }],
    },
    {
      id: '402',
      date: '2099-11-21T00:00Z',
      competitions: [{
        status: { type: { state: 'pre', shortDetail: 'Fri 7:00 PM' } },
        venue: { fullName: 'Bell Centre' },
        competitors: [
          { homeAway: 'home', team: team('10', 'Montreal Canadiens', 'MTL', 'Canadiens') },
          { homeAway: 'away', team: team('14', 'Ottawa Senators', 'OTT', 'Senators') },
        ],
      }],
    },
  ],
};

export const espnTeams = {
  sports: [{ leagues: [{ teams: [
    { team: { id: '14', displayName: 'Ottawa Senators', shortDisplayName: 'Senators', name: 'Senators', location: 'Ottawa', abbreviation: 'OTT', logos: [{ href: 'https://a.espncdn.com/ott.png' }] } },
    { team: { id: '21', displayName: 'Toronto Maple Leafs', shortDisplayName: 'Maple Leafs', name: 'Maple Leafs', location: 'Toronto', abbreviation: 'TOR', logos: [] } },
  ] }] }],
};

export const tsdbLast = {
  results: [{
    idEvent: '9001', strSport: 'Cricket', strLeague: 'Test Cricket', strHomeTeam: 'India', strAwayTeam: 'Australia',
    idHomeTeam: '134', idAwayTeam: '135', intHomeScore: '287', intAwayScore: '241', strStatus: 'Match Finished',
    strResult: 'India won by 46 runs', strTimestamp: '2026-11-15T04:00:00', dateEvent: '2026-11-15', strVenue: 'Perth Stadium',
  }],
};

export const tsdbNext = {
  events: [{
    idEvent: '9002', strSport: 'Cricket', strLeague: 'Test Cricket', strHomeTeam: 'Australia', strAwayTeam: 'India',
    idHomeTeam: '135', idAwayTeam: '134', intHomeScore: null, intAwayScore: null, strStatus: 'Not Started',
    strTimestamp: '2099-11-25T23:30:00', dateEvent: '2099-11-25', strVenue: 'Adelaide Oval',
  }],
};

export function fakeFetch(routes) {
  return async (url) => {
    const hit = Object.entries(routes).find(([frag]) => url.includes(frag));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => structuredClone(hit[1]) };
  };
}

export const SENS = {
  key: 'espn:hockey/nhl:14', provider: 'espn', sport: 'hockey', league: 'nhl', leagueLabel: 'NHL',
  id: '14', name: 'Ottawa Senators', short: 'Senators', nickname: 'Senators', location: 'Ottawa', abbr: 'OTT', aliases: ['sens'],
};
export const INDIA = {
  key: 'tsdb:134', provider: 'thesportsdb', sport: 'cricket', league: 'Test Cricket', leagueLabel: 'Test Cricket',
  id: '134', name: 'India', short: 'India', abbr: 'IND', aliases: [],
};
