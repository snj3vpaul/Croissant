import { ask } from '../src/brain/index.js';
import { cleanTeams } from '../src/team.js';
import { send, readInput, hostedBrain, wrap } from './_lib.js';

const validTz = (tz) => {
  try { return tz && Intl.DateTimeFormat(undefined, { timeZone: tz }) && tz; } catch { return null; }
};

export default wrap(async (req, res) => {
  const { question, teams, timezone } = await readInput(req);
  const cfg = { favorites: cleanTeams(teams), timezone: validTz(timezone) || 'UTC', brain: hostedBrain() };
  const reply = await ask(String(question ?? '').slice(0, 500), cfg);
  send(res, 200, { text: reply.text, brain: reply.brain, note: reply.note ?? null });
});
