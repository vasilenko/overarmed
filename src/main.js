// Entry point: game loop, keyboard and touch input, switching between screens.

import { W, H } from './data.js';
import { newGame, update, buy, reroll, nextWave } from './game.js';
import { draw } from './render.js';
import * as ui from './ui.js';
import { play, toggleMute } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 1;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const k = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = W * k + 'px';
  canvas.style.height = H * k + 'px';
  canvas.width = Math.round(W * k * dpr);
  canvas.height = Math.round(H * k * dpr);
  scale = k * dpr;
}
window.addEventListener('resize', resize);
resize();

// ---------- controls ----------

const keys = new Set();
const touch = { id: null, ox: 0, oy: 0, x: 0, y: 0 };

function axis() {
  const k = (...codes) => (codes.some((c) => keys.has(c)) ? 1 : 0);
  return {
    x: k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft') + touch.x,
    y: k('KeyS', 'ArrowDown') - k('KeyW', 'ArrowUp') + touch.y,
  };
}

// on a phone a finger anywhere on the screen works as a joystick
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  touch.id = e.pointerId;
  touch.ox = e.clientX;
  touch.oy = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId !== touch.id) return;
  const dx = (e.clientX - touch.ox) / 50;
  const dy = (e.clientY - touch.oy) / 50;
  const len = Math.max(1, Math.hypot(dx, dy));
  touch.x = dx / len;
  touch.y = dy / len;
});
const liftTouch = (e) => {
  if (e.pointerId !== touch.id) return;
  touch.id = null;
  touch.x = 0;
  touch.y = 0;
};
window.addEventListener('pointerup', liftTouch);
window.addEventListener('pointercancel', liftTouch);

// ---------- screens ----------

let g = null;
let paused = false;
let shown = '';

function toTitle() {
  g = newGame(null);
  g.phase = 'title';
  shown = 'title';
  paused = false;
  ui.title((starter) => {
    g = newGame(starter);
    shown = 'wave';
    ui.hide();
    play('buy');
  });
}

const shopActions = {
  buy(i) {
    play(buy(g, i) ? 'buy' : 'deny');
    ui.shop(g, shopActions);
  },
  reroll() {
    play(reroll(g) ? 'pick' : 'deny');
    ui.shop(g, shopActions);
  },
  next() {
    nextWave(g);
    shown = 'wave';
    ui.hide();
    play('wave');
  },
};

function togglePause() {
  if (g.phase !== 'wave') return;
  paused = !paused;
  if (paused) ui.pause();
  else ui.hide();
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (g.phase === 'shop') {
    if (/^Digit[1-4]$/.test(e.code)) shopActions.buy(Number(e.code.slice(5)) - 1);
    if (e.code === 'KeyR') shopActions.reroll();
    if (e.code === 'Enter') shopActions.next();
  } else if ((g.phase === 'dead' || g.phase === 'won') && e.code === 'Enter') {
    toTitle();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  if (g.phase === 'wave' && !paused) togglePause();
});

// ---------- loop ----------

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (!paused) update(g, dt, axis());

  for (const s of g.sfx) play(s);
  g.sfx.length = 0;

  if (g.phase !== shown) {
    shown = g.phase;
    if (shown === 'shop') ui.shop(g, shopActions);
    if (shown === 'dead' || shown === 'won') ui.end(g, shown === 'won', toTitle);
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  draw(ctx, g);
  requestAnimationFrame(frame);
}

// For debugging from the browser console: overarmed.game is the current game state.
window.overarmed = {
  get game() {
    return g;
  },
};

toTitle();
requestAnimationFrame(frame);
