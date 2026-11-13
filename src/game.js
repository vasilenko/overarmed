// Game logic. No DOM and no canvas here: only the state and how it updates.
// The game does not play sounds itself, it pushes their names into g.sfx.

import {
  W, H, LAST_WAVE, ARM_SLOTS, BASE_STATS, WEAPONS, ENEMIES, ITEMS, OBSTACLES, LAYOUT, BELT,
  PLAYER_SPEED, PICKUP_RADIUS, DROP_REST, LUNGE, FLASH_TIME, BLAST_TIME, waveCfg,
} from './data.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pickKey = (obj) => {
  const k = Object.keys(obj);
  return k[(Math.random() * k.length) | 0];
};

export function newGame(starter) {
  const g = {
    phase: 'wave', // wave | shop | dead | won (main.js adds title)
    wave: 1,
    waveT: 0,
    spawnT: 0,
    time: 0,
    cfg: null,
    player: { x: W / 2, y: H / 2, r: 15, hp: 0, inv: 0, face: 1, moving: false },
    stats: { ...BASE_STATS },
    arms: ARM_SLOTS.map((s) => ({
      id: null, lvl: 1, cd: 0, aim: s.ang, target: null,
      swing: -1, dir: 0, flip: 1, hit: null,
      x: 0, y: 0, bx: 0, by: 0,
    })),
    items: {},
    bolts: 10, // an advance, so the very first break has something worth looking at
    kills: 0,
    enemies: [],
    shots: [],
    foeShots: [],
    drops: [],
    obstacles: [],
    belts: [],
    fx: [],
    texts: [],
    flashes: [], // muzzle flashes, they live for a fraction of a second
    blasts: [], // barrel explosions still on screen
    boss: null,
    shake: 0,
    hudPop: 0, // the nut counter pulses on pickup, from 1 down to 0
    sfx: [],
    shop: null,
    rerolls: 0,
  };
  g.arms[0].id = starter;
  recalc(g);
  startWave(g);
  poseArms(g); // fists are in place right away, before the first frame
  return g;
}

export function recalc(g) {
  const s = { ...BASE_STATS };
  for (const [id, n] of Object.entries(g.items)) {
    for (const [k, v] of Object.entries(ITEMS[id].mods)) s[k] += v * n;
  }
  s.maxHp = Math.max(20, Math.round(s.maxHp));
  s.dmg = Math.max(0.2, s.dmg);
  s.rate = Math.max(0.3, s.rate);
  s.speed = Math.max(0.4, s.speed);
  g.stats = s;
  g.player.hp = Math.min(g.player.hp, s.maxHp);
}

export function weaponDmg(g, arm) {
  return WEAPONS[arm.id].dmg * (1 + 0.5 * (arm.lvl - 1)) * g.stats.dmg;
}

function startWave(g) {
  g.cfg = waveCfg(g.wave);
  g.waveT = g.cfg.dur;
  g.spawnT = 0.8;
  g.player.hp = g.stats.maxHp; // a break heals fully
  g.player.inv = 0;
  g.enemies = [];
  g.shots = [];
  g.foeShots = [];
  g.drops = [];
  g.belts = layoutBelts(g);
  g.obstacles = layoutObstacles(g);
  g.boss = g.cfg.boss ? spawnEnemy(g, 'boss', W / 2, -60) : null;
}

