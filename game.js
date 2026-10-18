// JISOGI: Anime Studio Tycoon — browser edition.
// Engine is a single async game loop; human decisions are awaited through ask(),
// AI players make the same decisions synchronously through the ai* helpers.

/* ---------------- constants ---------------- */

const ACTIONS = [
  { k: 'write', name: 'Write', who: 'W', base: '1 reveal, pick 2', bonus: '+1 pick' },
  { k: 'research', name: 'Research', who: 'W', base: '3 reveal, pick 1', bonus: '+1 pick' },
  { k: 'animate', name: 'Animate', who: 'A', base: '+1 level', bonus: '+1 level' },
  { k: 'outsource', name: 'Outsource', who: 'A', base: '+4¥', bonus: '+1 Merch' },
  { k: 'staffing', name: 'Staffing', who: 'P', base: '-2¥, hire or promote', bonus: '+3 Hype' },
  { k: 'networking', name: 'Networking', who: 'P', base: '+2 Network', bonus: '+3 Hype' },
  { k: 'strategize', name: 'Strategize', who: '*', base: '-2¥, +1 Leverage', bonus: '+1 Network' },
];
const ACT = Object.fromEntries(ACTIONS.map((a) => [a.k, a]));
const BASE = { write: { reveal: 1, pick: 2 }, research: { reveal: 3, pick: 1 }, animate: { lvl: 1 }, outsource: { money: 4 }, staffing: {}, networking: { net: 2 }, strategize: {} };
const BONUS = { write: { pick: 1 }, research: { pick: 1 }, animate: { lvl: 1 }, outsource: { merch: 1 }, staffing: { hype: 3 }, networking: { hype: 3 }, strategize: { net: 1 } };
const LEVERAGES = [
  { name: '1st player', text: 'Become 1st player, +4¥' },
  { name: 'Promote', text: 'Promote a Dead-Inside Staff' },
  { name: 'Merch', text: 'Gain or activate a Merch Deal' },
  { name: 'Hype', text: '6 Hype minus your Dead-Inside Staff' },
];
const REWARDS = [
  { min: 0, money: 3, rep: 1 }, { min: 10, money: 4, rep: 2 }, { min: 15, money: 5, rep: 4 },
  { min: 20, money: 6, rep: 6 }, { min: 25, money: 7, rep: 8 }, { min: 30, money: 8, rep: 10 },
];
const MERCH_INCOME = [null, { money: 3, rep: 0 }, { money: 6, rep: 1 }, { money: 9, rep: 2 }, { money: 12, rep: 3 }];
const PART_TYPES = ['set', 'plot', 'twist'];
const PLAYER_COLORS = ['#f0a73a', '#46b4cc', '#e8578a', '#93c24a'];
const PLAYER_NAMES = ['Bark! Studio', 'Studio Kumo', 'Neko Pictures', 'Mochi Works'];
const REP_CAP = 29;

/* ---------------- utilities ---------------- */

let S = null; // current game state
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sum = (a) => a.reduce((x, y) => x + y, 0);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const imgOf = (card) => `cards/${card.id}.jpg`;
const sleep = (ms) => { const g = S; return new Promise((res, rej) => setTimeout(() => (g === S ? res() : rej('abort')), ms)); };
const wait = () => sleep(S.delay);
const hasSkill = (p, id) => p.staff.some((s) => s.card.skill && s.card.skill.id === id);
const deadCount = (p) => p.staff.filter((s) => s.card.dead).length;
const genkiCount = (p) => p.staff.filter((s) => !s.card.dead).length;
const prodParts = (p) => PART_TYPES.map((t) => p.prod[t]).filter(Boolean);
const levelCap = (p) => [0, 1, 2, 6][prodParts(p).length];
const debtCost = (d) => 8 + d.interest;
function score(p) { return p.rep - 2 * p.debts.length; }

function log(msg, p) {
  S.log.unshift({ msg, color: p ? p.color : null, round: S.round });
  if (S.log.length > 120) S.log.pop();
}

function seatOrder() {
  const n = S.players.length;
  return Array.from({ length: n }, (_, i) => S.players[(S.first + i) % n]);
}

function matchCount(genres, trendGenres) {
  const left = trendGenres.slice();
  let m = 0;
  for (const g of genres) { const i = left.indexOf(g); if (i >= 0) { left.splice(i, 1); m++; } }
  return m;
}

/* ---------------- human input ---------------- */

function ask(mode, opts = {}) {
  return new Promise((res) => { S.ui = { mode, ...opts, res }; render(); if (mode === 'reveal' || mode === 'pick') scrollToEl('.scripts'); });
}
function answer(v) {
  const u = S.ui;
  if (!u || !u.res) return;
  S.ui = { mode: 'wait' };
  u.res(v);
  render();
}
function choose(p, prompt, options) {
  return ask('choose', { pid: p.id, prompt, options });
}

/* ---------------- setup ---------------- */

