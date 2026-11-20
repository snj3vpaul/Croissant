// Everything Croissant remembers lives in one JSON file on your machine.
// API keys are never written here — they come from environment variables.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export const configPath = () =>
  process.env.CROISSANT_CONFIG || join(process.env.CROISSANT_HOME || join(homedir(), '.croissant'), 'config.json');

const DEFAULTS = {
  favorites: [],
  brain: { provider: 'rules', model: null },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  port: 4242,
  notify: { kickoff: true, score: true, final: true },
};

export async function loadConfig() {
  try {
    const raw = JSON.parse(await readFile(configPath(), 'utf8'));
    return { ...DEFAULTS, ...raw, brain: { ...DEFAULTS.brain, ...raw.brain }, notify: { ...DEFAULTS.notify, ...raw.notify } };
  } catch (err) {
    if (err.code === 'ENOENT') return structuredClone(DEFAULTS);
    throw err;
  }
}

export async function saveConfig(cfg) {
  const p = configPath();
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}

export async function addFavorite(team, aliases = []) {
  const cfg = await loadConfig();
  if (!cfg.favorites.some((f) => f.key === team.key)) {
    cfg.favorites.push({ ...team, aliases });
    await saveConfig(cfg);
  }
  return cfg;
}

export async function removeFavorite(key) {
  const cfg = await loadConfig();
  cfg.favorites = cfg.favorites.filter((f) => f.key !== key);
  await saveConfig(cfg);
  return cfg;
}

export async function setAliases(key, aliases) {
  const cfg = await loadConfig();
  const fav = cfg.favorites.find((f) => f.key === key);
  if (fav) {
    fav.aliases = aliases;
    await saveConfig(cfg);
  }
  return cfg;
}