// Rolls the conveyor belts for the shift. A belt is a rectangle x, y, w, h that carries along the
// unit vector dx, dy; it runs either along or across the arena, in either direction.
function layoutBelts(g) {
  const belts = [];
  for (let i = 0; i < BELT.count; i++) {
    for (let tries = 0; tries < 60; tries++) {
      const flat = Math.random() < 0.5;
      const w = flat ? BELT.len : BELT.wide;
      const h = flat ? BELT.wide : BELT.len;
      const x = rand(LAYOUT.edge, W - LAYOUT.edge - w);
      const y = rand(LAYOUT.edge + 30, H - LAYOUT.edge - h);
      // not under Buddy's feet at the start, and not on top of another belt
      if (boxDist(g.player.x, g.player.y, { x, y, w, h }) < LAYOUT.clear * 0.6) continue;
      if (belts.some((b) => x < b.x + b.w + 40 && b.x < x + w + 40 && y < b.y + b.h + 40 && b.y < y + h + 40)) continue;
      const dir = Math.random() < 0.5 ? -1 : 1;
      belts.push({ x, y, w, h, dx: flat ? dir : 0, dy: flat ? 0 : dir });
      break;
    }
  }
  return belts;
}

// Distance from a point to a rectangle; zero when the point is inside it.
function boxDist(px, py, b) {
  return Math.hypot(Math.max(b.x - px, 0, px - b.x - b.w), Math.max(b.y - py, 0, py - b.y - b.h));
}

// Moves a body along with the belt it stands on, at the belt speed unless a lower one is given.
function carry(g, body, dt, speed = BELT.speed) {
  for (const b of g.belts) {
    if (body.x < b.x || body.x > b.x + b.w || body.y < b.y || body.y > b.y + b.h) continue;
    body.x += b.dx * speed * dt;
    body.y += b.dy * speed * dt;
    return;
  }
}

// Rolls a fresh obstacle layout for the shift: random spots that keep clear of the edges,
// of Buddy, of the belts and of each other. A spot that cannot be found after many tries is simply skipped.
function layoutObstacles(g) {
  const placed = [];
  for (const [kind, n] of Object.entries(LAYOUT.count)) {
    const r = OBSTACLES[kind].r;
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 60; tries++) {
        const x = rand(LAYOUT.edge, W - LAYOUT.edge);
        const y = rand(LAYOUT.edge + 30, H - LAYOUT.edge); // extra room at the top keeps tall bodies off the interface
        if (Math.hypot(x - g.player.x, y - g.player.y) < LAYOUT.clear + r) continue;
        if (placed.some((o) => Math.hypot(x - o.x, y - o.y) < r + o.r + LAYOUT.gap)) continue;
        if (g.belts.some((b) => boxDist(x, y, b) < r + 12)) continue; // nothing stands on a belt
        // hp is infinite for things that cannot be destroyed; fuse counts down once a barrel is lit
        placed.push({ kind, x, y, r, hp: OBSTACLES[kind].hp ?? Infinity, fuse: -1, flash: 0, dead: false });
        break;
      }
    }
  }
  return placed;
}

// Pushes a round body out of every obstacle it overlaps.
function pushOut(g, body, r) {
  for (const o of g.obstacles) {
    const dx = body.x - o.x;
    const dy = body.y - o.y;
    const min = o.r + r;
    if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue;
    const d = Math.hypot(dx, dy) || 0.01;
    if (d >= min) continue;
    body.x = o.x + (dx / d) * min;
    body.y = o.y + (dy / d) * min;
  }
}

// Whether a point is inside an obstacle: this is where bullets stop.
function blocked(g, x, y) {
  return g.obstacles.some((o) => (x - o.x) ** 2 + (y - o.y) ** 2 < o.r * o.r);
}

// Whether solid cover stands between two points: guns do not waste shots on robots behind it.
// Barrels do not count: shooting a robot through a barrel is exactly how you set the barrel off.
function hidden(g, ax, ay, bx, by) {
  return g.obstacles.some((o) => o.hp === Infinity && segDist(o.x, o.y, ax, ay, bx, by) < o.r);
}

// Damage to an obstacle. Only barrels have hit points; at zero they blow up.
function hitObstacle(g, o, dmg) {
  if (o.hp === Infinity || o.dead) return;
  o.hp -= dmg;
  o.flash = 0.1;
  g.sfx.push('hit');
  if (o.hp <= 0) explode(g, o);
}

