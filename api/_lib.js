// Shared bits for the Vercel functions. Files starting with "_" aren't routes.
export function send(res, code, body, cache = 'no-store') {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', cache);
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw Object.assign(new Error('Body too large'), { status: 413 });
  }
  return raw ? JSON.parse(raw) : {};
}

// The hosted brain is chosen by the site owner through env vars, never by visitors,
// so nobody can spend your API credit by picking a cloud model.
export function hostedBrain() {
  const provider = process.env.CROISSANT_BRAIN || 'rules';
  return { provider: ['rules', 'anthropic', 'openai'].includes(provider) ? provider : 'rules', model: process.env.CROISSANT_MODEL || null };
}

export function wrap(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      send(res, err.status ?? (err instanceof SyntaxError ? 400 : 500), { error: err.message });
    }
  };
}