function newGame(cfg) {
  const solo = cfg.solo != null ? SOLO[cfg.solo] : null;
  S = {
    cfg, solo, round: 1, rounds: solo ? solo.rounds : 4, phase: 'setup', log: [], ui: { mode: 'wait' },
    spaces: {}, locks: [null, null, null, null], first: 0, cur: null, delay: cfg.delay ?? 550, view: 0, over: false,
  };
  // script parts
  S.sdeck = { set: [], plot: [], twist: [] };
  S.pool = { set: [], plot: [], twist: [] };
  let uid = 0;
  for (const t of PART_TYPES) for (const g in SCRIPT_NAMES[t]) for (const name of SCRIPT_NAMES[t][g]) S.sdeck[t].push({ id: uid++, t, g, name });
  for (const t of PART_TYPES) { shuffle(S.sdeck[t]); for (let i = 0; i < 3; i++) S.pool[t].push(S.sdeck[t].pop()); }
  // staff
  const replaced = solo && solo.replace ? Object.values(solo.replace) : [];
  S.decks = { W: [], A: [], P: [], D: [] };
  for (const c of GENKI) if (!replaced.includes(c.id)) S.decks[c.type].push(c);
  if (solo && solo.noDirectors) S.decks.D = [];
  for (const t in S.decks) shuffle(S.decks[t]);
  S.market = {};
  for (const t in S.decks) S.market[t] = S.decks[t].shift() || null;
  // trends, opportunities, network
  S.tdeck = shuffle(TRENDS.slice());
  S.tdisc = [];
  S.trends = [0, 1, 2].map(() => ({ card: S.tdeck.pop(), token: true }));
  S.opps = shuffle(OPPORTUNITIES.slice()).slice(0, 6).map((card, i) => ({ card, up: i < 3 || !!(solo && solo.allOpps), taken: null, bonus: i < 3 ? 2 : 3 }));
  S.ndeck = shuffle(NETWORK.slice());
  S.ndisc = [];
  // players
  S.players = cfg.players.map((pc, i) => ({
    id: i, name: pc.name, ai: pc.ai, color: PLAYER_COLORS[i],
    money: [3, 4, 5, 6][i], hype: 0, rep: 0,
    staff: ['W', 'A', 'P', 'D'].map((t) => ({ card: DEAD[t], token: true })),
    storage: [], prod: { set: null, plot: null, twist: null }, level: 0, released: [],
    merchInv: 0, merchActive: 0, net: [], netNew: [], debts: [], passed: false,
  }));
  for (const p of S.players) {
    if (solo) {
      p.money = solo.money ?? 3;
      for (let i = 0; i < (solo.debts ?? 1); i++) p.debts.push({ interest: 0 });
      for (const t in solo.replace || {}) {
        const s = p.staff.find((x) => x.card.type === t);
        s.card = GENKI.find((c) => c.id === solo.replace[t]);
      }
    }
    // Edition 1.5: one extra Script Part per player at setup.
    const t = PART_TYPES[Math.floor(Math.random() * 3)];
    p.storage.push(S.sdeck[t].pop());
  }
  S.view = Math.max(0, S.players.findIndex((p) => !p.ai));
  log(solo ? `Solo challenge #${solo.n}: ${solo.name}. Goal: ${solo.goal}.` : `New game with ${S.players.length} studios.`);
  closeModal();
  run().catch((e) => { if (e !== 'abort') { console.error(e); } });
}

/* ---------------- main loop ---------------- */

async function run() {
  for (S.round = 1; S.round <= S.rounds; S.round++) {
    await productionPhase();
    await releasePhase();
    await upkeepPhase();
  }
  finish();
}

async function productionPhase() {
  S.phase = 'production';
  S.spaces = Object.fromEntries(ACTIONS.map((a) => [a.k, []]));
  for (const p of S.players) p.passed = false;
  log(`Round ${S.round}: Production Phase.`);
  if (S.solo) {
    const picks = shuffle(ACTIONS.map((a) => a.k)).slice(0, S.solo.hd);
    for (const k of picks) for (let i = 0; i < (S.solo.dbl ? 2 : 1); i++) S.spaces[k].push('hd');
    log(`High-Demand tokens placed on ${picks.map((k) => ACT[k].name).join(', ')}.`);
  }
  render();
  const order = seatOrder();
  const active = (p) => !p.passed && p.staff.some((s) => s.token);
  while (order.some(active)) {
    for (const p of order) {
      if (!active(p)) continue;
      await takeTurn(p);
      render();
    }
  }
  S.cur = null;
}

async function takeTurn(p) {
  S.cur = p.id;
  p.netNew = [];
  if (p.ai) {
    render();
    await wait();
    await aiTurn(p);
  } else {
    S.view = p.id;
    const r = await ask('turn', { pid: p.id, sel: null });
    if (r.pass) {
      p.passed = true;
      for (const s of p.staff) s.token = false;
      log(`${p.name} ends their Production Phase.`, p);
    } else {
      await doAction(p, r.staff, r.act);
      scrollToEl('.studio');
    }
  }
  await endTurn(p);
}

async function endTurn(p) {
  const cap = S.solo && S.solo.noStorageCap ? Infinity : 5;
  while (p.storage.length > cap) {
    const i = p.ai ? aiWorstPart(p) : await ask('discard', { pid: p.id, prompt: `Storage holds max 5 Script Parts. Choose one to return to the pool (${p.storage.length - cap} to go).` });
    const part = p.storage.splice(i, 1)[0];
    S.pool[part.t].push(part);
    log(`${p.name} returns "${part.name}" to the pool.`, p);
  }
  refillPools();
  p.netNew = [];
}