// A barrel blows up: robots in the blast take heavy damage and fly back, Buddy gets hurt if he
// stands too close, and other barrels in range catch fire and follow a moment later.
function explode(g, o) {
  const def = OBSTACLES[o.kind];
  o.dead = true;
  g.blasts.push({ x: o.x, y: o.y, r: def.blast, t: 0 });
  g.shake = Math.max(g.shake, 0.4);
  g.sfx.push('blast');
  burst(g, o.x, o.y, '#ff7a1a', 10);
  burst(g, o.x, o.y, '#ffd34d', 8);
  for (const e of g.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - o.x, e.y - o.y);
    if (d < def.blast + e.r) hurtEnemy(g, e, def.dmg * g.cfg.hpMul, Math.atan2(e.y - o.y, e.x - o.x), 420);
  }
  const p = g.player;
  if (Math.hypot(p.x - o.x, p.y - o.y) < def.blast + p.r) hurtPlayer(g, def.selfDmg);
  for (const other of g.obstacles) {
    if (other === o || other.dead || other.hp === Infinity || other.fuse >= 0) continue;
    if (Math.hypot(other.x - o.x, other.y - o.y) < def.blast + other.r) other.fuse = OBSTACLES[other.kind].fuse;
  }
}

// Burns down lit fuses and removes what has blown up.
function stepObstacles(g, dt) {
  for (const o of g.obstacles) {
    o.flash -= dt;
    if (o.fuse >= 0 && !o.dead) {
      o.fuse -= dt;
      if (o.fuse <= 0) explode(g, o);
    }
  }
  g.obstacles = g.obstacles.filter((o) => !o.dead);
}

// If an obstacle is right ahead, turns the heading along its edge so the robot slides around it.
function steerAround(g, e, vx, vy) {
  for (const o of g.obstacles) {
    const ox = o.x - e.x;
    const oy = o.y - e.y;
    const d = Math.hypot(ox, oy) || 0.01;
    if (d > o.r + e.r + 10) continue;
    if (vx * ox + vy * oy <= 0) continue; // already heading away from it
    // go round on the side the robot already leans to; a dead-centre hit is settled by its own habit
    const cross = ox * vy - oy * vx;
    const side = Math.abs(cross) > 0.05 * d ? Math.sign(cross) : e.strafe;
    const len = Math.hypot(vx, vy);
    return [(-oy / d) * side * len, (ox / d) * side * len];
  }
  return [vx, vy];
}

export function nextWave(g) {
  g.wave++;
  g.phase = 'wave';
  g.shop = null;
  startWave(g);
}

// ---------- update ----------

export function update(g, dt, input) {
  g.time += dt;
  g.shake = Math.max(0, g.shake - dt);
  g.hudPop = Math.max(0, g.hudPop - dt * 4);
  stepFx(g, dt);
  poseArms(g);
  if (g.phase !== 'wave') return;

  const p = g.player;
  const s = g.stats;

  let mx = input.x;
  let my = input.y;
  const ml = Math.hypot(mx, my);
  p.moving = ml > 0.1;
  if (p.moving) {
    if (ml > 1) { mx /= ml; my /= ml; }
    p.x += mx * PLAYER_SPEED * s.speed * dt;
    p.y += my * PLAYER_SPEED * s.speed * dt;
    if (Math.abs(mx) > 0.1) p.face = Math.sign(mx);
  }
  carry(g, p, dt);
  p.x = clamp(p.x, 32, W - 32);
  p.y = clamp(p.y, 44, H - 34);
  pushOut(g, p, p.r);
  p.inv -= dt;
  if (s.regen > 0) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);

  poseArms(g);
  stepArms(g, dt);
  stepShots(g, dt);
  stepObstacles(g, dt);
  stepEnemies(g, dt);
  stepFoeShots(g, dt);
  stepDrops(g, dt);
  if (g.phase !== 'wave') return; // Buddy may have died on this frame

  // reinforcements
  g.spawnT -= dt;
  if (g.spawnT <= 0 && g.enemies.length < 140) {
    g.spawnT = g.cfg.interval * rand(0.8, 1.2);
    spawnGroup(g);
  }

  // end of the shift
  if (g.cfg.boss) {
    if (g.boss.dead) finishWave(g);
  } else {
    g.waveT -= dt;
    if (g.waveT <= 0) finishWave(g);
  }
}

