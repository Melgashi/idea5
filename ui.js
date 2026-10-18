// Rendering and input for JISOGI. render() rebuilds the table from S on every change.

const $ = (s) => document.querySelector(s);
const TYPE_CLASS = { W: 'writer', A: 'artist', P: 'producer', D: 'director', '*': 'strat' };
const TREND_SLOTS = [
  { name: 'Upcoming Trend', bonus: '+2 Hype' },
  { name: 'Active Trend', bonus: '+3♥' },
  { name: 'Fading Trend', bonus: '+3¥' },
];

const gBadge = (g) => `<span class="gb g-${g}" title="${GENRES[g].name}"><span>${g === 'L' ? 'SL' : g === 'S' ? 'SF' : g}</span></span>`;
const pColor = (id) => (id === 'hd' ? 'var(--hd)' : S.players[id].color);

function partEl(part, act, v) {
  const tag = act ? 'button' : 'div';
  return `<${tag} class="part g-${part.g}${act ? ' can' : ''}" ${act ? `data-act="${act}" data-v="${v}" type="button"` : ''} title="${esc(GENRES[part.g].name + ' ' + SCRIPT_TYPES[part.t] + ': ' + part.name)}">
    <span class="pt">${SCRIPT_TYPES[part.t]} · ${GENRES[part.g].name}</span><span class="pn">${esc(part.name)}</span></${tag}>`;
}

function uiFor(p) { return S.ui && S.ui.pid === p.id ? S.ui.mode : null; }
function freeActionsOpen(p) { const m = uiFor(p); return m === 'turn' || m === 'release'; }

/* ---------------- header & prompt ---------------- */

