// Tiny fetch wrapper: timeout + short in-memory cache so polling stays polite.
const cache = new Map();

export async function getJSON(url, { ttl = 0, timeout = 10_000, fetchImpl = globalThis.fetch } = {}) {
  const hit = cache.get(url);
  if (ttl && hit && Date.now() - hit.at < ttl) return hit.data;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetchImpl(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'Croissant/0.1 (+https://github.com/snj3vpaul/Croissant)' },
    });
    if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
    const data = await res.json();
    if (ttl) cache.set(url, { at: Date.now(), data });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function clearCache() {
  cache.clear();
}