// Puts the fists at their fixed spots around the torso.
function poseArms(g) {
  const p = g.player;
  g.arms.forEach((a, i) => {
    const s = ARM_SLOTS[i];
    a.bx = p.x + s.hx;
    a.by = p.y + s.hy + Math.sin(g.time * 4 + i * 1.7) * 1.5;
    a.x = a.bx;
    a.y = a.by;
  });
}

// Distance from a point to a segment: this is how we check whether a weapon touched a robot.
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const k = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - dx * k, py - ay - dy * k);
}

// Picks a target for a hand. The nearest robot wins, with a few adjustments:
// — a robot already within reach of a melee weapon (strike) gets hit without a second thought;
// — a robot on the other side of Buddy counts as 60 pixels farther: left hands prefer robots
//   on the left, so weapons lie across the torso less often;
// — a robot already taken by other hands counts as 90 pixels farther for each of them,
//   so the hands spread out over different robots;
// — a hand's previous target is slightly more attractive, so it does not flicker between two robots.
function pickTarget(g, a, side, range, strike, taken) {
  let best = null;
  let bestScore = Infinity;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - a.bx, e.y - a.by) - e.r;
    if (d >= range) continue;
    const across = Math.sign(e.x - g.player.x) === -side ? 60 : 0;
    if (strike < 0 && hidden(g, a.bx, a.by, e.x, e.y)) continue; // a gun cannot hit a robot behind cover
    const score = d <= strike ? d - 1000 : d + across + 90 * (taken.get(e) || 0) - (e === a.target ? 25 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  if (best) taken.set(best, (taken.get(best) || 0) + 1);
  return best;
}

