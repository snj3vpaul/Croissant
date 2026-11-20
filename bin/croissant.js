#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { loadConfig, saveConfig, addFavorite, removeFavorite, setAliases, configPath } from '../src/config.js';
import { searchTeams } from '../src/providers/index.js';
import { ask } from '../src/brain/index.js';
import { findTeams } from '../src/brain/rules.js';
import { Tracker } from '../src/tracker.js';
import { startServer } from '../src/server.js';

const HELP = `🥐 Croissant — your favourite teams, fresh from the oven.

  croissant                          Quick digest of all your teams
  croissant "did the sens win?"      Ask anything about your teams
  croissant add <team>               Find a team and add it to favourites
  croissant remove <team>            Remove a favourite
  croissant list                     Show your favourites
  croissant alias <team> <nickname>  Teach a nickname ("sens", "gooners")
  croissant watch                    Stay open and announce kickoffs, scores, finals
  croissant serve [--port 4242]      Open the little web companion
  croissant brain <rules|anthropic|openai|ollama> [model]
                                     Choose the brain (default: rules, no AI key needed)

Config: ${configPath()}`;

const [cmd, ...rest] = process.argv.slice(2);

async function choose(options, label) {
  if (options.length === 1) return options[0];
  options.forEach((o, i) => console.log(`  ${i + 1}. ${label(o)}`));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const n = Number(await rl.question('Which one? '));
  rl.close();
  return options[n - 1];
}

async function main() {
  switch (cmd) {
    case undefined:
    case 'status':
      return say(await ask('', await loadConfig()));
    case 'help':
    case '--help':
    case '-h':
      return console.log(HELP);
    case 'add': {
      const q = rest.join(' ');
      if (!q) return console.log('Usage: croissant add <team name>');
      const teams = await searchTeams(q);
      if (!teams.length) return console.log(`🥐 Couldn't find "${q}". Try the city or full club name.`);
      const team = await choose(teams, (t) => `${t.name} — ${t.leagueLabel || t.sport}`);
      if (!team) return;
      await addFavorite(team);
      return console.log(`🥐 Added ${team.name}. I'll keep it warm for you.`);
    }
    case 'remove': {
      const cfg = await loadConfig();
      const [hit] = findTeams(rest.join(' '), cfg.favorites);
      if (!hit) return console.log("🥐 That team isn't in your favourites.");
      await removeFavorite(hit.key);
      return console.log(`🥐 Removed ${hit.name}.`);
    }
    case 'list': {
      const cfg = await loadConfig();
      if (!cfg.favorites.length) return console.log('🥐 No favourites yet. Try: croissant add "Ottawa Senators"');
      for (const f of cfg.favorites) console.log(`  • ${f.name} (${f.leagueLabel || f.league})${f.aliases?.length ? ` aka ${f.aliases.join(', ')}` : ''}`);
      return;
    }
    case 'alias': {
      const cfg = await loadConfig();
      const [team, ...nick] = rest;
      const [hit] = findTeams(team ?? '', cfg.favorites);
      if (!hit || !nick.length) return console.log('Usage: croissant alias <team> <nickname>');
      await setAliases(hit.key, [...new Set([...(hit.aliases ?? []), nick.join(' ')])]);
      return console.log(`🥐 Got it — "${nick.join(' ')}" means ${hit.name}.`);
    }
    case 'brain': {
      const [provider, model] = rest;
      if (!['rules', 'anthropic', 'openai', 'ollama'].includes(provider)) return console.log('Brains: rules, anthropic, openai, ollama');
      const cfg = await loadConfig();
      cfg.brain = { provider, model: model ?? null };
      await saveConfig(cfg);
      return console.log(`🥐 Brain set to ${provider}${model ? ` (${model})` : ''}.`);
    }
    case 'watch': {
      console.log('🥐 Watching your teams. Ctrl+C to stop.');
      const t = new Tracker(async () => (await loadConfig()).favorites);
      t.on('update', (e) => console.log(`\x07${new Date().toLocaleTimeString()}  ${e.text}`));
      t.on('error', (err) => console.error('  (hiccup:', err.message + ')'));
      t.start();
      return;
    }
    case 'serve': {
      const i = rest.indexOf('--port');
      const { url } = await startServer({ port: i >= 0 ? Number(rest[i + 1]) : undefined });
      return console.log(`🥐 Croissant is warm at ${url}`);
    }
    default:
      return say(await ask([cmd, ...rest].join(' '), await loadConfig()));
  }
}

function say(reply) {
  console.log(`🥐 ${reply.text.split('\n').join('\n   ')}`);
  if (reply.note) console.log(`   (${reply.note})`);
}

main().catch((err) => {
  console.error(`🥐 Something went stale: ${err.message}`);
  process.exit(1);
});
