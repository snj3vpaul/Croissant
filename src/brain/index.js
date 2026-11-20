import * as rules from './rules.js';
import { llmAnswer } from './llm.js';
import { allStatuses } from '../providers/index.js';

// Ask Croissant something. Always fetches fresh data, then lets the chosen brain
// phrase the reply. If a model brain fails, the rules brain answers instead.
export async function ask(question, cfg, { statuses } = {}) {
  statuses ??= await allStatuses(cfg.favorites);
  const base = rules.answer(question, statuses, { timezone: cfg.timezone });
  if (cfg.brain.provider === 'rules' || !statuses.length) return { ...base, brain: 'rules' };

  try {
    const text = await llmAnswer(question, base.statuses.length ? base.statuses : statuses, {
      brain: cfg.brain,
      timezone: cfg.timezone,
      describe: rules.describe,
    });
    if (text) return { ...base, text, brain: cfg.brain.provider };
  } catch (err) {
    return { ...base, brain: 'rules', note: `Model brain unavailable (${err.message}); answered with the built-in brain.` };
  }
  return { ...base, brain: 'rules' };
}