function stepArms(g, dt) {
  const s = g.stats;
  const taken = new Map(); // how many hands already aim at each robot
  for (const [i, a] of g.arms.entries()) {
    if (!a.id) continue;
    const slot = ARM_SLOTS[i];
    const def = WEAPONS[a.id];
    const melee = def.kind === 'melee';
    a.cd -= dt * s.rate;

    // a swing is in progress: the weapon sweeps an arc around the fist and hits everyone it touches
    if (a.swing >= 0) {
      a.swing = Math.min(1, a.swing + dt / def.time);
      // the fist briefly lunges toward the target and comes back
      const lunge = Math.sin(a.swing * Math.PI) * LUNGE;
      a.x = a.bx + Math.cos(a.dir) * lunge;
      a.y = a.by + Math.sin(a.dir) * lunge;
      a.aim = a.dir + (a.swing - 0.5) * def.arc * a.flip;
      const tipX = a.x + Math.cos(a.aim) * def.len;
      const tipY = a.y + Math.sin(a.aim) * def.len;
      const dmg = weaponDmg(g, a);
      for (const e of g.enemies) {
        if (e.dead || a.hit.has(e)) continue;
        if (segDist(e.x, e.y, a.x, a.y, tipX, tipY) < e.r + 6) {
          a.hit.add(e);
          hurtEnemy(g, e, dmg, a.aim, def.knock);
        }
      }
      // a swing sets off barrels too
      for (const o of g.obstacles) {
        if (o.hp === Infinity || o.dead || a.hit.has(o)) continue;
        if (segDist(o.x, o.y, a.x, a.y, tipX, tipY) < o.r + 6) {
          a.hit.add(o);
          hitObstacle(g, o, dmg);
        }
      }
      if (a.swing >= 1) {
        a.swing = -1;
        a.aim = a.dir;
      }
      if (a.target) taken.set(a.target, (taken.get(a.target) || 0) + 1);
      continue;
    }

    // a melee weapon turns toward whoever approaches ahead of time, but only strikes up close
    const range = melee ? def.range : def.range * s.range;
    const t = pickTarget(g, a, Math.sign(slot.hx), melee ? range * 3 : range, melee ? range : -Infinity, taken);
    a.target = t;
    if (!t) {
      a.aim = slot.ang; // no targets: the weapon points away from the torso
      continue;
    }
    a.aim = Math.atan2(t.y - a.by, t.x - a.bx);
    if (a.cd > 0) continue;

    if (melee) {
      if (Math.hypot(t.x - a.bx, t.y - a.by) - t.r > range) continue;
      a.cd = def.cd;
      a.swing = 0;
      a.dir = a.aim;
      a.flip = -a.flip; // every next swing goes the opposite way
      a.hit = new Set();
      g.sfx.push('swing');
    } else {
      a.cd = def.cd;
      const dmg = weaponDmg(g, a);
      // the bullet leaves from the muzzle; a weapon pointing left is flipped, so the offset changes sign
      const [fwd, down] = def.muzzle;
      const side = Math.cos(a.aim) < 0 ? -down : down;
      const mx = a.bx + Math.cos(a.aim) * fwd - Math.sin(a.aim) * side;
      const my = a.by + Math.sin(a.aim) * fwd + Math.cos(a.aim) * side;
      for (let k = 0; k < def.count; k++) {
        const off = def.count > 1
          ? (k / (def.count - 1) - 0.5) * def.spread
          : rand(-def.spread, def.spread) / 2;
        const ang = a.aim + off;
        g.shots.push({
          kind: a.id,
          x: mx,
          y: my,
          vx: Math.cos(ang) * def.speed,
          vy: Math.sin(ang) * def.speed,
          r: 5,
          dmg,
          pierce: def.pierce,
          knock: def.knock,
          life: (range + 40) / def.speed,
          hit: new Set(),
        });
      }
      g.flashes.push({ x: mx, y: my, ang: a.aim, t: 0 });
      g.sfx.push('shoot');
    }
  }
}

function stepShots(g, dt) {
  for (const s of g.shots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    const wall = g.obstacles.find((o) => !o.dead && (s.x - o.x) ** 2 + (s.y - o.y) ** 2 < o.r * o.r);
    if (wall) {
      s.life = 0;
      burst(g, s.x, s.y, '#ffe7a3', 2);
      hitObstacle(g, wall, s.dmg);
      continue;
    }
    for (const e of g.enemies) {
      if (e.dead || s.hit.has(e)) continue;
      if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (e.r + s.r) ** 2) {
        s.hit.add(e);
        hurtEnemy(g, e, s.dmg, Math.atan2(s.vy, s.vx), s.knock);
        if (s.pierce-- <= 0) { s.life = 0; break; }
      }
    }
  }
  g.shots = g.shots.filter((s) => s.life > 0);
}

function hurtEnemy(g, e, dmg, ang, knock) {
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  e.flash = 0.1;
  const k = knock / ENEMIES[e.type].mass;
  e.kx += Math.cos(ang) * k;
  e.ky += Math.sin(ang) * k;
  floatText(g, e.x + rand(-6, 6), e.y - e.r, String(dmg), '#ffffff');
  g.sfx.push('hit');
  if (e.hp <= 0) kill(g, e);
}

function kill(g, e) {
  e.dead = true;
  g.kills++;
  burst(g, e.x, e.y, '#ffd34d', 4);
  burst(g, e.x, e.y, '#9fb2c4', 5);
  g.sfx.push('boom');
  const bolts = ENEMIES[e.type].bolts;
  if (e.type === 'boss') {
    g.shake = 0.6;
    for (let i = 0; i < 10; i++) dropAt(g, 'bolt', bolts / 10, e.x, e.y, 220);
  } else {
    dropAt(g, 'bolt', bolts, e.x, e.y, 130);
    if (Math.random() < 0.035) dropAt(g, 'food', 15, e.x, e.y, 130);
  }
}