/* ---------------- actions ---------------- */

function canDo(card, k) { return card.type === 'D' || ACT[k].who === '*' || ACT[k].who === card.type; }

function feeFor(p, card, k) {
  const n = S.spaces[k].length;
  let fee = S.players.length >= 4 ? (n <= 1 ? 0 : n === 2 ? 1 : 2) : (n === 0 ? 0 : n === 1 ? 1 : 2);
  if (fee && card.type === 'A' && hasSkill(p, 'artistsFree')) fee = 0;
  if (fee && card.type === 'P' && hasSkill(p, 'producersEarn')) fee = -fee;
  return fee;
}

function staffOptions(p, promoteOnly) {
  const opts = [];
  for (const t in S.market) {
    const c = S.market[t];
    if (!c) continue;
    if (!promoteOnly && p.staff.length < 6) opts.push({ t, hire: true });
    p.staff.forEach((s, si) => {
      if (s.card.type === t && (s.card.dead || p.staff.length >= 6)) opts.push({ t, si });
    });
  }
  return opts;
}
function freeLeverages(p) {
  return [0, 1, 2, 3].filter((i) => S.locks[i] == null && (i !== 1 || staffOptions(p, true).length));
}

function legalSpace(p, si, k) {
  const s = p.staff[si];
  if (!s || !s.token || !canDo(s.card, k)) return false;
  if (k === 'staffing') return staffOptions(p, false).length > 0;
  if (k === 'strategize') return freeLeverages(p).length > 0;
  return true;
}

function pay(p, n) {
  while (p.money < n) {
    p.debts.push({ interest: 0 });
    p.money += 7;
    log(`${p.name} takes a Debt card (+7¥).`, p);
  }
  p.money -= n;
}

function addRep(p, n) {
  p.rep += n;
  if (p.rep > REP_CAP) { p.money += p.rep - REP_CAP; p.rep = REP_CAP; }
}

function addLevel(p, n) { p.level = Math.min(levelCap(p), p.level + n); }

function gainMerch(p) {
  if (p.merchActive >= 4) addRep(p, 1);
  else if (p.merchInv > 0) { p.merchInv--; p.merchActive++; }
  else p.merchInv++;
}

function addBundle(a, b) { for (const k in b) a[k] = (a[k] || 0) + b[k]; return a; }

function bundleText(b) {
  const parts = [];
  if (b.reveal) parts.push(`${b.reveal} reveal`);
  if (b.pick) parts.push(`pick ${b.pick}`);
  if (b.money) parts.push(`+${b.money}¥`);
  if (b.hype) parts.push(`+${b.hype} Hype`);
  if (b.lvl) parts.push(`+${b.lvl} level`);
  if (b.merch) parts.push(`+${b.merch} Merch`);
  if (b.net) parts.push(`+${b.net} Network`);
  if (b.rep) parts.push(`+${b.rep}★`);
  return parts.join(', ');
}

async function gain(p, b) {
  if (b.money) p.money += b.money;
  if (b.hype) p.hype += b.hype;
  if (b.rep) addRep(p, b.rep);
  if (b.lvl) addLevel(p, b.lvl);
  for (let i = 0; i < (b.merch || 0); i++) gainMerch(p);
  if (b.net) await drawNet(p, b.net);
  if (b.reveal) await reveal(p, b.reveal);
  if (b.pick) await pick(p, b.pick);
}

async function doAction(p, si, k) {
  const s = p.staff[si];
  const card = s.card;
  s.token = false;
  const fee = feeFor(p, card, k);
  S.spaces[k].push(p.id);
  log(`${p.name}: ${card.dead ? 'Dead-Inside' : card.name} ${card.dead ? STAFF_TYPES[card.type].name.toLowerCase() + ' ' : ''}takes ${ACT[k].name}.`, p);
  if (fee > 0) { pay(p, fee); log(`High Demand Fee: -${fee}¥.`, p); }
  if (fee < 0) { p.money -= fee; log(`Hard negotiator collects ${-fee}¥ instead of paying the fee.`, p); }
  if (k === 'staffing' || k === 'strategize') pay(p, 2);

  let bonus = !card.dead;
  if (bonus && S.solo && S.solo.crunch) {
    bonus = p.ai ? true : await choose(p, `Crunch Time: take the Genki bonus (${ACT[k].bonus})? This staff then burns out into a Dead-Inside ${STAFF_TYPES[card.type].name}.`, [{ label: 'Take the bonus', v: true }, { label: 'No bonus', v: false }]);
  }
  const b = addBundle({}, BASE[k]);
  if (bonus) addBundle(b, BONUS[k]);
  const sk = card.skill;
  if (sk && Array.isArray(sk.on) && sk.on.includes(k) && sk.gain && (!sk.cond || sk.cond(p))) {
    addBundle(b, sk.gain);
    log(`${card.name} skill: ${bundleText(sk.gain)}.`, p);
  }
  if (k === 'staffing') await staffing(p, false);
  if (k === 'strategize') await leverage(p);
  await gain(p, b);
  if (sk && sk.id === 'connected' && sk.on.includes(k)) {
    const others = ACTIONS.filter((a) => a.k !== k);
    const pickK = p.ai ? aiConnected(p) : await choose(p, 'Connected to everything: gain the Genki bonus of another action.', others.map((a) => ({ label: `${a.name}: ${a.bonus}`, v: a.k })));
    log(`Connected to everything copies the ${ACT[pickK].name} bonus.`, p);
    await gain(p, BONUS[pickK]);
  }
  await playNetwork(p, k);
  if (bonus && S.solo && S.solo.crunch) {
    const idx = p.staff.indexOf(s);
    p.staff[idx] = { card: DEAD[card.type], token: false };
    log(`${card.name} burns out and becomes Dead-Inside.`, p);
  }
  render();
}

