import { searchTeams } from '../src/providers/index.js';
import { send, wrap } from './_lib.js';

export default wrap(async (req, res) => {
  const q = String(new URL(req.url, 'http://x').searchParams.get('q') ?? '').slice(0, 80);
  send(res, 200, q.trim().length < 2 ? [] : await searchTeams(q), 'public, s-maxage=3600');
});
