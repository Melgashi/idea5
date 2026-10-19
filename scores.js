// Best scores for each solo challenge and each player count.
// Always kept in this browser; when the page runs as a published claude.ai
// artifact they are also kept in the viewer's private storage there.

const SCORE_KEY = 'jisogi-scores-v1';
const KEEP_PER_MODE = 10;
const SCORE_MODES = [...SOLO.map((s, i) => 'solo' + (i + 1)), 'p2', 'p3', 'p4'];

let scores = [];
let scoreDoc = null;
let scoreWrite = Promise.resolve();

const modeKey = (cfg) => (cfg.solo != null ? 'solo' + (cfg.solo + 1) : 'p' + cfg.players.length);
const byRank = (a, b) => b.score - a.score || b.money - a.money || a.date.localeCompare(b.date);
const scoresFor = (mode) => scores.filter((r) => r.mode === mode).sort(byRank);

function trimScores(list) {
  const seen = new Set();
  const out = [];
  for (const mode of SCORE_MODES) {
    list.filter((r) => r.mode === mode && !seen.has(r.id) && seen.add(r.id)).sort(byRank).slice(0, KEEP_PER_MODE).forEach((r) => out.push(r));
  }
  return out;
}

function loadLocalScores() {
  try { const v = JSON.parse(localStorage.getItem(SCORE_KEY)); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveLocalScores() {
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(scores)); } catch { /* storage blocked: scores last for this visit */ }
}
function saveRemoteScores() {
  if (!scoreDoc) return;
  const body = { records: JSON.parse(JSON.stringify(scores)) };
  scoreWrite = scoreWrite.then(() => scoreDoc.set(body)).catch(() => {});
}

async function initScores() {
  scores = trimScores(loadLocalScores());
  const c = window.claude;
  if (!c || !c.use) return;
  try {
    const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
    if (!db || !user) return;
    const uid = await user.id();
    if (!uid) return;
    const ref = db.doc('data/users/' + uid + '/scores');
    const snap = await ref.get();
    const remote = snap.exists && Array.isArray(snap.data().records) ? snap.data().records : [];
    scoreDoc = ref;
    const remoteIds = new Set(remote.map((r) => r.id));
    scores = trimScores([...scores, ...remote]);
    saveLocalScores();
    if (scores.some((r) => !remoteIds.has(r.id))) saveRemoteScores();
    render();
  } catch { /* account storage unavailable: browser storage still works */ }
}

// Records every human studio's result. Returns where each one placed.
function recordGame() {
  const mode = modeKey(S.cfg);
  const ranked = S.players.slice().sort((a, b) => score(b) - score(a) || b.money - a.money);
  const stamp = Date.now().toString(36);
  const recs = S.players.filter((p) => !p.ai).map((p) => ({
    id: `${stamp}-${p.id}`, mode, name: p.name, score: score(p), rep: p.rep, debts: p.debts.length,
    money: p.money, released: p.released.length, date: new Date().toISOString(),
    place: ranked.indexOf(p) + 1, of: S.players.length,
    won: S.solo ? !!S.solo.check(p) : ranked[0] === p,
  }));
  if (!recs.length) return [];
  scores = trimScores([...scores, ...recs]);
  saveLocalScores();
  saveRemoteScores();
  const list = scoresFor(mode);
  return recs.map((r) => ({ rec: r, rank: list.findIndex((x) => x.id === r.id) + 1 })).filter((x) => x.rank > 0);
}

function modeName(mode) {
  if (mode.startsWith('solo')) { const s = SOLO[+mode.slice(4) - 1]; return `Solo #${s.n} · ${s.name}`; }
  return `${mode.slice(1)}-studio games`;
}

function renderAchievements() {
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const table = (mode, multi) => {
    const list = scoresFor(mode).slice(0, 5);
    if (!list.length) return '<p class="ach-empty">No finished games yet.</p>';
    return `<ol class="ach-list">${list.map((r, i) => `<li class="${i === 0 ? 'top' : ''}">
        <span class="ach-rank">${i + 1}</span>
        <span class="ach-name">${esc(r.name)}<small>${fmt(r.date)} · ${r.released} released${r.debts ? ` · ${r.debts} debt` : ''}</small></span>
        ${multi ? `<span class="ach-tag${r.place === 1 ? ' win' : ''}">${r.place === 1 ? 'Won' : ordinal(r.place)}</span>` : r.won ? '<span class="ach-tag win">Cleared</span>' : '<span class="ach-tag">Failed</span>'}
        <b class="ach-score">${r.score}★</b></li>`).join('')}</ol>`;
  };
  const solo = SOLO.map((s, i) => {
    const mode = 'solo' + (i + 1);
    const all = scores.filter((r) => r.mode === mode);
    const cleared = all.some((r) => r.won);
    return `<div class="ach-card${cleared ? ' cleared' : ''}">
      <div class="ach-head${s.n <= 2 ? ' easy' : ''}"><span>Solo #${s.n}</span>${cleared ? '<span class="medal" title="Challenge cleared">★</span>' : ''}</div>
      <b class="ach-title">${esc(s.name)}</b><span class="ach-goal">${esc(s.goal)}</span>
      ${table(mode, false)}</div>`;
  }).join('');
  const multi = [2, 3, 4].map((n) => `<div class="ach-card">
      <div class="ach-head multi"><span>${n} studios</span></div>
      <b class="ach-title">${n}-player games</b><span class="ach-goal">Best final score of a human studio</span>
      ${table('p' + n, true)}</div>`).join('');
  const clearedCount = SOLO.filter((s, i) => scores.some((r) => r.mode === 'solo' + (i + 1) && r.won)).length;
  return `<div class="modal ach"><h2>Achievements</h2>
    <p class="ach-sum"><b>${clearedCount}/8</b> solo challenges cleared. ${scoreDoc ? 'Scores are saved privately to your claude.ai account.' : 'Scores are saved in this browser.'}</p>
    <h3>Solo challenges</h3><div class="ach-grid">${solo}</div>
    <h3>Multiplayer</h3><div class="ach-grid">${multi}</div>
    <div class="mbtns"><button type="button" class="btn ghost" data-act="setup">New game</button><button type="button" class="btn primary" data-act="close">Close</button></div></div>`;
}

function ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][n] || 'th'); }