function renderHeader() {
  const phases = ['production', 'release', 'upkeep'];
  const dots = Array.from({ length: S.rounds }, (_, i) => `<span class="rdot${i + 1 < S.round ? ' done' : ''}${i + 1 === S.round ? ' now' : ''}"></span>`).join('');
  return `<header class="top">
    <div class="brand"><span class="logo">JISOGI</span><span class="sub">Anime Studio Tycoon</span></div>
    <div class="status">
      <span class="rounds" title="Round ${S.round} of ${S.rounds}">${dots}<b>Year ${Math.min(S.round, S.rounds)}/${S.rounds}</b></span>
      <span class="phases">${phases.map((ph) => `<span class="ph${S.phase === ph ? ' on' : ''}">${ph}</span>`).join('')}</span>
      ${S.solo ? `<span class="solo-tag">Solo #${S.solo.n} · ${S.solo.name}</span>` : ''}
    </div>
    <div class="menu">
      <label class="speed">AI speed
        <select id="speed">${[[900, 'Slow'], [550, 'Normal'], [180, 'Fast']].map(([v, n]) => `<option value="${v}"${S.delay === v ? ' selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      <button type="button" class="btn ghost" data-act="aid">Player aid</button>
      <button type="button" class="btn ghost" data-act="setup">New game</button>
    </div>
  </header>`;
}

function renderPrompt() {
  const u = S.ui || { mode: 'wait' };
  const cur = S.cur != null ? S.players[S.cur] : null;
  let text = '', btns = '';
  switch (u.mode) {
    case 'turn': {
      const p = S.players[u.pid];
      text = u.sel == null
        ? `<b>${esc(p.name)}</b>, your turn. Pick a staff card with a token, then a highlighted action.`
        : `Send <b>${esc(p.staff[u.sel].card.dead ? 'Dead-Inside ' + STAFF_TYPES[p.staff[u.sel].card.type].name : p.staff[u.sel].card.name)}</b> to a highlighted action.`;
      btns = `<button type="button" class="btn" data-act="pass">End my Production Phase</button>`;
      break;
    }
    case 'reveal': case 'discard': text = esc(u.prompt); break;
    case 'pick': text = esc(u.prompt); btns = `<button type="button" class="btn ghost" data-act="done">Stop picking</button>`; break;
    case 'choose':
      text = esc(u.prompt);
      btns = u.options.map((o, i) => `<button type="button" class="btn opt${o.img ? ' withimg' : ''}" data-act="choose" data-v="${i}" ${o.img ? `data-img="${o.img}"` : ''}>${o.img ? `<img src="${o.img}" alt="">` : ''}<span>${esc(o.label)}</span></button>`).join('');
      break;
    case 'release': text = 'Release Phase: decide on your anime.'; break;
    default:
      if (S.phase === 'end') text = 'The game is over.';
      else if (cur && cur.ai) text = `<span class="think" style="--c:${cur.color}"></span><b>${esc(cur.name)}</b> is ${S.phase === 'production' ? 'working' : S.phase === 'release' ? 'releasing' : 'paying the bills'}…`;
      else text = `${S.phase[0].toUpperCase() + S.phase.slice(1)} Phase.`;
  }
  return `<div class="prompt${u.mode !== 'wait' ? ' live' : ''}"><div class="ptext">${text}</div><div class="pbtns${u.mode === 'choose' && u.options.some((o) => o.img) ? ' cards' : ''}">${btns}</div></div>`;
}

/* ---------------- action board ---------------- */

function renderActions() {
  const u = S.ui || {};
  const p = u.mode === 'turn' ? S.players[u.pid] : null;
  const sel = p && u.sel != null ? p.staff[u.sel] : null;
  const rows = ACTIONS.map((a) => {
    const legal = sel && legalSpace(p, u.sel, a.k);
    const stack = S.spaces[a.k] || [];
    let feeTxt = '';
    if (sel && canDo(sel.card, a.k)) {
      const f = feeFor(p, sel.card, a.k);
      feeTxt = f > 0 ? `fee +${f}¥` : f < 0 ? `earn ${-f}¥` : 'no fee';
    } else if (stack.length) {
      const n = stack.length;
      const f = S.players.length >= 4 ? (n <= 1 ? 0 : n === 2 ? 1 : 2) : (n === 0 ? 0 : n === 1 ? 1 : 2);
      feeTxt = f ? `next +${f}¥` : '';
    }
    const lev = a.k === 'strategize' ? `<div class="levs">${LEVERAGES.map((l, i) => `<div class="lev${S.locks[i] != null ? ' locked' : ''}" title="${esc(l.text)}"><b>0${i + 1}</b> ${esc(l.text)}${S.locks[i] != null ? `<span class="lock" style="--c:${pColor(S.locks[i])}"></span>` : ''}</div>`).join('')}</div>` : '';
    return `<div class="space t-${TYPE_CLASS[a.who]}${legal ? ' can' : ''}${sel && !legal ? ' dim' : ''}" ${legal ? `data-act="space" data-v="${a.k}" role="button" tabindex="0"` : ''}>
      <div class="sp-head"><span>${a.name}</span><small>${a.who === '*' ? 'Any staff' : STAFF_TYPES[a.who].name + 's'}</small></div>
      <div class="sp-body"><span>${a.base}</span><span class="redbox" title="Genki Staff bonus">${a.bonus}</span></div>
      <div class="sp-foot"><span class="stack">${stack.map((id) => `<span class="chip" style="--c:${pColor(id)}"></span>`).join('')}</span><span class="fee">${feeTxt}</span></div>
      ${lev}
    </div>`;
  }).join('');
  return `<section class="panel actions"><h2>Action board</h2>${rows}</section>`;
}

/* ---------------- center: trends, opportunities, scripts, market ---------------- */

function renderTrends() {
  const trends = S.trends.map((t, i) => `<div class="trend">
      <div class="tslot">${TREND_SLOTS[i].name} <b>${TREND_SLOTS[i].bonus}</b></div>
      <div class="tname">${esc(t.card.name)}</div>
      <div class="tgen">${t.card.g.map(gBadge).join('')}</div>
      ${t.token ? '<span class="ttoken" title="First release matching all 3 genres gains +4♥">+4♥</span>' : '<span class="ttoken gone">claimed</span>'}
    </div>`).join('');
  const opps = S.opps.map((o) => {
    if (!o.up) return `<div class="opp down"><span class="obonus">+${o.bonus}★</span><span class="oback">Opportunity</span></div>`;
    const taken = o.taken != null;
    return `<div class="opp${taken ? ' taken' : ''}"><span class="obonus">+${o.bonus}★</span>
      <b>${esc(o.card.name)}</b><span class="otext">${esc(o.card.text)}</span><span class="orep">+${o.card.rep}★</span>
      ${taken ? `<span class="oby">${o.taken === 'discarded' ? 'Discarded' : 'Claimed by ' + esc(S.players[o.taken].name)}</span>` : ''}</div>`;
  }).join('');
  return `<section class="panel trends"><h2>Trend board</h2><div class="trow">${trends}</div>
    <div class="cult">Cult release: ×4 genre matches, only when your anime matches no trend</div>
    <h3>Opportunities</h3><div class="orow">${opps}</div></section>`;
}

function renderScripts() {
  const u = S.ui || {};
  const cols = PART_TYPES.map((t) => {
    const canReveal = u.mode === 'reveal' && S.sdeck[t].length;
    const canPick = u.mode === 'pick';
    return `<div class="scol">
      <button type="button" class="pile${canReveal ? ' can' : ''}" ${canReveal ? `data-act="pile" data-v="${t}"` : 'disabled'}>
        <span>${SCRIPT_TYPES[t]}</span><small>${S.sdeck[t].length} face-down</small></button>
      <div class="plist">${S.pool[t].map((x, i) => partEl(x, canPick ? 'pool' : null, `${t}:${i}`)).join('') || '<span class="empty">empty</span>'}</div>
    </div>`;
  }).join('');
  return `<section class="panel scripts"><h2>Script Parts</h2><div class="scols">${cols}</div></section>`;
}

function renderMarket() {
  const u = S.ui || {};
  const p = u.mode === 'turn' ? S.players[u.pid] : null;
  const slots = ['W', 'A', 'P', 'D'].map((t) => {
    const c = S.market[t];
    const cycle = p && S.solo && S.solo.crunch && c && S.decks[t].length;
    return `<div class="mslot">
      ${c ? `<div class="card" data-img="${imgOf(c)}"><img src="${imgOf(c)}" alt="${esc(c.name)}" loading="lazy"></div>` : `<div class="card none"><img src="cards/back-genki.jpg" alt="" loading="lazy"><span>${S.decks[t].length ? 'Refills in Upkeep' : 'Deck empty'}</span></div>`}
      <div class="mlabel t-${TYPE_CLASS[t]}">${STAFF_TYPES[t].name}s <small>${S.decks[t].length} left</small></div>
      ${cycle ? `<button type="button" class="btn tiny" data-act="cycle" data-v="${t}">Cycle (1¥)</button>` : ''}
    </div>`;
  }).join('');
  return `<section class="panel market"><h2>Genki Staff pool</h2><div class="mrow">${slots}</div></section>`;
}

/* ---------------- players & log ---------------- */

function renderLog() {
  const logs = S.log.slice(0, 60).map((l) => `<li${l.color ? ` style="--c:${l.color}"` : ''}>${esc(l.msg)}</li>`).join('');
  return `<section class="panel log"><h2>Studio news</h2><ol>${logs}</ol></section>`;
}

/* ---------------- studio board ---------------- */

function renderStudio() {
  const p = S.players[S.view];
  const u = S.ui || {};
  const myTurn = uiFor(p) === 'turn';
  const free = freeActionsOpen(p);
  const hidden = p.ai || (S.ui.pid != null && S.ui.pid !== p.id && S.players.filter((x) => !x.ai).length > 1);

  const staff = p.staff.map((s, i) => {
    const can = myTurn && s.token;
    const img = imgOf(s.card);
    return `<div class="staff${can ? ' can' : ''}${myTurn && u.sel === i ? ' sel' : ''}${!s.token ? ' spent' : ''}" ${can ? `data-act="staff" data-v="${i}" role="button" tabindex="0"` : ''} data-img="${img}">
      <img src="${img}" alt="${esc(s.card.name)}" loading="lazy">
      ${s.token ? `<span class="chip big" style="--c:${p.color}"></span>` : ''}
      ${s.onboard ? '<span class="ribbon">Onboarding</span>' : ''}
      <span class="salary">${s.card.dead ? 1 : 2}¥</span>
    </div>`;
  }).join('') + Array.from({ length: 6 - p.staff.length }, () => '<div class="staff empty"><span>Open desk</span></div>').join('');

  const slots = PART_TYPES.map((t) => `<div class="pslot">${p.prod[t] ? partEl(p.prod[t]) : `<div class="part ghost"><span class="pt">${SCRIPT_TYPES[t]}</span><span class="pn">empty</span></div>`}</div>`).join('');
  const cap = levelCap(p);
  const track = Array.from({ length: 7 }, (_, i) => `<span class="lv${i === p.level ? ' on' : ''}${i > cap ? ' capped' : ''}">${i}</span>`).join('');

  const storagePick = u.mode === 'discard' && u.pid === p.id;
  const storage = p.storage.map((x, i) => {
    if (storagePick) return partEl(x, 'discard', i);
    if (free && !p.prod[x.t]) return partEl(x, 'place', i);
    return partEl(x);
  }).join('') || '<span class="empty">No Script Parts in storage</span>';

  const merch = `<div class="merch">${[1, 2, 3, 4].map((i) => `<div class="mbox${p.merchActive >= i ? ' on' : ''}${p.merchActive === i ? ' top' : ''}"><span class="box"></span><small>+${MERCH_INCOME[i].money}¥${MERCH_INCOME[i].rep ? ` +${MERCH_INCOME[i].rep}★` : ''}</small></div>`).join('')}<div class="minv" title="Inactive Merch Deal in inventory">${p.merchInv ? 'Inventory: 1 deal' : 'Inventory empty'}</div></div>`;

  const net = hidden ? `<span class="muted">${p.net.length} card${p.net.length === 1 ? '' : 's'} (hidden)</span>`
    : p.net.map((c) => `<div class="net${p.netNew.includes(c) ? ' fresh' : ''}" title="${p.netNew.includes(c) ? 'Usable from your next action' : ''}"><span class="ntrig">${netTriggers(c)}</span><b>${esc(c.name)}</b><span>${esc(netText(c))}</span></div>`).join('') || '<span class="muted">No Network cards</span>';

  const debts = p.debts.map((d) => `<span class="debt-card">Debt <b>${debtCost(d)}¥</b></span>`).join('') || '<span class="muted">No debts</span>';
  const released = p.released.map((r) => `<div class="rel"><span class="rtitle">${esc(r.title)}</span><span class="rgen">${r.genres.map(gBadge).join('')}</span><span>${r.pop}♥</span></div>`).join('') || '<span class="muted">Nothing released yet</span>';
  const tabs = S.players.map((x) => `<button type="button" class="tab${x.id === p.id ? ' on' : ''}${S.cur === x.id ? ' cur' : ''}" data-act="view" data-v="${x.id}" style="--c:${x.color}">
      <span class="tname2">${S.first === x.id ? '<span class="first" title="1st player">1st</span>' : ''}${esc(x.name)}${x.ai ? ' <small>AI</small>' : ''}</span>
      <span class="tstats"><span class="st rep">${x.rep}★</span><span class="st money">${x.money}¥</span><span class="st hype">${x.hype}h</span>${x.debts.length ? `<span class="st debt">${x.debts.length} debt</span>` : ''}<span class="st left">${x.staff.filter((s) => s.token).length} act.</span></span>
    </button>`).join('');
  const salary = Math.max(0, sum(p.staff.map((s) => (s.card.dead ? 1 : 2))) - (hasSkill(p, 'cold') ? genkiCount(p) : 0));

  return `<section class="studio" style="--c:${p.color}">
    <div class="tabs">${tabs}</div>
    <div class="sboard">
      <div class="sres">
        <div class="res rep"><span>Reputation</span><b>${p.rep}<small>/29★</small></b></div>
        <div class="res money"><span>Money</span><b>${p.money}¥</b></div>
        <div class="res hype"><span>Hype</span><b>${p.hype}</b></div>
        <div class="res"><span>Salaries due</span><b>${salary}¥</b></div>
        ${free ? `<div class="xch"><button type="button" class="btn tiny" data-act="h2m" ${p.hype < 1 ? 'disabled' : ''}>1 Hype → 1¥</button><button type="button" class="btn tiny" data-act="h2merch" ${p.hype < 4 ? 'disabled' : ''}>4 Hype → Merch</button></div>` : ''}
      </div>
      <div class="sstaff"><h3>Staff <small>max 6</small></h3><div class="staffrow">${staff}</div></div>
      <div class="sprod">
        <h3>Anime in production</h3><div class="pslots">${slots}</div>
        <div class="anim"><span class="alabel">Animation level</span><div class="lvtrack">${track}</div><small>${prodParts(p).length < 3 ? `Max level ${cap} with ${prodParts(p).length} part${prodParts(p).length === 1 ? '' : 's'} In Production` : 'Max level 6'}</small></div>
      </div>
      <div class="sstore"><h3>Storage <small>${S.solo && S.solo.noStorageCap ? 'no limit' : 'max 5'}${free ? ' · click a part to put it In Production (permanent)' : ''}</small></h3><div class="plist">${storage}</div></div>
      <div class="smerch"><h3>Merchandise deals</h3>${merch}</div>
      <div class="snet"><h3>Network cards</h3><div class="netrow">${net}</div></div>
      <div class="sdebt"><h3>Debt cards <small>-2★ each at the end</small></h3><div class="debts">${debts}</div></div>
      <div class="srel"><h3>Released anime</h3>${released}</div>
    </div>
  </section>`;
}

/* ---------------- modals ---------------- */

let modal = null;
function openModal(kind) { modal = kind; render(); }
function closeModal() { modal = null; }

function renderRelease() {
  const u = S.ui;
  const p = S.players[u.pid];
  const ready = canRelease(p);
  const missing = PART_TYPES.filter((t) => !p.prod[t]);
  let body = '';
  if (!ready) {
    body = `<p>Put a ${missing.map((t) => SCRIPT_TYPES[t]).join(', ')} In Production to release this year.</p>
      <div class="plist">${p.storage.map((x, i) => (missing.includes(x.t) ? partEl(x, 'place', i) : '')).join('')}</div>`;
  } else {
    const { opts, mt } = releaseOptions(p);
    if (!opts.length) {
      body = '<p>No trend option is available for this anime (it matches a trend partially, but only Cult releases are allowed).</p>';
    } else {
      if (u.rsel == null || !opts.includes(u.rsel)) { const b = bestRelease(p); u.rsel = b.sel; u.rhype = 0; }
      const c = calcRelease(p, u.rsel, u.rhype);
      u.rhype = c.spend;
      const optBtns = opts.map((o) => {
        const on = o === u.rsel;
        if (o === 'cult') return `<button type="button" class="ropt${on ? ' on' : ''}" data-act="rtrend" data-v="cult"><b>Cult release</b><span>×4 matches</span></button>`;
        const t = S.trends[o];
        return `<button type="button" class="ropt${on ? ' on' : ''}" data-act="rtrend" data-v="${o}"><small>${TREND_SLOTS[o].name} ${TREND_SLOTS[o].bonus}</small><b>${esc(t.card.name)}</b><span>${t.card.g.map(gBadge).join('')} ${mt[o]} match${mt[o] > 1 ? 'es' : ''}</span></button>`;
      }).join('');
      const swap = hasSkill(p, 'swap') && !u.swapped
        ? `<div class="swap"><h4>Words magician: swap one part with the pool</h4><div class="plist">${PART_TYPES.flatMap((t) => S.pool[t].map((x, i) => partEl(x, 'rswap', `${t}:${i}`))).join('')}</div></div>` : '';
      body = `<div class="ropts">${optBtns}</div>${swap}
        <div class="rhype"><span>Spend Hype for +1♥ each <small>(${c.hypeAvail} available)</small></span>
          <button type="button" class="btn tiny" data-act="rhype" data-v="-1" ${c.spend <= 0 ? 'disabled' : ''}>−</button><b>${c.spend}</b>
          <button type="button" class="btn tiny" data-act="rhype" data-v="1" ${c.spend >= c.hypeAvail ? 'disabled' : ''}>+</button></div>
        <div class="calc">
          <div class="formula"><span>${c.matches}</span> matches × <span>${c.lvl}</span> level = <b>${c.base}♥</b></div>
          <ul>${c.lines.map((l) => `<li>${esc(l)}</li>`).join('')}${c.spend ? `<li>Hype spent: +${c.spend}♥</li>` : ''}</ul>
          <div class="total">Popularity <b>${c.total}♥</b></div>
          <table class="rtable"><tr>${REWARDS.map((r) => `<th class="${r === c.tier ? 'on' : ''}">${r.min}+</th>`).join('')}</tr>
            <tr>${REWARDS.map((r) => `<td class="${r === c.tier ? 'on' : ''}">${r.money}¥</td>`).join('')}</tr>
            <tr>${REWARDS.map((r) => `<td class="${r === c.tier ? 'on' : ''}">${r.rep}★</td>`).join('')}</tr></table>
          <div class="reward">${c.blocked ? 'Award Machine: below 20♥, this release gives no reward.' : `You gain <b>+${c.money}¥</b>, <b>+${c.rep}★</b>, ${c.merch} Merch${c.hypeAfter ? `, +${c.hypeAfter} Hype` : ''}.`}</div>
        </div>`;
    }
  }
  const go = ready && releaseOptions(p).opts.length;
  return `<div class="modal release"><h2>Release “${esc((p.prod.set || p.storage[0] || { name: 'your anime' }).name)}”</h2>
    <div class="pslots">${PART_TYPES.map((t) => `<div class="pslot">${p.prod[t] ? partEl(p.prod[t]) : `<div class="part ghost"><span class="pt">${SCRIPT_TYPES[t]}</span><span class="pn">empty</span></div>`}</div>`).join('')}</div>
    <p class="lvl">Animation level ${p.level}</p>${body}
    <div class="mbtns"><button type="button" class="btn ghost" data-act="rskip">Hold it for later</button><button type="button" class="btn primary" data-act="rgo" ${go ? '' : 'disabled'}>Release!</button></div></div>`;
}

function renderEnd() {
  const ranked = S.players.slice().sort((a, b) => score(b) - score(a) || b.money - a.money);
  let head = '';
  if (S.solo) {
    const ok = S.solo.check(S.players[0]);
    head = `<p class="verdict ${ok ? 'win' : 'lose'}">${ok ? 'Challenge complete!' : 'Challenge failed.'}</p><p>Goal: ${esc(S.solo.goal)}</p>`;
  } else head = `<p class="verdict win">${esc(ranked[0].name)} wins the investors' support!</p>`;
  return `<div class="modal end"><h2>${S.solo ? 'Solo result' : 'Final standings'}</h2>${head}
    <table class="standings"><tr><th>Studio</th><th>Score</th><th>Rep.</th><th>Debts</th><th>Money</th><th>Released</th></tr>
    ${ranked.map((p) => `<tr style="--c:${p.color}"><td><span class="dot"></span>${esc(p.name)}</td><td><b>${score(p)}</b></td><td>${p.rep}</td><td>${p.debts.length ? '−' + 2 * p.debts.length : 0}</td><td>${p.money}¥</td><td>${p.released.length}</td></tr>`).join('')}</table>
    <div class="mbtns"><button type="button" class="btn ghost" data-act="close">Look at the table</button><button type="button" class="btn primary" data-act="setup">New game</button></div></div>`;
}

function renderAid() {
  return `<div class="modal aid"><h2>Player aid</h2>
    <div class="aidgrid">
      <div><h3>Production Phase</h3><p>Take turns moving one Studio Action token from a staff card to an action. Writers take blue actions, Artists green, Producers red, Directors anything; anyone can Strategize. Genki Staff also get the red-box bonus.</p>
        <table class="aidt">${ACTIONS.map((a) => `<tr><td class="t-${TYPE_CLASS[a.who]}">${a.name}</td><td>${a.base}</td><td class="red">${a.bonus}</td></tr>`).join('')}</table>
        <p><b>High Demand Fee</b>: 2–3 players: 2nd token +1¥, 3rd+ +2¥. 4 players: 3rd +1¥, 4th+ +2¥.</p></div>
      <div><h3>Release Phase</h3><ol><li>All players may release, starting with the 1st player. If they release, they gain a Merch Deal and may fulfill 1 Opportunity.</li><li>Move all Trend cards one space to the right.</li></ol>
        <p><b>Popularity</b> = genre matches × animation level + bonuses. Cult release (no trend match): ×4. Upcoming +2 Hype, Active +3♥, Fading +3¥. First to match all 3 genres of a trend: +4♥.</p>
        <table class="aidt"><tr><td>♥</td>${REWARDS.map((r) => `<td>${r.min}+</td>`).join('')}</tr><tr><td>¥</td>${REWARDS.map((r) => `<td>${r.money}</td>`).join('')}</tr><tr><td>★</td>${REWARDS.map((r) => `<td>${r.rep}</td>`).join('')}</tr></table>
        <p><b>Hype</b>: 1 → 1¥, 4 → 1 Merch, 1 → +1♥ when releasing.</p></div>
      <div><h3>Upkeep Phase</h3><ol><li>Gain the reward below your rightmost active Merch Deal (+3¥ / +6¥ +1★ / +9¥ +2★ / +12¥ +3★).</li><li>Pay Debt cards (if desired): 8¥ + interest.</li><li>Raise interest on Debt cards.</li><li>Pay salaries: Dead-Inside 1¥, Genki 2¥.</li><li>Recover all Studio Action tokens.</li><li>Refresh the Genki Staff pool.</li><li>Reset Lock tokens.</li><li>Flip the leftmost face-down Opportunity card.</li></ol></div>
      <div><h3>Scoring</h3><ol><li>−2★ per Debt card left unpaid at the end.</li><li>With 4 active Merch Deals, gain +1★ instead of a new deal.</li><li>Reputation caps at 29★; extra ★ become 1¥ each.</li></ol><p>Tie: most money wins. Whenever you can't pay, you automatically take a Debt card for +7¥.</p></div>
    </div>
    <div class="mbtns"><button type="button" class="btn primary" data-act="close">Close</button></div></div>`;
}

const setup = { tab: 'multi', n: 3, players: [{ name: 'My Studio', ai: false }, { name: PLAYER_NAMES[1], ai: true }, { name: PLAYER_NAMES[2], ai: true }, { name: PLAYER_NAMES[3], ai: true }], solo: 0, soloName: 'My Studio' };

function renderSetup() {
  const multi = `<div class="field"><span>Studios</span>${[2, 3, 4].map((n) => `<button type="button" class="seg${setup.n === n ? ' on' : ''}" data-act="snum" data-v="${n}">${n}</button>`).join('')}</div>
    ${setup.players.slice(0, setup.n).map((pl, i) => `<div class="prow" style="--c:${PLAYER_COLORS[i]}"><span class="dot"></span>
      <input id="pname${i}" data-i="${i}" class="pname-in" value="${esc(pl.name)}" maxlength="22" aria-label="Studio ${i + 1} name">
      <button type="button" class="seg${!pl.ai ? ' on' : ''}" data-act="sai" data-v="${i}:0">Human</button><button type="button" class="seg${pl.ai ? ' on' : ''}" data-act="sai" data-v="${i}:1">AI</button></div>`).join('')}
    <p class="hint">Several humans share this screen (hot-seat). Starting money: 3¥ / 4¥ / 5¥ / 6¥ in turn order.</p>`;
  const solo = `<div class="solos">${SOLO.map((s, i) => `<button type="button" class="solo${setup.solo === i ? ' on' : ''}${s.n <= 2 ? ' easy' : ''}" data-act="ssolo" data-v="${i}">
      <span class="sn">Solo variant #${s.n}</span><b>${esc(s.name)}</b>
      <span><b>Objective:</b> ${esc(s.goal)}</span><span><b>Rounds:</b> ${s.rounds} · <b>High-Demand:</b> ${s.hd} (${s.dbl ? 'double' : 'single'})</span>
      <ol>${s.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></button>`).join('')}</div>
    <p class="hint">Solo rules: High-Demand tokens block random actions each round, Trend cards without a +4♥ token are discarded, the staff pool only refreshes in Upkeep, and you start with 1 Debt card unless the challenge says otherwise. Challenges #1–2 are made for learning.</p>`;
  return `<div class="modal setup"><h2><span class="logo">JISOGI</span> Anime Studio Tycoon</h2>
    <p class="lede">Run a broke anime studio for four years. Hire staff, write scripts, chase the trends and release anime before the debts catch up with you.</p>
    <div class="tabs2"><button type="button" class="seg${setup.tab === 'multi' ? ' on' : ''}" data-act="stab" data-v="multi">Multiplayer</button><button type="button" class="seg${setup.tab === 'solo' ? ' on' : ''}" data-act="stab" data-v="solo">Solo challenges</button></div>
    ${setup.tab === 'multi' ? multi : solo}
    <div class="mbtns">${S ? '<button type="button" class="btn ghost" data-act="close">Back to game</button>' : ''}<button type="button" class="btn ghost" data-act="aid">Player aid</button><button type="button" class="btn primary" data-act="start">Start game</button></div></div>`;
}

/* ---------------- render ---------------- */

function render() {
  const app = $('#app');
  if (!S) { app.innerHTML = ''; }
  else {
    app.innerHTML = `${renderHeader()}${renderPrompt()}${renderStudio()}
      <main class="table">
        <div class="col-a">${renderActions()}</div>
        <div class="col-b">${renderTrends()}${renderScripts()}${renderMarket()}</div>
      </main>${renderLog()}`;
  }
  let m = '';
  if (S && S.ui && S.ui.mode === 'release' && !modal) m = renderRelease();
  else if (modal === 'end') m = renderEnd();
  else if (modal === 'aid') m = renderAid();
  else if (modal === 'setup' || !S) m = renderSetup();
  $('#modal').innerHTML = m ? `<div class="scrim">${m}</div>` : '';
}

/* ---------------- input ---------------- */

function humanFree() {
  const u = S && S.ui;
  if (!u || (u.mode !== 'turn' && u.mode !== 'release')) return null;
  return S.players[u.pid];
}

function handle(act, v) {
  const u = S && S.ui;
  switch (act) {
    case 'setup': openModal('setup'); return;
    case 'aid': openModal('aid'); return;
    case 'close': closeModal(); render(); return;
    case 'stab': setup.tab = v; render(); return;
    case 'snum': setup.n = +v; render(); return;
    case 'sai': { const [i, ai] = v.split(':'); setup.players[+i].ai = ai === '1'; render(); return; }
    case 'ssolo': setup.solo = +v; render(); return;
    case 'start': {
      const delay = S ? S.delay : 550;
      if (setup.tab === 'solo') newGame({ solo: setup.solo, players: [{ name: setup.players[0].name || 'My Studio', ai: false }], delay });
      else {
        const players = setup.players.slice(0, setup.n).map((x, i) => ({ name: x.name.trim() || PLAYER_NAMES[i], ai: x.ai }));
        if (players.every((x) => x.ai)) players[0].ai = false;
        newGame({ players, delay });
      }
      return;
    }
  }
  if (!S || !u) return;
  switch (act) {
    case 'view': S.view = +v; break;
    case 'staff':
      if (u.mode !== 'turn') break;
      u.sel = u.sel === +v ? null : +v;
      render();
      if (u.sel != null) {
        const target = document.querySelector('.space.can') || document.querySelector('.actions');
        const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (target) target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
      }
      return;
    case 'space': if (u.mode === 'turn' && u.sel != null && legalSpace(S.players[u.pid], u.sel, v)) answer({ act: v, staff: u.sel }); return;
    case 'pass': if (u.mode === 'turn') answer({ pass: true }); return;
    case 'pile': if (u.mode === 'reveal') answer(v); return;
    case 'pool': if (u.mode === 'pick') { const [t, i] = v.split(':'); answer({ t, i: +i }); } return;
    case 'done': if (u.mode === 'pick') answer(null); return;
    case 'discard': if (u.mode === 'discard') answer(+v); return;
    case 'choose': if (u.mode === 'choose') answer(u.options[+v].v); return;
    case 'place': { const p = humanFree(); if (p) placePart(p, +v); break; }
    case 'h2m': { const p = humanFree(); if (p && p.hype >= 1) { p.hype--; p.money++; } break; }
    case 'h2merch': { const p = humanFree(); if (p && p.hype >= 4) { p.hype -= 4; gainMerch(p); log(`${p.name} trades 4 Hype for Merchandise.`, p); } break; }
    case 'cycle': {
      const p = humanFree();
      if (p && S.market[v] && S.decks[v].length) { pay(p, 1); S.decks[v].push(S.market[v]); S.market[v] = S.decks[v].shift(); }
      break;
    }
    case 'rtrend': if (u.mode === 'release') { u.rsel = v === 'cult' ? 'cult' : +v; u.rhype = 0; } break;
    case 'rhype': if (u.mode === 'release') u.rhype = Math.max(0, u.rhype + +v); break;
    case 'rswap': if (u.mode === 'release' && !u.swapped) {
      const [t, i] = v.split(':');
      const p = S.players[u.pid];
      const fromPool = S.pool[t].splice(+i, 1)[0];
      if (p.prod[t]) S.pool[t].push(p.prod[t]);
      p.prod[t] = fromPool;
      u.swapped = true; u.rsel = null;
      log(`Words magician swaps in "${fromPool.name}".`, p);
    } break;
    case 'rgo': if (u.mode === 'release') answer({ sel: u.rsel, hype: u.rhype }); return;
    case 'rskip': if (u.mode === 'release') answer(null); return;
  }
  render();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  handle(el.dataset.act, el.dataset.v);
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); handle(e.target.dataset.act, e.target.dataset.v); }
});
document.addEventListener('input', (e) => {
  if (e.target.classList.contains('pname-in')) setup.players[+e.target.dataset.i].name = e.target.value;
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'speed' && S) S.delay = +e.target.value;
});

// Large card preview on hover (desktop).
const preview = document.createElement('img');
preview.id = 'preview';
preview.alt = '';
document.body.appendChild(preview);
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-img]');
  if (el && matchMedia('(hover: hover)').matches) { preview.src = el.dataset.img; preview.classList.add('on'); }
  else preview.classList.remove('on');
});

render();
