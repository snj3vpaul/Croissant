// A Match is the one shape every provider hands back, so the rest of Croissant
// never has to care where the data came from.
//
// {
//   id, provider, league, sport,
//   start: ISO string, state: 'pre' | 'in' | 'post', detail: 'Final', 'P2 12:31', …
//   home: { id, name, abbr, score, logo, winner },
//   away: { … }, venue
// }

export function pickMatches(matches, now = Date.now()) {
  const sorted = [...matches].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const live = sorted.find((m) => m.state === 'in') ?? null;
  const last = [...sorted].reverse().find((m) => m.state === 'post') ?? null;
  const next = sorted.find((m) => m.state === 'pre' && Date.parse(m.start) >= now - 3 * 3600e3) ?? null;
  return { live, last, next };
}

// From the favourite team's point of view.
export function perspective(match, teamId) {
  const us = String(match.home.id) === String(teamId) ? match.home : match.away;
  const them = us === match.home ? match.away : match.home;
  const a = Number(us.score);
  const b = Number(them.score);
  let outcome = null;
  if (match.state === 'post') {
    if (us.winner === true || (us.winner == null && a > b)) outcome = 'win';
    else if (them.winner === true || (them.winner == null && a < b)) outcome = 'loss';
    else outcome = 'draw';
  } else if (match.state === 'in') {
    outcome = a > b ? 'leading' : a < b ? 'trailing' : 'level';
  }
  return { us, them, home: us === match.home, outcome };
}

export function scoreline(match) {
  const { home, away } = match;
  if (match.state === 'pre') return `${away.name} @ ${home.name}`;
  return `${home.name} ${home.score ?? '-'}–${away.score ?? '-'} ${away.name}`;
}

export function formatKickoff(iso, tz) {
  const d = new Date(iso);
  const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  if (tz) opts.timeZone = tz;
  return d.toLocaleString('en-CA', opts);
}
