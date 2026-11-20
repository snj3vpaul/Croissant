// Local web companion. Binds to 127.0.0.1 only — it's yours, not the internet's.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, saveConfig, addFavorite, removeFavorite, setAliases } from './config.js';
import { searchTeams } from './providers/index.js';
import { ask } from './brain/index.js';
import { Tracker } from './tracker.js';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const send = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw new Error('Body too large');
  }
  return raw ? JSON.parse(raw) : {};
}

function cleanTeam(t) {
  if (!t || !['espn', 'thesportsdb'].includes(t.provider) || !t.id || !t.name || !t.key) {
    throw Object.assign(new Error('Not a team'), { status: 400 });
  }
  const pickStr = (v) => (v == null ? null : String(v).slice(0, 200));
  return {
    key: pickStr(t.key), provider: t.provider, sport: pickStr(t.sport), league: pickStr(t.league),
    leagueLabel: pickStr(t.leagueLabel), id: pickStr(t.id), name: pickStr(t.name), short: pickStr(t.short),
    nickname: pickStr(t.nickname), location: pickStr(t.location), abbr: pickStr(t.abbr), logo: pickStr(t.logo),
  };
}

export async function startServer({ port, host = '127.0.0.1' } = {}) {
  const cfg = await loadConfig();
  port ??= cfg.port;
  const clients = new Set();
  const tracker = new Tracker(async () => (await loadConfig()).favorites);
  const broadcast = (event, data) => {
    for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  tracker.on('update', (e) => broadcast('update', { type: e.type, text: e.text, team: e.team.key }));
  tracker.on('statuses', (s) => broadcast('statuses', s));
  tracker.on('error', (err) => console.error('tracker:', err.message));
  tracker.start();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname === '/api/stream') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        res.write(`event: statuses\ndata: ${JSON.stringify(tracker.statuses)}\n\n`);
        clients.add(res);
        const ping = setInterval(() => res.write(': ping\n\n'), 25e3);
        req.on('close', () => { clients.delete(res); clearInterval(ping); });
        return;
      }
      if (url.pathname === '/api/config' && req.method === 'GET') {
        const c = await loadConfig();
        return send(res, 200, { favorites: c.favorites, brain: c.brain, timezone: c.timezone });
      }
      if (url.pathname === '/api/brain' && req.method === 'POST') {
        const { provider, model } = await body(req);
        if (!['rules', 'anthropic', 'openai', 'ollama'].includes(provider)) return send(res, 400, { error: 'Unknown brain' });
        const c = await loadConfig();
        c.brain = { provider, model: model ? String(model).slice(0, 100) : null };
        await saveConfig(c);
        return send(res, 200, c.brain);
      }
      if (url.pathname === '/api/search') {
        return send(res, 200, await searchTeams(url.searchParams.get('q') ?? ''));
      }
      if (url.pathname === '/api/favorites' && req.method === 'POST') {
        const { team, aliases = [] } = await body(req);
        const c = await addFavorite(cleanTeam(team), aliases.map(String).slice(0, 10));
        tracker.poke();
        return send(res, 200, c.favorites);
      }
      if (url.pathname === '/api/favorites' && req.method === 'DELETE') {
        const c = await removeFavorite(url.searchParams.get('key'));
        tracker.poke();
        return send(res, 200, c.favorites);
      }
      if (url.pathname === '/api/aliases' && req.method === 'POST') {
        const { key, aliases = [] } = await body(req);
        const c = await setAliases(key, aliases.map(String).slice(0, 10));
        return send(res, 200, c.favorites);
      }
      if (url.pathname === '/api/ask' && req.method === 'POST') {
        const { question } = await body(req);
        const c = await loadConfig();
        const reply = await ask(String(question ?? '').slice(0, 500), c);
        return send(res, 200, { text: reply.text, brain: reply.brain, note: reply.note ?? null });
      }
      if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });

      // Static files
      const rel = normalize(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
      if (rel.startsWith('..')) return send(res, 403, { error: 'Nope' });
      const file = await readFile(join(PUBLIC, rel));
      res.writeHead(200, { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream' });
      res.end(file);
    } catch (err) {
      if (err.code === 'ENOENT') return send(res, 404, { error: 'Not found' });
      send(res, err.status ?? (err instanceof SyntaxError ? 400 : 500), { error: err.message });
    }
  });

  await new Promise((r) => server.listen(port, host, r));
  return { server, tracker, url: `http://${host}:${port}` };
}