async function staffing(p, promoteOnly) {
  const opts = staffOptions(p, promoteOnly);
  if (!opts.length) return;
  let o;
  if (p.ai) o = aiStaffChoice(p, opts);
  else {
    o = await choose(p, promoteOnly ? 'Promote: choose a Genki Staff and who they replace.' : 'Staffing: hire a new Genki Staff, or promote one of yours.', opts.map((o) => {
      const c = S.market[o.t];
      return { v: o, img: imgOf(c), label: o.hire ? `Hire ${c.name}` : `Promote ${p.staff[o.si].card.dead ? 'Dead-Inside' : p.staff[o.si].card.name} → ${c.name}` };
    }));
  }
  const card = S.market[o.t];
  S.market[o.t] = null;
  if (!S.solo) S.market[o.t] = S.decks[o.t].shift() || null;
  if (o.hire) {
    p.staff.push({ card, token: false, onboard: true });
    log(`${p.name} hires ${card.name} (onboarding until next round).`, p);
  } else {
    const old = p.staff[o.si];
    if (!old.card.dead) S.decks[old.card.type].push(old.card);
    p.staff[o.si] = { card, token: old.token };
    log(`${p.name} promotes to ${card.name}.`, p);
  }
}

async function leverage(p) {
  const free = freeLeverages(p);
  const i = p.ai ? aiLeverage(p, free) : await choose(p, 'Strategize: choose a Leverage.', free.map((i) => ({ label: `${LEVERAGES[i].name}: ${LEVERAGES[i].text}`, v: i })));
  S.locks[i] = p.id;
  log(`${p.name} locks the "${LEVERAGES[i].name}" Leverage.`, p);
  if (i === 0) { S.first = p.id; p.money += 4; }
  if (i === 1) await staffing(p, true);
  if (i === 2) gainMerch(p);
  if (i === 3) p.hype += Math.max(0, 6 - deadCount(p));
}

async function reveal(p, n) {
  for (let i = 0; i < n; i++) {
    const avail = PART_TYPES.filter((t) => S.sdeck[t].length);
    if (!avail.length) return;
    const t = p.ai ? aiRevealType(p, avail) : await ask('reveal', { pid: p.id, left: n - i, prompt: `Reveal ${n - i} more Script Part${n - i > 1 ? 's' : ''}: click a face-down pile.` });
    S.pool[t].push(S.sdeck[t].pop());
    render();
  }
}

async function pick(p, n) {
  for (let i = 0; i < n; i++) {
    if (!PART_TYPES.some((t) => S.pool[t].length)) return;
    const r = p.ai ? aiPickPart(p) : await ask('pick', { pid: p.id, left: n - i, prompt: `Pick ${n - i} Script Part${n - i > 1 ? 's' : ''} from the common pool into your Storage.` });
    if (!r) return;
    const part = S.pool[r.t].splice(r.i, 1)[0];
    p.storage.push(part);
    log(`${p.name} picks "${part.name}" (${GENRES[part.g].name} ${SCRIPT_TYPES[part.t]}).`, p);
    if (p.ai) aiPlaceParts(p);
    render();
  }
}

function refillPools() {
  for (const t of PART_TYPES) if (!S.pool[t].length && S.sdeck[t].length) S.pool[t].push(S.sdeck[t].pop());
}

function placePart(p, idx) {
  const part = p.storage[idx];
  if (!part || p.prod[part.t]) return false;
  p.prod[part.t] = part;
  p.storage.splice(idx, 1);
  log(`${p.name} puts "${part.name}" In Production.`, p);
  return true;
}

async function drawNet(p, n) {
  const fortune = hasSkill(p, 'fortune');
  const total = n + (fortune ? 1 : 0);
  for (let i = 0; i < total; i++) {
    if (!S.ndeck.length) { S.ndeck = shuffle(S.ndisc); S.ndisc = []; }
    const c = S.ndeck.pop();
    if (!c) break;
    p.net.push(c);
    p.netNew.push(c);
  }
  log(`${p.name} draws ${total} Network card${total > 1 ? 's' : ''}.`, p);
  if (fortune && p.net.length) {
    const i = p.ai ? 0 : await choose(p, 'Fortune teller: discard 1 Network card from your hand.', p.net.map((c, i) => ({ label: `${c.name} (${netTriggers(c)}: ${netText(c)})`, v: i })));
    const c = p.net.splice(i, 1)[0];
    p.netNew = p.netNew.filter((x) => x !== c);
    S.ndisc.push(c);
  }
}

