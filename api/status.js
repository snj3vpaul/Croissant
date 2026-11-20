import { allStatuses } from '../src/providers/index.js';
import { cleanTeams } from '../src/team.js';
import { send, readInput, wrap } from './_lib.js';

export default wrap(async (req, res) => {
  const { teams } = await readInput(req);
  send(res, 200, await allStatuses(cleanTeams(teams)));
});
