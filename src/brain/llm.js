// Optional "bring your own brain". The model only ever sees public match data
// for your favourite teams plus your question — nothing else leaves your machine.
const SYSTEM = `You are Croissant, a small, warm, slightly flaky (in the pastry sense) companion who keeps an eye on the user's favourite sports teams.
Answer ONLY from the MATCH DATA provided. If the answer isn't there, say you don't have it — never guess scores, dates or opponents.
Keep replies to one to three short sentences. Times in the data are already local to the user. A light pastry pun is welcome; more than one is too many.`;

function compact(statuses, describeFn, timezone) {
  return statuses
    .map((s) => `- ${s.team.name} (${s.team.leagueLabel ?? s.team.league}): ${describeFn(s, 'digest', timezone)}`)
    .join('\n');
}

const DEFAULT_MODELS = { anthropic: 'claude-haiku-5-5', openai: 'gpt-4.1-mini', ollama: 'llama3.2' };

export async function llmAnswer(question, statuses, { brain, timezone, describe, fetchImpl = fetch }) {
  const provider = brain.provider;
  const model = brain.model || DEFAULT_MODELS[provider];
  const user = `MATCH DATA (as of ${new Date().toISOString()}):\n${compact(statuses, describe, timezone)}\n\nQUESTION: ${question}`;

  if (provider === 'anthropic') {
    const key = process.env.CROISSANT_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('Set ANTHROPIC_API_KEY to use the Anthropic brain.');
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 300, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = await res.json();
    return data.content?.map((c) => c.text ?? '').join('').trim();
  }

  if (provider === 'openai') {
    const key = process.env.CROISSANT_OPENAI_KEY || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('Set OPENAI_API_KEY to use the OpenAI brain.');
    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: 300, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim();
  }

  if (provider === 'ollama') {
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const res = await fetchImpl(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, stream: false, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = await res.json();
    return data.message?.content?.trim();
  }

  throw new Error(`Unknown brain "${provider}"`);
}