const netTriggers = (c) => c.on.map((k) => ACT[k].name).join(' / ');
const netText = (c) => c.text || bundleText(c.gain);

async function playNetwork(p, k) {
  const ok = p.net.filter((c) => c.on.includes(k) && !p.netNew.includes(c));
  if (!ok.length) return;
  let c;
  if (p.ai) c = ok[0];
  else c = await choose(p, `Play a Network card triggered by ${ACT[k].name}? (one per action)`, [...ok.map((c) => ({ label: `${c.name}: ${netText(c)}`, v: c })), { label: 'Keep my cards', v: null }]);
  if (!c) return;
  p.net.splice(p.net.indexOf(c), 1);
  S.ndisc.push(c);
  const b = addBundle({}, c.gain);
  if (c.per) for (const key in c.per) b[key] = (b[key] || 0) + c.per[key] * p.released.length;
  log(`${p.name} plays ${c.name}${bundleText(b) ? ': ' + bundleText(b) : ''}.`, p);
  await gain(p, b);
}

/* ---------------- release ---------------- */

function canRelease(p) { return prodParts(p).length === 3 && p.level >= 1; }
function couldRelease(p) {
  if (p.level < 1) return false;
  return PART_TYPES.every((t) => p.prod[t] || p.storage.some((x) => x.t === t));
}

function genreBonus(card, gs) {
  let pop = 0, lvl = 0;
  for (const b of card.gen || []) {
    const n = b.per ? gs.filter((g) => g === b.g).length : gs.includes(b.g) ? 1 : 0;
    if (b.k === 'pop') pop += b.n * n; else lvl += b.n * n;
  }
  return { pop, lvl };
}

function releaseOptions(p) {
  const gs = prodParts(p).map((x) => x.g);
  const mt = S.trends.map((t) => matchCount(gs, t.card.g));
  const maxM = Math.max(...mt);
  const opts = [];
  if (!(S.solo && S.solo.cultOnly)) mt.forEach((m, i) => { if (m >= 1) opts.push(i); });
  if (maxM === 0 || (hasSkill(p, 'cultist') && maxM <= 1)) opts.push('cult');
  return { opts, mt };
}

function calcRelease(p, sel, spend) {
  const gs = prodParts(p).map((x) => x.g);
  const { mt } = releaseOptions(p);
  const cult = sel === 'cult';
  const ti = cult ? -1 : sel;
  const trend = cult ? null : S.trends[ti];
  const lines = [];
  let lvl = p.level, pop = 0, money = 0, hype = 0;
  const has = (id) => hasSkill(p, id);

  const bonuses = p.staff.filter((s) => !s.card.dead).map((s) => ({ s, ...genreBonus(s.card, gs) }));
  for (const b of bonuses) {
    if (b.pop) { pop += b.pop; lines.push(`${b.s.card.name}: +${b.pop}♥`); }
    if (b.lvl) { lvl += b.lvl; lines.push(`${b.s.card.name}: +${b.lvl} level`); }
  }
  if (has('chameleon')) {
    const best = bonuses.filter((b) => b.s.card.skill?.id !== 'chameleon').sort((a, b) => (b.pop + b.lvl * 3) - (a.pop + a.lvl * 3))[0];
    if (best && (best.pop || best.lvl)) {
      pop += best.pop; lvl += best.lvl;
      lines.push(`Chameleon copies ${best.s.card.name}`);
    }
  }
  if (has('pressure') && p.debts.length >= 2) { lvl += 1; lines.push('Better under pressure: +1 level'); }
  lvl = Math.min(6, lvl);
  const matches = cult ? 4 : mt[ti];
  const base = matches * lvl;

  if (has('newgen') && ti === 0) { hype += 4; lines.push('New generation: +4 Hype'); }
  if (has('idol')) { const h = Math.max(0, 5 - deadCount(p)); hype += h; lines.push(`Harmony bringer idol: +${h} Hype`); }
  if (has('community') && trend && !trend.token) { money += 3; hype += 3; lines.push('Community specialist: +3¥ +3 Hype'); }
  if (has('pastlife') && ti === 2) { pop += 5; lines.push('Living in the past: +5♥'); }
  if (has('superalt') && (ti === 0 || ti === 2)) { pop += 3; lines.push('Super alternative: +3♥'); }
  if (has('moremore') && lvl <= 2) { pop += 5; lines.push('More! Moreee!: +5♥'); }

  const hypeAvail = p.hype + hype;
  spend = Math.max(0, Math.min(spend, hypeAvail));
  pop += spend;
  if (spend && has('meishi')) { pop += spend; lines.push(`Meishi master: +${spend}♥`); }
  if (spend && has('analog')) { money += spend; lines.push(`Analog only: +${spend}¥`); }
  if (ti === 1) { pop += 3; lines.push('Active Trend: +3♥'); }
  const tokenBonus = !!(trend && trend.token && mt[ti] === 3);
  if (tokenBonus) { pop += 4; lines.push('First to match all 3 genres: +4♥'); }
  const total = base + pop;
  if (has('influencer') && total >= 15) { money += 5; lines.push('Influencer: +5¥'); }

  const tier = REWARDS.filter((r) => total >= r.min).pop();
  let tierMoney = tier.money, rep = tier.rep, merch = 1 + (has('toy') ? 1 : 0), hypeAfter = 0;
  if (ti === 0) hypeAfter += 2;
  if (ti === 2) tierMoney += 3;
  let blocked = false;
  if (S.solo && S.solo.min20 && total < 20) { tierMoney = 0; rep = 0; merch = 0; hypeAfter = 0; blocked = true; }
  return { sel, cult, ti, matches, lvl, base, pop, total, money: money + tierMoney, rep, merch, hypeAvail, spend, hypeAfter, lines, tokenBonus, blocked, tier };
}

