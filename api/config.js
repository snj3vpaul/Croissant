import { send, hostedBrain, wrap } from './_lib.js';

export default wrap(async (req, res) => {
  send(res, 200, { hosted: true, favorites: [], brain: hostedBrain(), timezone: null });
});
