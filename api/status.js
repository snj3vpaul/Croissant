import { allStatuses } from '../src/providers/index.js';
import { cleanTeams } from '../src/team.js';
import { send, readBody, wrap } from './_lib.js';

export default wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST teams here' });
  const { teams } = await readBody(req);
  send(res, 200, await allStatuses(cleanTeams(teams)));
});