function bestRelease(p) {
  const { opts } = releaseOptions(p);
  let best = null;
  for (const sel of opts) {
    const avail = calcRelease(p, sel, 0).hypeAvail;
    for (let h = 0; h <= avail; h++) {
      const c = calcRelease(p, sel, h);
      const last = S.round === S.rounds;
      const v = c.rep * 3 + c.money * (last ? 0.2 : 0.6) - h * (last ? 0.1 : 0.7) + c.hypeAfter * 0.4;
      if (!best || v > best.v) best = { v, sel, h };
    }
  }
  return best;
}

async function releasePhase() {
  S.phase = 'release';
  log(`Round ${S.round}: Release Phase.`);
  render();
  for (const p of seatOrder()) {
    S.cur = p.id;
    let fulfilled = false;
    if (p.ai) {
      aiPlaceParts(p);
      if (canRelease(p) && releaseOptions(p).opts.length) {
        await wait();
        const b = bestRelease(p);
        fulfilled = await doRelease(p, b.sel, b.h);
      }
    } else if (couldRelease(p)) {
      S.view = p.id;
      const r = await ask('release', { pid: p.id, rsel: null, rhype: 0, swapped: false });
      if (r) fulfilled = await doRelease(p, r.sel, r.hype);
      else log(`${p.name} holds their anime for later.`, p);
    }
    if (S.solo && S.solo.boom && !fulfilled) {
      const open = S.opps.filter((o) => o.up && !o.taken);
      if (open.length) {
        const o = await choose(p, 'Studio Boom: you did not fulfill an Opportunity card, so you must discard one.', open.map((o) => ({ label: `${o.card.name}: ${o.card.text}`, v: o })));
        o.taken = 'discarded';
        log(`${o.card.name} is discarded.`, p);
      }
    }
    render();
  }
  S.cur = null;
  shiftTrends();
}

async function doRelease(p, sel, spend) {
  const c = calcRelease(p, sel, spend);
  const parts = prodParts(p);
  p.hype = c.hypeAvail - c.spend + c.hypeAfter;
  p.money += c.money;
  addRep(p, c.rep);
  for (let i = 0; i < c.merch; i++) gainMerch(p);
  if (c.tokenBonus) S.trends[c.ti].token = false;
  const rec = { parts, genres: parts.map((x) => x.g), level: c.lvl, pop: c.total, cult: c.cult, matches: c.matches, hypeSpent: c.spend, ti: c.ti, title: parts[0].name, round: S.round };
  p.released.push(rec);
  p.prod = { set: null, plot: null, twist: null };
  p.level = 0;
  const where = c.cult ? 'as a Cult release' : `following ${['the Upcoming', 'the Active', 'the Fading'][c.ti]} Trend "${S.trends[c.ti].card.name}"`;
  log(`${p.name} releases "${rec.title}" ${where}: ${c.total}♥ → +${c.money}¥, +${c.rep}★.`, p);
  return await opportunities(p, rec);
}

async function opportunities(p, rec) {
  const ok = S.opps.filter((o) => o.up && !o.taken && o.card.test(p, rec));
  if (!ok.length) return false;
  let chosen;
  if (S.solo && S.solo.anyOpps) chosen = ok;
  else if (p.ai) chosen = [ok.sort((a, b) => (b.card.rep + b.bonus) - (a.card.rep + a.bonus))[0]];
  else {
    const o = await choose(p, 'You may fulfill 1 Opportunity card.', [...ok.map((o) => ({ label: `${o.card.name}: +${o.card.rep + o.bonus}★`, v: o })), { label: 'Skip', v: null }]);
    chosen = o ? [o] : [];
  }
  for (const o of chosen) {
    o.taken = p.id;
    addRep(p, o.card.rep + o.bonus);
    log(`${p.name} fulfills ${o.card.name}: +${o.card.rep + o.bonus}★.`, p);
  }
  return chosen.length > 0;
}

function drawTrend() {
  if (!S.tdeck.length) { S.tdeck = shuffle(S.tdisc); S.tdisc = []; }
  return { card: S.tdeck.pop(), token: true };
}