function dropAt(g, kind, val, x, y, spread) {
  g.drops.push({ kind, val, x, y, vx: rand(-spread, spread), vy: rand(-spread, spread), t: 0, got: false });
}

function stepEnemies(g, dt) {
  g.enemies = g.enemies.filter((e) => !e.dead);
  const p = g.player;
  const decay = Math.pow(0.002, dt);

  for (const e of g.enemies) {
    const def = ENEMIES[e.type];
    const ai = def.ai;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    let vx = dx / d;
    let vy = dy / d;

    if (ai === 'shooter') {
      // keeps its distance and circles
      const dir = d > 330 ? 1 : d < 230 ? -1 : 0;
      if (dir) { vx *= dir; vy *= dir; } else { vx = (-dy / d) * e.strafe * 0.5; vy = (dx / d) * e.strafe * 0.5; }
      e.cd -= dt;
      if (e.cd <= 0 && e.in && d < 440) {
        e.cd = 2.4;
        foeShot(g, e, Math.atan2(dy, dx), 210);
      }
    } else if (ai === 'boss') {
      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = e.hp < e.maxHp / 2 ? 2.2 : 3.2;
        const n = 12;
        const off = Math.random() * Math.PI;
        for (let i = 0; i < n; i++) foeShot(g, e, off + (i / n) * Math.PI * 2, 190, 0.5);
        g.sfx.push('ring');
      }
    }

    // walking robots go around obstacles, flying ones pass over them
    if (!def.flies) [vx, vy] = steerAround(g, e, vx, vy);
    e.x += (vx * e.speed + e.kx) * dt;
    e.y += (vy * e.speed + e.ky) * dt;
    if (!def.flies) {
      carry(g, e, dt, Math.min(BELT.speed, e.speed * BELT.grip));
      pushOut(g, e, e.r);
    }
    e.kx *= decay;
    e.ky *= decay;
    e.flash -= dt;

    // robots come in from beyond the arena edge; once inside, they never leave again
    if (!e.in && e.x > e.r && e.x < W - e.r && e.y > e.r && e.y < H - e.r) e.in = true;
    if (e.in) {
      e.x = clamp(e.x, e.r, W - e.r);
      e.y = clamp(e.y, e.r, H - e.r);
    }

    if (d < e.r + p.r - 3) hurtPlayer(g, e.dmg);
  }

  // robots push each other apart so they do not clump into a single point
  const list = g.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d >= min) continue;
      const ma = ENEMIES[a.type].mass;
      const mb = ENEMIES[b.type].mass;
      const push = (min - d) / d;
      const ka = mb / (ma + mb);
      a.x -= dx * push * ka;
      a.y -= dy * push * ka;
      b.x += dx * push * (1 - ka);
      b.y += dy * push * (1 - ka);
    }
  }
}

function foeShot(g, e, ang, speed, dmgMul = 1) {
  g.foeShots.push({
    kind: e.type,
    x: e.x, y: e.y,
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    r: 7, dmg: e.dmg * dmgMul, life: 5, spin: rand(0, 6),
  });
}

function stepFoeShots(g, dt) {
  const p = g.player;
  for (const s of g.foeShots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (blocked(g, s.x, s.y)) s.life = 0; // cover works both ways
    if (p.inv <= 0 && (s.x - p.x) ** 2 + (s.y - p.y) ** 2 < (s.r + p.r) ** 2) {
      s.life = 0;
      hurtPlayer(g, s.dmg);
    }
  }
  g.foeShots = g.foeShots.filter((s) => s.life > 0 && s.x > -40 && s.x < W + 40 && s.y > -40 && s.y < H + 40);
}

