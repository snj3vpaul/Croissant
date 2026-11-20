const $ = (s) => document.querySelector(s);
const buddy = $('#buddy');
const bubble = $('#bubble');
let favorites = [];
let timezone;
let hosted = false;

// Hosted (Vercel) mode keeps your teams in this browser; local mode keeps them on disk.
const store = {
  load() {
    try { return JSON.parse(localStorage.getItem('croissant.favorites') || '[]'); } catch { return []; }
  },
  save(list) {
    try { localStorage.setItem('croissant.favorites', JSON.stringify(list)); } catch { /* private mode */ }
    return list;
  },
};

// Small DOM helper that never uses innerHTML, so team names from APIs stay text.
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k);
  return n;
}

const PETS = ['Hehe, that tickles the flakes.', 'Purr… wait, croissants don’t purr.', 'Freshly fluffed, thank you.', 'I’m 90% butter and 10% loyalty.'];

function say(text, mood) {
  bubble.textContent = text;
  if (mood) {
    buddy.classList.remove('hop', 'wiggle');
    void buddy.offsetWidth;
    buddy.classList.add(mood);
  }
}

buddy.addEventListener('click', () => say(PETS[Math.floor(Math.random() * PETS.length)], 'wiggle'));
setInterval(() => {
  buddy.classList.add('blink');
  setTimeout(() => buddy.classList.remove('blink'), 160);
}, 4200);

const fmt = (iso) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone });

function sides(m, teamId) {
  const us = String(m.home.id) === String(teamId) ? m.home : m.away;
  return { us, them: us === m.home ? m.away : m.home, home: us === m.home };
}

function row(tag, ...content) {
  return el('div', { class: 'row' }, el('span', { class: 'tag' }, tag), ...content);
}

function card(s) {
  const t = s.team;
  const rows = [];
  if (s.error) rows.push(row('oops', 'Couldn’t reach scores just now'));
  if (s.live) {
    const { us, them } = sides(s.live, t.id);
    rows.push(row('live', el('span', { class: 'live' }, `${us.score ?? 0}–${them.score ?? 0}`), ` vs ${them.short ?? them.name} · ${s.live.detail}`));
  }
  if (s.last) {
    const { us, them } = sides(s.last, t.id);
    const a = Number(us.score), b = Number(them.score);
    const won = us.winner === true || (us.winner == null && a > b);
    const lost = them.winner === true || (them.winner == null && a < b);
    rows.push(row('last', el('span', { class: won ? 'w' : lost ? 'l' : '' }, won ? 'W ' : lost ? 'L ' : 'D '), `${us.score}–${them.score} vs ${them.short ?? them.name}`));
  }
  if (s.next) {
    const { them, home } = sides(s.next, t.id);
    rows.push(row('next', `${home ? 'vs' : '@'} ${them.short ?? them.name} · ${fmt(s.next.start)}`));
  }
  if (!rows.length) rows.push(row('', 'Nothing scheduled yet'));

  return el('article', { class: `team${s.live ? ' is-live' : ''}` },
    el('header', {},
      t.logo ? el('img', { src: t.logo, alt: '', onerror: (e) => e.target.remove() }) : null,
      el('b', {}, t.name, el('small', {}, t.leagueLabel || t.league)),
      el('button', { class: 'x', title: `Remove ${t.name}`, onclick: () => remove(t.key) }, '×'),
    ),
    rows,
  );
}

let lastStatuses = [];
function render(statuses) {
  lastStatuses = statuses;
  const byKey = new Map(statuses.map((s) => [s.team.key, s]));
  const list = favorites.map((f) => byKey.get(f.key) ?? { team: f });
  $('#teams').replaceChildren(...list.map(card));
  $('#empty').hidden = favorites.length > 0;
  buddy.classList.toggle('asleep', favorites.length > 0 && !statuses.some((s) => s.live));
}

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'content-type': 'application/json' }, ...opts });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