function shiftTrends() {
  S.tdisc.push(S.trends[2].card);
  let next = [null, S.trends[0], S.trends[1]];
  if (S.solo) {
    next = next.map((t) => (t && t.token ? t : (t && S.tdisc.push(t.card), null)));
  }
  S.trends = next.map((t) => t || drawTrend());
  log(`Trends move on. New Upcoming Trend: ${S.trends[0].card.name}.`);
}

/* ---------------- upkeep ---------------- */

async function upkeepPhase() {
  S.phase = 'upkeep';
  log(`Round ${S.round}: Upkeep Phase.`);
  render();
  const last = S.round === S.rounds;
  for (const p of seatOrder()) {
    S.cur = p.id;
    if (S.solo && S.solo.media) {
      for (let i = 0; i < deadCount(p) && p.storage.length; i++) {
        const idx = await ask('discard', { pid: p.id, prompt: 'Media Pressure: lose 1 Script Part from Storage per Dead-Inside Staff.' });
        const part = p.storage.splice(idx, 1)[0];
        S.pool[part.t].push(part);
      }
      p.hype += genkiCount(p);
    }
    const inc = MERCH_INCOME[p.merchActive];
    if (inc) { p.money += inc.money; addRep(p, inc.rep); log(`${p.name} Merchandise income: +${inc.money}¥${inc.rep ? `, +${inc.rep}★` : ''}.`, p); }
    if (hasSkill(p, 'history')) { log('History geek researches.', p); await reveal(p, 2); await pick(p, 1); await endTurn(p); }
    if (hasSkill(p, 'investment') && p.debts.length) { p.money += p.debts.length; log(`Investment wizard: +${p.debts.length}¥.`, p); }
    if (hasSkill(p, 'hen')) { const v = 6 - deadCount(p); p.money += v; log(`Mother hen: ${v >= 0 ? '+' : ''}${v}¥.`, p); }

    // pay debts
    while (p.debts.length) {
      const d = p.debts.slice().sort((a, b) => debtCost(a) - debtCost(b))[0];
      if (p.money < debtCost(d)) break;
      let go;
      if (p.ai) go = aiPayDebt(p, d);
      else { S.view = p.id; go = await choose(p, `Upkeep: pay back a Debt card for ${debtCost(d)}¥? Each unpaid Debt costs 2★ at the end.`, [{ label: `Pay ${debtCost(d)}¥`, v: true }, { label: 'Keep the debt', v: false }]); }
      if (!go) break;
      p.money -= debtCost(d);
      p.debts.splice(p.debts.indexOf(d), 1);
      log(`${p.name} pays back a Debt card.`, p);
      if (hasSkill(p, 'invoice')) { addRep(p, 1); log('Invoice police: +1★.', p); }
    }
    if (!hasSkill(p, 'investment') && !hasSkill(p, 'invoice')) for (const d of p.debts) d.interest++;
    let salary = sum(p.staff.map((s) => (s.card.dead ? 1 : 2)));
    if (hasSkill(p, 'cold')) salary -= genkiCount(p);
    salary = Math.max(0, salary);
    pay(p, salary);
    log(`${p.name} pays ${salary}¥ in salaries.`, p);
    if (S.solo && S.solo.trendBuy && !last && p.money >= 2) {
      const i = await choose(p, 'Trend Manipulation: pay 2¥ to discard a Trend card?', [...S.trends.map((t, i) => ({ label: `Discard ${t.card.name}`, v: i })), { label: 'No', v: null }]);
      if (i != null) {
        pay(p, 2);
        S.tdisc.push(S.trends[i].card);
        S.trends.splice(i, 1);
        S.trends.unshift(drawTrend());
      }
    }
    render();
  }
  if (!last) {
    for (const p of S.players) for (const s of p.staff) { s.token = true; s.onboard = false; }
    for (const t in S.market) {
      if (S.market[t]) S.decks[t].push(S.market[t]);
      S.market[t] = S.decks[t].shift() || null;
    }
    S.locks = [null, null, null, null];
    const o = S.opps.find((o) => !o.up);
    if (o) { o.up = true; log(`New Opportunity revealed: ${o.card.name}.`); }
    if (S.solo && S.solo.upkeepReveal) for (const t of PART_TYPES) if (S.sdeck[t].length) S.pool[t].push(S.sdeck[t].pop());
  }
  S.spaces = Object.fromEntries(ACTIONS.map((a) => [a.k, []]));
  S.cur = null;
}

function finish() {
  S.phase = 'end';
  S.over = true;
  for (const p of S.players) if (p.debts.length) log(`${p.name} loses ${2 * p.debts.length}★ for unpaid debts.`, p);
  render();
  openModal('end');
}

/* ---------------- AI ---------------- */

function trendFit(genres) {
  return Math.max(...S.trends.map((t, i) => matchCount(genres, t.card.g) + (i === 1 ? 0.3 : 0) + (t.token && matchCount(genres, t.card.g) === 3 ? 0.5 : 0)));
}
function prodGenres(p) { return prodParts(p).map((x) => x.g); }
function needTypes(p) { return PART_TYPES.filter((t) => !p.prod[t] && !p.storage.some((x) => x.t === t)); }

function partValue(p, part) {
  const fit = trendFit([...prodGenres(p), part.g]) - trendFit(prodGenres(p));
  if (!p.prod[part.t]) return (needTypes(p).includes(part.t) ? 10 : 4) + fit * 2;
  return 1 + trendFit([part.g]) * 0.3;
}

