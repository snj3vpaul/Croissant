const $ = (s) => document.querySelector(s);
const buddy = $('#buddy');
const bubble = $('#bubble');
let favorites = [];
let timezone;

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
      t.logo ? el('img', { src: t.logo, alt: '' }) : null,
      el('b', {}, t.name, el('small', {}, t.leagueLabel || t.league)),
      el('button', { class: 'x', title: `Remove ${t.name}`, onclick: () => remove(t.key) }, '×'),
    ),
    rows,
  );
}

function render(statuses) {
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
  favorites = await api(`/api/favorites?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
  render([]);
}

// Asking
$('#ask').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('#question').value.trim();
  if (!q) return;
  buddy.classList.remove('asleep');
  say('Checking the oven…');
  try {
    const r = await api('/api/ask', { method: 'POST', body: JSON.stringify({ question: q }) });
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
        el('li', { onclick: () => add(t) }, t.logo ? el('img', { src: t.logo, alt: '' }) : null, el('span', {}, t.name, ' ', el('small', {}, t.leagueLabel || t.sport))),
      ),
    );
  }, 300);
});

async function add(team) {
  favorites = await api('/api/favorites', { method: 'POST', body: JSON.stringify({ team }) });
  $('#search').value = '';
  $('#results').replaceChildren();
  $('#add').hidden = true;
  say(`Added ${team.name}. I'll keep it warm for you.`, 'hop');
  render([]);
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
function connect() {
  const es = new EventSource('/api/stream');
  es.addEventListener('statuses', (e) => render(JSON.parse(e.data)));
  es.addEventListener('update', (e) => {
    const u = JSON.parse(e.data);
    say(u.text, 'hop');
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Croissant', { body: u.text, icon: 'croissant.svg' });
  });
}

(async () => {
  const cfg = await api('/api/config');
  favorites = cfg.favorites;
  timezone = cfg.timezone;
  $('#brain').value = cfg.brain.provider;
  $('#model').value = cfg.brain.model ?? '';
  render([]);
  if (!favorites.length) say('Oh, hi. I saved you a warm seat. Tell me who you cheer for and I’ll keep an eye on them.');
  connect();
})();