function hurtPlayer(g, dmg) {
  const p = g.player;
  if (p.inv > 0 || g.phase !== 'wave') return;
  const taken = Math.max(1, Math.round(dmg / (1 + 0.08 * g.stats.armor)));
  p.hp -= taken;
  p.inv = 0.6;
  g.shake = 0.25;
  floatText(g, p.x, p.y - 34, '-' + taken, '#ff6b6b');
  burst(g, p.x, p.y, '#ff6b6b', 6);
  g.sfx.push('hurt');
  if (p.hp <= 0) {
    p.hp = 0;
    g.phase = 'dead';
    g.sfx.push('dead');
  }
}

function stepDrops(g, dt) {
  const p = g.player;
  const reach = PICKUP_RADIUS * g.stats.pickup;
  const decay = Math.pow(0.01, dt);
  for (const d of g.drops) {
    d.t += dt;
    carry(g, d, dt);
    d.x = clamp(d.x + d.vx * dt, 26, W - 26);
    d.y = clamp(d.y + d.vy * dt, 42, H - 36); // not under the railing: an item would be hard to see there
    pushOut(g, d, 6); // and not inside an obstacle
    d.vx *= decay;
    d.vy *= decay;
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    const dist = Math.hypot(dx, dy) || 1;
    // a freshly dropped item first flies out and rests in plain sight, and only then can be picked up
    const ready = d.t > DROP_REST;
    if (ready && dist < reach) {
      // it is pulled in with acceleration, not a jerk: you can see the nut fly to Buddy
      const pull = Math.min(560, 160 + (d.t - DROP_REST) * 1200);
      d.x += (dx / dist) * pull * dt;
      d.y += (dy / dist) * pull * dt;
    }
    if (ready && dist < 20) {
      d.got = true;
      if (d.kind === 'bolt') {
        g.bolts += d.val * g.stats.greed;
        g.hudPop = 1;
        g.sfx.push('pick');
      } else {
        p.hp = Math.min(g.stats.maxHp, p.hp + d.val);
        floatText(g, p.x, p.y - 34, '+' + d.val, '#7ddc8a');
        g.sfx.push('heal');
      }
    }
  }
  g.drops = g.drops.filter((d) => !d.got);
}

// ---------- robots arrive ----------

function spawnEnemy(g, type, x, y) {
  const d = ENEMIES[type];
  const scaled = type !== 'boss';
  const e = {
    type, x, y, r: d.r,
    hp: d.hp * (scaled ? g.cfg.hpMul : 1),
    dmg: d.dmg * (scaled ? g.cfg.dmgMul : 1),
    speed: d.speed * rand(0.9, 1.1),
    kx: 0, ky: 0, flash: 0,
    cd: rand(1, 2.5),
    strafe: Math.random() < 0.5 ? -1 : 1,
    in: false, dead: false,
    seed: Math.random() * 10,
  };
  e.maxHp = e.hp;
  g.enemies.push(e);
  return e;
}

function spawnGroup(g) {
  const side = (Math.random() * 4) | 0;
  const x = side === 0 ? -30 : side === 1 ? W + 30 : rand(60, W - 60);
  const y = side === 2 ? -30 : side === 3 ? H + 30 : rand(60, H - 60);
  const total = g.cfg.pool.reduce((sum, [, w]) => sum + w, 0);
  for (let i = 0; i < g.cfg.group; i++) {
    let roll = Math.random() * total;
    let type = g.cfg.pool[0][0];
    for (const [t, w] of g.cfg.pool) {
      if ((roll -= w) < 0) { type = t; break; }
    }
    spawnEnemy(g, type, x + rand(-45, 45), y + rand(-45, 45));
  }
}