function aiPlaceParts(p) {
  for (const t of PART_TYPES) {
    if (p.prod[t]) continue;
    const cands = p.storage.map((x, i) => ({ x, i })).filter((o) => o.x.t === t);
    if (!cands.length) continue;
    cands.sort((a, b) => trendFit([...prodGenres(p), b.x.g]) - trendFit([...prodGenres(p), a.x.g]));
    placePart(p, cands[0].i);
  }
}

function aiWorstPart(p) {
  let worst = 0, wv = Infinity;
  p.storage.forEach((x, i) => { const v = partValue(p, x); if (v < wv) { wv = v; worst = i; } });
  return worst;
}

function aiRevealType(p, avail) {
  const need = needTypes(p).filter((t) => avail.includes(t));
  const pool = need.length ? need : avail;
  return pool[Math.floor(Math.random() * pool.length)];
}

function aiPickPart(p) {
  let best = null;
  for (const t of PART_TYPES) S.pool[t].forEach((x, i) => {
    const v = partValue(p, x);
    if (!best || v > best.v) best = { t, i, v };
  });
  if (!best) return null;
  if (best.v < 2 && p.storage.length >= 4) return null;
  return best;
}

function aiStaffChoice(p, opts) {
  const val = (o) => {
    const c = S.market[o.t];
    let v = (c.skill ? 1 : 0) + (c.type === 'D' ? 1.5 : 0) + genreBonus(c, prodGenres(p)).pop * 0.3;
    if (o.hire) v += S.round <= 2 ? 3 : 1;
    else if (p.staff[o.si].card.dead) v += 2.5;
    else v -= 2;
    return v;
  };
  return opts.slice().sort((a, b) => val(b) - val(a))[0];
}

function aiLeverage(p, free) {
  const v = { 0: 3, 1: 4.5, 2: S.round < S.rounds ? 4 : 1.5, 3: Math.max(0, 6 - deadCount(p)) * 0.7 };
  return free.slice().sort((a, b) => v[b] - v[a])[0];
}

function aiConnected(p) {
  if (prodParts(p).length && p.level < levelCap(p)) return 'animate';
  return 'outsource';
}

function aiPayDebt(p, d) {
  if (S.round === S.rounds) return true;
  const salary = sum(p.staff.map((s) => (s.card.dead ? 1 : 2)));
  return p.money - debtCost(d) >= salary + 3;
}

function actionValue(p, k, card) {
  const need = needTypes(p).length;
  const last = S.round === S.rounds;
  const nProd = prodParts(p).length;
  const genki = !card.dead;
  let v = 0;
  switch (k) {
    case 'write': v = need ? 6 + 2 * need : (!last && p.storage.length < 4 ? 2.5 : 0.2); if (genki) v += 1; break;
    case 'research': v = need ? 5.5 + 1.5 * need : (!last && p.storage.length < 4 ? 2 : 0.1); if (genki) v += 1; break;
    case 'animate':
      if (p.level >= levelCap(p)) v = 0;
      else if (nProd === 3) v = p.level < 3 ? 9 : p.level < 5 ? 7 : 5;
      else v = 3.5;
      if (genki) v += 2;
      break;
    case 'outsource': v = p.money < 3 ? 7 : p.money < 7 ? 4.5 : 2.5; if (genki) v += 1.5; break;
    case 'staffing': v = S.round <= 2 ? 6 : S.round === 3 && !last ? 3 : 0.3; if (p.money < 2) v -= 2; if (genki) v += 1; break;
    case 'networking': v = last ? 1 : 3; if (genki) v += 1.5; break;
    case 'strategize': v = 2.5 + (genki ? 1 : 0); if (p.money < 2) v -= 2; break;
  }
  // a playable network card makes the action better
  if (p.net.some((c) => c.on.includes(k))) v += 1.5;
  return v;
}

async function aiTurn(p) {
  aiPlaceParts(p);
  if (p.hype >= 6 && p.merchActive < 4 && S.round < S.rounds) { p.hype -= 4; gainMerch(p); log(`${p.name} trades 4 Hype for Merchandise.`, p); }
  let best = null;
  p.staff.forEach((s, si) => {
    if (!s.token) return;
    for (const a of ACTIONS) {
      if (!legalSpace(p, si, a.k)) continue;
      let v = actionValue(p, a.k, s.card);
      const fee = feeFor(p, s.card, a.k);
      v -= Math.max(0, fee) * 0.9;
      if (p.money - Math.max(0, fee) - (a.k === 'staffing' || a.k === 'strategize' ? 2 : 0) < 0) v -= 2.5;
      if (s.card.type === 'D' && a.who !== '*') v -= 0.7;
      v += Math.random() * 0.4;
      if (!best || v > best.v) best = { v, si, k: a.k };
    }
  });
  if (!best || best.v <= 0.5) {
    p.passed = true;
    for (const s of p.staff) s.token = false;
    log(`${p.name} ends their Production Phase.`, p);
    return;
  }
  await doAction(p, best.si, best.k);
  aiPlaceParts(p);
}
