import { ask } from '../src/brain/index.js';
import { cleanTeams } from '../src/team.js';
import { send, readBody, hostedBrain, wrap } from './_lib.js';

const validTz = (tz) => {
  try { return tz && Intl.DateTimeFormat(undefined, { timeZone: tz }) && tz; } catch { return null; }
};

export default wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST a question here' });
  const { question, teams, timezone } = await readBody(req);
  const cfg = { favorites: cleanTeams(teams), timezone: validTz(timezone) || 'UTC', brain: hostedBrain() };
  const reply = await ask(String(question ?? '').slice(0, 500), cfg);
  send(res, 200, { text: reply.text, brain: reply.brain, note: reply.note ?? null });
});
