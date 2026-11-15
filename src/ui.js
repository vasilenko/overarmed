// Screens on top of the game: title, shop, pause, ending. Plain HTML.

import { WEAPONS, ITEMS, ARM_SLOTS, STAT_INFO, LAST_WAVE } from './data.js';
import { canBuy, rerollCost } from './game.js';

const root = document.getElementById('ui');
let handler = null;

root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b && !b.disabled && handler) handler(b.dataset.act, b.dataset.arg);
});

function show(html, onAct) {
  handler = onAct;
  root.innerHTML = html;
  root.classList.add('on');
}

export function hide() {
  handler = null;
  root.innerHTML = '';
  root.classList.remove('on');
}

// the nut currency icon shown next to prices and the score
const NUT = '<img class="nut" src="assets/items/nut.png" alt="nuts">';

const gicon = (id) => `<img class="gicon" src="assets/gear/${id}.png" alt="">`;

// A weapon icon is the same image the game uses. The browser scales it down to the size needed,
// so it stays sharp on any screen.
const wicon = (id) => `<img class="wicon" src="assets/weapons/${id}.png" alt="">`;

function weaponFacts(id, lvl = 1) {
  const w = WEAPONS[id];
  const dmg = Math.round(w.dmg * (1 + 0.5 * (lvl - 1)));
  return `<ul class="facts">
    <li>${w.kind === 'melee' ? 'Melee' : 'Ranged'}</li>
    <li>Damage ${dmg}${w.count > 1 ? ' × ' + w.count : ''}</li>
    <li>${w.move === 'throw' ? 'Returns to the hand' : `${(1 / w.cd).toFixed(1)} attacks per second`}</li>
  </ul>`;
}

function fmtMod(key, v) {
  const info = STAT_INFO[key];
  const num = info.pct ? Math.round(v * 100) + '%' : String(v);
  return `<li class="${v > 0 ? 'good' : 'bad'}">${v > 0 ? '+' : '−'}${num.replace('-', '')} ${info.label}</li>`;
}

const modsList = (mods) => Object.entries(mods).map(([k, v]) => fmtMod(k, v)).join('');

export function title(onStart) {
  const cards = Object.entries(WEAPONS)
    .filter(([, w]) => w.starter)
    .map(([id, w]) => `
      <button class="card weapon" data-act="start" data-arg="${id}">
        ${wicon(id)}
        <strong>${w.name}</strong>
        <p class="blurb">${w.blurb}</p>
        ${weaponFacts(id)}
        <span class="cta">Grab it and clock in</span>
      </button>`)
    .join('');
  show(`
    <div class="panel title">
      <h1 class="logo"><img src="assets/ui/logo.png" alt="Overarmed"></h1>
      <p class="tag">Six arms. One job. The robots can't have it.</p>
      <h3>What does Buddy bring to his first shift?</h3>
      <div class="cards three">${cards}</div>
      <p class="hint">WASD or arrow keys to run. Weapons fire and swing on their own. P — pause, M — sound.</p>
    </div>`, (act, arg) => act === 'start' && onStart(arg));
}

function offerCard(g, o, i) {
  if (o.sold) return `<div class="card sold">Sold</div>`;
  const st = canBuy(g, o);
  const isW = o.kind === 'weapon';
  const d = isW ? WEAPONS[o.id] : ITEMS[o.id];
  return `
    <button class="card ${o.kind}" data-act="buy" data-arg="${i}" ${st.ok ? '' : 'disabled'}>
      <span class="kind">${isW ? 'Weapon' : 'Gear'}<kbd>${i + 1}</kbd></span>
      ${isW ? wicon(o.id) : gicon(o.id)}
      <strong>${d.name}</strong>
      ${isW ? `<p class="blurb">${d.blurb}</p>${weaponFacts(o.id)}` : `<ul class="facts">${modsList(d.mods)}</ul>`}
      <span class="price">${NUT} ${o.price}</span>
      <span class="cta">${st.label}</span>
    </button>`;
}

function loadout(g) {
  const arms = g.arms.map((a, i) => `
    <div class="arm ${ARM_SLOTS[i].bionic ? 'bionic' : 'own'} ${a.id ? 'full' : ''}"
         title="${a.id ? WEAPONS[a.id].name : 'Free hand'}">
      ${a.id ? wicon(a.id) : ''}
      ${a.id && a.lvl > 1 ? `<b>lvl ${a.lvl}</b>` : ''}
      <small>${ARM_SLOTS[i].bionic ? 'bionic' : 'own'}</small>
    </div>`).join('');

  const gear = Object.entries(g.items)
    .map(([id, n]) => `<span class="gear" title="${ITEMS[id].name}">${gicon(id)}${n > 1 ? `<b>×${n}</b>` : ''}</span>`)
    .join('') || '<span class="muted">Nothing yet</span>';

  const stats = Object.entries(STAT_INFO).map(([k, info]) => {
    const v = g.stats[k];
    const txt = info.pct ? Math.round(v * 100) + '%' : String(Math.round(v * 10) / 10);
    return `<li><span>${info.label}</span><b>${txt}</b></li>`;
  }).join('');

  return `
    <div class="loadout">
      <section><h3>Arms</h3><div class="arms">${arms}</div></section>
      <section><h3>Gear</h3><div class="gears">${gear}</div></section>
      <section><h3>Stats</h3><ul class="stats">${stats}</ul></section>
    </div>`;
}

export function shop(g, on) {
  const cost = rerollCost(g);
  show(`
    <div class="panel shop">
      <header>
        <div>
          <h2>Break</h2>
          <p class="muted">Shift ${g.wave} is done. Next up: shift ${g.wave + 1} of ${LAST_WAVE}.</p>
        </div>
        <div class="bolts">${NUT} ${Math.floor(g.bolts)}</div>
      </header>
      <div class="cards">${g.shop.offers.map((o, i) => offerCard(g, o, i)).join('')}</div>
      <div class="row">
        <button class="btn" data-act="reroll" ${g.bolts < cost ? 'disabled' : ''}>Reroll · ${NUT} ${cost} <kbd>R</kbd></button>
        <button class="btn go" data-act="next">Start shift ${g.wave + 1} <kbd>Enter</kbd></button>
      </div>
      ${loadout(g)}
    </div>`, (act, arg) => {
    if (act === 'buy') on.buy(Number(arg));
    if (act === 'reroll') on.reroll();
    if (act === 'next') on.next();
  });
}

export function pause() {
  show(`
    <div class="panel small">
      <h2>Paused</h2>
      <p class="muted">The robots can wait. Press P or Esc to continue.</p>
    </div>`, null);
}

export function end(g, won, onAgain) {
  show(`
    <div class="panel small">
      <h1 class="${won ? 'win' : 'lose'}">${won ? 'Job saved' : 'Fired'}</h1>
      <p class="tag">${won
        ? 'Director-3000 has been sent to the smelter. Buddy keeps his job.'
        : `The robots took your job on shift ${g.wave} of ${LAST_WAVE}.`}</p>
      <p class="muted">Robots dismantled: ${g.kills}</p>
      ${loadout(g)}
      <div class="row center"><button class="btn go" data-act="again">Again <kbd>Enter</kbd></button></div>
    </div>`, (act) => act === 'again' && onAgain());
}