async function remove(key) {
  favorites = hosted
    ? store.save(favorites.filter((f) => f.key !== key))
    : await api(`/api/favorites?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
  render(lastStatuses);
  if (hosted) refresh();
}

// Asking
$('#ask').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('#question').value.trim();
  if (!q) return;
  buddy.classList.remove('asleep');
  say('Checking the oven…');
  try {
    const payload = hosted ? { question: q, teams: favorites, timezone } : { question: q };
    const r = await api('/api/ask', { method: 'POST', body: JSON.stringify(payload) });
    say(r.text + (r.note ? `\n(${r.note})` : ''), 'hop');
  } catch (err) {
    say(`Hmm, something went stale: ${err.message}`, 'wiggle');
  }
});

// Adding teams
$('#toggle-add').addEventListener('click', () => {
  $('#add').hidden = !$('#add').hidden;
  if (!$('#add').hidden) $('#search').focus();
});
let searchTimer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) return $('#results').replaceChildren();
  searchTimer = setTimeout(async () => {
    const teams = await api(`/api/search?q=${encodeURIComponent(q)}`);
    $('#results').replaceChildren(
      ...teams.map((t) =>
        el('li', { onclick: () => add(t) }, t.logo ? el('img', { src: t.logo, alt: '', onerror: (e) => e.target.remove() }) : null, el('span', {}, t.name, ' ', el('small', {}, t.leagueLabel || t.sport))),
      ),
    );
  }, 300);
});

async function add(team) {
  favorites = hosted
    ? store.save(favorites.some((f) => f.key === team.key) ? favorites : [...favorites, { ...team, aliases: [] }])
    : await api('/api/favorites', { method: 'POST', body: JSON.stringify({ team }) });
  $('#search').value = '';
  $('#results').replaceChildren();
  $('#add').hidden = true;
  say(`Added ${team.name}. I'll keep it warm for you.`, 'hop');
  render(lastStatuses);
  if (hosted) refresh();
}

// Settings
$('#save-brain').addEventListener('click', async () => {
  const b = await api('/api/brain', { method: 'POST', body: JSON.stringify({ provider: $('#brain').value, model: $('#model').value.trim() || null }) });
  say(`New brain: ${b.provider}. Same croissant.`, 'wiggle');
});
$('#notify').addEventListener('click', async () => {
  const p = await Notification.requestPermission();
  say(p === 'granted' ? "I'll tap you on the shoulder for kickoffs, scores and finals." : 'No worries, I’ll just tell you here.');
});

// Live updates
function announce(text) {
  say(text, 'hop');
  if ('Notification' in window && Notification.permission === 'granted') new Notification('Croissant', { body: text, icon: 'croissant.svg' });
}

function connect() {
  const es = new EventSource('/api/stream');
  es.addEventListener('statuses', (e) => render(JSON.parse(e.data)));
  es.addEventListener('update', (e) => announce(JSON.parse(e.data).text));
}

// Hosted mode: no long-lived server, so the page polls and spots changes itself.
function changes(prev, curr) {
  const out = [];
  for (const s of curr) {
    const was = prev.find((p) => p.team.key === s.team.key)?.live;
    if (!prev.some((p) => p.team.key === s.team.key)) continue;
    const now = s.live;
    const name = s.team.name;
    const line = (m) => { const { us, them } = sides(m, s.team.id); return `${us.score ?? 0}–${them.score ?? 0} ${them.name}`; };
    if (now && !was) out.push(`🥐 ${name} just started!`);
    else if (now && was && now.id === was.id && `${now.home.score}-${now.away.score}` !== `${was.home.score}-${was.away.score}`)
      out.push(`🥐 ${name} ${line(now)} (${now.detail})`);
    if (was && !now && s.last?.id === was.id) out.push(`🥐 Final: ${name} ${line(s.last)}`);
  }
  return out;
}

let pollTimer;
async function refresh() {
  clearTimeout(pollTimer);
  let delay = 15 * 60e3;
  if (favorites.length) {
    try {
      const statuses = await api('/api/status', { method: 'POST', body: JSON.stringify({ teams: favorites }) });
      changes(lastStatuses, statuses).forEach(announce);
      render(statuses);
      const soon = statuses.some((s) => s.next && Date.parse(s.next.start) - Date.now() < 30 * 60e3);
      delay = statuses.some((s) => s.live) ? 30e3 : soon ? 2 * 60e3 : delay;
    } catch {
      delay = 60e3;
    }
  }
  pollTimer = setTimeout(refresh, delay);
}
document.addEventListener('visibilitychange', () => { if (hosted && !document.hidden) refresh(); });

(async () => {
  const cfg = await api('/api/config');
  hosted = !!cfg.hosted;
  favorites = hosted ? store.load() : cfg.favorites;
  timezone = cfg.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  $('#brain').value = cfg.brain.provider;
  $('#model').value = cfg.brain.model ?? '';
  if (hosted) {
    for (const id of ['#brain', '#model', '#save-brain']) $(id).disabled = true;
    $('.fine').textContent = 'Your teams are saved in this browser only. The brain is chosen by whoever runs this site.';
  }
  render([]);
  if (!favorites.length) say('Oh, hi. I saved you a warm seat. Tell me who you cheer for and I’ll keep an eye on them.');
  if (hosted) refresh();
  else connect();
})();