function finishWave(g) {
  for (const e of g.enemies) burst(g, e.x, e.y, '#9fb2c4', 4);
  // whatever was not picked up in time is counted automatically
  for (const d of g.drops) if (d.kind === 'bolt') g.bolts += d.val * g.stats.greed;
  g.enemies = [];
  g.shots = [];
  g.foeShots = [];
  g.drops = [];
  for (const a of g.arms) {
    a.swing = -1;
    a.target = null;
  }
  g.player.moving = false;
  if (g.wave >= LAST_WAVE) {
    g.phase = 'won';
    g.sfx.push('win');
    return;
  }
  g.phase = 'shop';
  g.rerolls = 0;
  rollShop(g);
  g.sfx.push('wave');
}

// ---------- shop ----------

export function rollShop(g) {
  const armsFull = g.arms.every((a) => a.id);
  const scale = 1 + 0.1 * (g.wave - 1);
  const offers = [];
  for (let i = 0; i < 4; i++) {
    // while there are free hands, the first slot is always a weapon
    const weapon = (i === 0 && !armsFull) || Math.random() < (armsFull ? 0.25 : 0.4);
    const id = pickKey(weapon ? WEAPONS : ITEMS);
    const base = (weapon ? WEAPONS : ITEMS)[id].cost;
    offers.push({ kind: weapon ? 'weapon' : 'item', id, price: Math.round(base * scale), sold: false });
  }
  g.shop = { offers };
}

export const rerollCost = (g) => 2 + g.wave + g.rerolls * 2;

export function reroll(g) {
  const cost = rerollCost(g);
  if (g.bolts < cost) return false;
  g.bolts -= cost;
  g.rerolls++;
  rollShop(g);
  return true;
}

// Whether an offer can be bought and what to write on its button.
export function canBuy(g, o) {
  if (o.sold) return { ok: false, label: 'Sold' };
  let label = 'Buy';
  if (o.kind === 'weapon') {
    const free = g.arms.some((a) => !a.id);
    const twin = g.arms.some((a) => a.id === o.id);
    if (!free && !twin) return { ok: false, label: 'All hands are full' };
    label = free ? 'Take in hand' : 'Upgrade the same one';
  }
  if (g.bolts < o.price) return { ok: false, label: 'Not enough nuts' };
  return { ok: true, label };
}

export function buy(g, i) {
  const o = g.shop?.offers[i];
  if (!o || !canBuy(g, o).ok) return false;
  g.bolts -= o.price;
  o.sold = true;
  if (o.kind === 'weapon') {
    const free = g.arms.find((a) => !a.id);
    if (free) {
      free.id = o.id;
      free.lvl = 1;
      free.cd = 0;
    } else {
      // no hands left: upgrade the weakest weapon of the same kind
      const twins = g.arms.filter((a) => a.id === o.id).sort((a, b) => a.lvl - b.lvl);
      twins[0].lvl++;
    }
  } else {
    g.items[o.id] = (g.items[o.id] || 0) + 1;
    recalc(g);
  }
  return true;
}

// ---------- effects ----------

function burst(g, x, y, col, n) {
  if (g.fx.length > 300) return;
  for (let i = 0; i < n; i++) {
    g.fx.push({ x, y, vx: rand(-150, 150), vy: rand(-150, 150), t: 0, life: rand(0.25, 0.5), col, size: rand(2, 4.5) });
  }
}

function floatText(g, x, y, txt, col) {
  if (g.texts.length > 50) g.texts.shift();
  g.texts.push({ x, y, txt, col, t: 0 });
}

function stepFx(g, dt) {
  for (const f of g.fx) {
    f.t += dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }
  g.fx = g.fx.filter((f) => f.t < f.life);
  for (const t of g.texts) {
    t.t += dt;
    t.y -= 40 * dt;
  }
  g.texts = g.texts.filter((t) => t.t < 0.6);
  for (const b of g.blasts) b.t += dt;
  g.blasts = g.blasts.filter((b) => b.t < BLAST_TIME);
  for (const f of g.flashes) f.t += dt;
  g.flashes = g.flashes.filter((f) => f.t < FLASH_TIME);
}
