// All drawing on the canvas: sprites for the characters, weapons and arena, shapes for the rest.

import { W, H, LAST_WAVE, ARM_SLOTS, ENEMIES, FLASH_TIME, BLAST_TIME, BELT } from './data.js';

const INK = '#1b1d21';

// The arena floor: the image assets/floor.webp (cropped to the arena shape from assets/raw/floor-1.webp).
// A darkening layer is drawn on top of it. All of this is composed
// once into a separate canvas and then copied to the screen every frame.
const FLOOR_DIM = 0.2; // how much to dim the image so that characters and nuts read better
let floor = null;

function buildFloor() {
  const cv = document.createElement('canvas');
  // the canvas uses the image resolution, not the arena's: otherwise the floor is blurry on big screens
  cv.width = floorImg.naturalWidth;
  cv.height = Math.round((floorImg.naturalWidth * H) / W);
  const c = cv.getContext('2d');
  c.scale(cv.width / W, cv.height / H);
  c.drawImage(floorImg, 0, 0, W, H);
  c.fillStyle = `rgba(12, 14, 18, ${FLOOR_DIM})`;
  c.fillRect(0, 0, W, H);
  // corners are darker than the centre: it keeps the eye on the middle of the arena
  const shade = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.38)');
  c.fillStyle = shade;
  c.fillRect(0, 0, W, H);
  return cv;
}

function box(c, x, y, w, h, fill, r = 2) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.stroke();
}

// Images load in the background; until an image is ready we simply do not draw it.
function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const loaded = (img) => img.complete && img.naturalWidth > 0;

// A weapon with a sprite: the file assets/weapons/<id>.png, ART_PX image pixels per arena pixel.
// It is drawn with the barrel pointing right, and the fist with its cuff is already in the image.
// grip — where the centre of the fist is, as fractions of width and height: the hand holds the
// weapon by this point and the weapon rotates around it. Cut from sheets by tools/cut_sprite.py.
const ART_PX = 6.25; // weapon sheets are cut at scale 0.5, and 0.5 / 0.08 = 6.25
const WEAPON_ART = {
  revolver: { grip: [0.324, 0.626] },
  bat: { grip: [0.278, 0.48] },
  sword: { grip: [0.26, 0.52] },
  rifle: { grip: [0.28, 0.585] },
  shotgun: { grip: [0.245, 0.63] },
  chainsaw: { grip: [0.22, 0.637] },
};
for (const [id, art] of Object.entries(WEAPON_ART)) art.img = loadImage(`assets/weapons/${id}.png`);

// Small items: the file assets/items/<name>.png. h — height on the arena.
// The fist has a grip, like a weapon: the fist centre as fractions of width and height, cuff on the left.
const ITEM_ART = {
  fist: { h: 12, grip: [0.7, 0.5] },
  nut: { h: 12 },
  sandwich: { h: 15 },
  paper: { h: 17 },
  pinkslip: { h: 17 },
};
for (const [name, art] of Object.entries(ITEM_ART)) art.img = loadImage(`assets/items/${name}.png`);

const floorImg = loadImage('assets/floor.webp');

// The arena fence — yellow railings from assets/fence (cut from assets/raw/fence-1.webp):
// section — a front-view section for the top and bottom edges, side — the same railing seen
// from above for the left and right edges, post — a corner post with a lamp.
const FENCE_ART = {
  section: loadImage('assets/fence/section.png'),
  side: loadImage('assets/fence/side.png'),
  post: loadImage('assets/fence/post.png'),
};
const FENCE = {
  h: 26, // height of the front-view section, in arena pixels
  inset: 2, // inset from the screen edge
  top: 8, // top of the upper row: the corner post lamp has to fit above it
  edge: 7.5, // x of the outermost post centre; side columns and corner posts line up on it
  overlap: 0.14, // share of a section taken by a post: neighbouring sections overlap by this much
  capShare: 0.163, // the same for the side strip: share of its length taken by a post cap
};
const fenceReady = () => Object.values(FENCE_ART).every(loaded);
// all three pieces are cut at the same scale, so they share one scale in the game too
const fenceScale = () => FENCE.h / FENCE_ART.section.naturalHeight;

// A row of sections from the left edge to the right. Neighbouring sections overlap at their posts,
// so there are no seams. The section width is nudged so the row fits exactly edge to edge.
function fenceRow(c, top) {
  const img = FENCE_ART.section;
  const span = W - FENCE.inset * 2;
  const natural = img.naturalWidth * fenceScale();
  const n = Math.max(1, Math.round((span - natural * FENCE.overlap) / (natural * (1 - FENCE.overlap))));
  const w = span / (n * (1 - FENCE.overlap) + FENCE.overlap);
  for (let i = 0; i < n; i++) c.drawImage(img, FENCE.inset + i * w * (1 - FENCE.overlap), top, w, FENCE.h);
}

// A column of side strips from the base of the top row down to the bottom row.
function fenceColumn(c, x) {
  const img = FENCE_ART.side;
  const w = img.naturalWidth * fenceScale();
  const natural = img.naturalHeight * fenceScale();
  const from = FENCE.top + FENCE.h - 6;
  const span = H - FENCE.inset - FENCE.h + 6 - from;
  const n = Math.max(1, Math.round((span - natural * FENCE.capShare) / (natural * (1 - FENCE.capShare))));
  const h = span / (n * (1 - FENCE.capShare) + FENCE.capShare);
  for (let i = 0; i < n; i++) c.drawImage(img, x - w / 2, from + i * h * (1 - FENCE.capShare), w, h);
}

// A corner post with a lamp: its base sits on the same line as the base of the row.
function fencePost(c, x, rowTop) {
  const img = FENCE_ART.post;
  const w = img.naturalWidth * fenceScale();
  const h = img.naturalHeight * fenceScale();
  c.drawImage(img, x - w / 2, rowTop + FENCE.h - h, w, h);
}

// The far part of the fence: the sides and the top row. Drawn right after the floor, behind the characters.
function drawFenceBack(c) {
  if (!fenceReady()) return;
  c.imageSmoothingQuality = 'high';
  fenceColumn(c, FENCE.edge);
  fenceColumn(c, W - FENCE.edge);
  fenceRow(c, FENCE.top);
  fencePost(c, FENCE.edge, FENCE.top);
  fencePost(c, W - FENCE.edge, FENCE.top);
}

// The near part: the bottom row is drawn over the characters, which gives the arena depth.
function drawFenceFront(c) {
  if (!fenceReady()) return;
  const top = H - FENCE.inset - FENCE.h;
  c.imageSmoothingQuality = 'high';
  fenceRow(c, top);
  fencePost(c, FENCE.edge, top);
  fencePost(c, W - FENCE.edge, top);
}

// Draws an image so that its centre (or its grip, if one is set) lands on the point x, y.
function drawArt(c, art, x, y, scale = 1, rot = 0, flip = false) {
  if (!loaded(art.img)) return;
  const h = art.h * scale;
  const w = (h * art.img.naturalWidth) / art.img.naturalHeight;
  const [gx, gy] = art.grip ?? [0.5, 0.5];
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  if (flip) c.scale(1, -1);
  c.imageSmoothingQuality = 'high';
  c.drawImage(art.img, -gx * w, -gy * h, w, h);
  c.restore();
}

const drawItem = (c, name, ...rest) => drawArt(c, ITEM_ART[name], ...rest);

// Draws a weapon so that the fist ends up at the origin and the barrel points right.
function drawWeapon(c, id) {
  const art = WEAPON_ART[id];
  if (!art || !loaded(art.img)) return;
  const w = art.img.naturalWidth / ART_PX;
  const h = art.img.naturalHeight / ART_PX;
  c.imageSmoothingQuality = 'high';
  c.drawImage(art.img, -art.grip[0] * w, -art.grip[1] * h, w, h);
}

// Bullets and the muzzle flash: the file assets/shots/<file>.png, drawn flying to the right.
// h — height on the arena; grip — the point of the image that matches the bullet's position
// (its head), or the muzzle in the case of the flash.
const SHOT_ART = {
  revolver: { file: 'bullet', h: 7, grip: [0.8, 0.5] },
  rifle: { file: 'tracer', h: 3.6, grip: [0.96, 0.5] },
  shotgun: { file: 'pellet', h: 6, grip: [0.78, 0.5] },
  flash: { file: 'flash', h: 18, grip: [0.04, 0.5] },
};
for (const art of Object.values(SHOT_ART)) art.img = loadImage(`assets/shots/${art.file}.png`);

function drawShot(c, s) {
  // a warm glow around the bullet's head: without it a small projectile gets lost on the floor
  const glow = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, 11);
  glow.addColorStop(0, 'rgba(255, 190, 70, 0.45)');
  glow.addColorStop(1, 'rgba(255, 190, 70, 0)');
  c.fillStyle = glow;
  c.fillRect(s.x - 11, s.y - 11, 22, 22);
  drawArt(c, SHOT_ART[s.kind], s.x, s.y, 1, Math.atan2(s.vy, s.vx));
}

// The muzzle flash: appears at the moment of the shot and shrinks within a fraction of a second.
function drawFlash(c, f) {
  drawArt(c, SHOT_ART.flash, f.x, f.y, 1 - 0.4 * (f.t / FLASH_TIME), f.ang);
}

// Buddy's body — a strip of walk frames, assets/buddy-walk.png (made by tools/cut_sprite.py).
const buddyImg = loadImage('assets/buddy-walk.png');

const WALK_FRAMES = 4;
const WALK_FPS = 8;
const IDLE_FRAME = 1; // the frame with the feet together
// Layout of a strip cell: its height, the height of the standing character and the row where the soles rest.
const CELL = { h: 256, stand: 232, base: 240 };
const BUDDY_H = 58; // height on the arena
const BUDDY_FEET = 24; // how far the soles are below the player's centre

function drawBuddy(c, g) {
  const p = g.player;
  const t = g.time;
  const blink = g.phase === 'wave' && p.inv > 0 && Math.floor(t * 20) % 2;
  c.globalAlpha = blink ? 0.4 : 1;

  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath();
  c.ellipse(p.x, p.y + BUDDY_FEET - 1, 20, 6, 0, 0, 7);
  c.fill();

  if (loaded(buddyImg)) {
    const cw = buddyImg.naturalWidth / WALK_FRAMES;
    const k = BUDDY_H / CELL.stand;
    const frame = p.moving ? Math.floor(t * WALK_FPS) % WALK_FRAMES : IDLE_FRAME;
    c.save();
    c.translate(p.x, p.y + BUDDY_FEET);
    c.scale(p.face, 1); // the character is drawn facing right; mirror it to face left
    c.imageSmoothingQuality = 'high';
    c.drawImage(buddyImg, frame * cw, 0, cw, CELL.h, (-cw / 2) * k, -CELL.base * k, cw * k, CELL.h * k);
    c.restore();
  }

  // The arms are not drawn, only the fists. An empty hand shows a gloved fist, a busy one shows a weapon
  // whose image already includes the fist. Whoever is lower on the screen is drawn on top.
  const hands = g.arms.map((a, i) => ({ a, rest: ARM_SLOTS[i].ang })).sort((m, n) => m.a.y - n.a.y);
  for (const { a, rest } of hands) {
    const ang = a.id ? a.aim : rest;
    const flip = Math.cos(ang) < 0; // anything pointing left is flipped so it is not upside down
    if (!a.id) {
      drawItem(c, 'fist', a.x, a.y, 1, ang, flip);
      continue;
    }
    c.save();
    c.translate(a.x, a.y);
    c.rotate(ang);
    if (flip) c.scale(1, -1);
    drawWeapon(c, a.id);
    c.restore();
  }
  c.globalAlpha = 1;
}

// Robots with sprites: the file assets/robots/<type>.png, drawn facing the viewer.
// h — height on the arena; lift — how far the image centre is above the robot's centre; ground — where
// the floor is under the robot (for the shadow) when it does not stand on it, like the drone; move — how it sways.
const ENEMY_ART = {
  intern: { h: 44, lift: 4, move: 'roll' },
  drone: { h: 36, lift: 14, ground: 24, move: 'hover' },
  copier: { h: 50, lift: 5, move: 'rattle' },
  forklift: { h: 68, lift: 8, move: 'rattle' },
  boss: { h: 112, lift: 16, ground: 60, move: 'hover' }, // Director-3000 hovers on a jet of flame
};
for (const [type, art] of Object.entries(ENEMY_ART)) art.img = loadImage(`assets/robots/${type}.png`);

// A white silhouette of an image: the robot flashes with it when hit.
function whiteCopy(img) {
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const x = cv.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#fff';
  x.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

function drawEnemy(c, e, g) {
  const t = g.time + e.seed;
  const art = ENEMY_ART[e.type];
  if (!loaded(art.img)) return;
  const h = art.h;
  const w = (h * art.img.naturalWidth) / art.img.naturalHeight;

  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.beginPath();
  c.ellipse(e.x, e.y + (art.ground ?? h / 2 - art.lift) - 1, w * 0.42, w * 0.13, 0, 0, 7);
  c.fill();

  // robots have no frame animation: wheeled ones sway, the drone hovers, heavy ones rattle
  let ox = 0;
  let oy = -art.lift;
  let rot = 0;
  if (art.move === 'hover') oy += Math.sin(t * 5) * 3;
  else if (art.move === 'roll') rot = Math.sin(t * 9) * 0.07;
  else {
    ox = Math.sin(t * 40) * 0.5;
    oy += Math.sin(t * 31) * 0.5;
  }

  c.save();
  c.translate(e.x + ox, e.y + oy);
  c.rotate(rot);
  c.imageSmoothingQuality = 'high';
  c.drawImage(art.img, -w / 2, -h / 2, w, h);
  if (e.flash > 0) {
    art.white ||= whiteCopy(art.img);
    c.globalAlpha = 0.8;
    c.drawImage(art.white, -w / 2, -h / 2, w, h);
    c.globalAlpha = 1;
  }
  c.restore();

  // a health bar for those that take a long time to beat
  if (e.type === 'forklift' && e.hp < e.maxHp) {
    const top = e.y - art.lift - h / 2 - 9;
    c.fillStyle = INK;
    c.fillRect(e.x - 18, top, 36, 5);
    c.fillStyle = '#ff6b6b';
    c.fillRect(e.x - 17, top + 1, 34 * Math.max(0, e.hp / e.maxHp), 3);
  }
}

// A conveyor belt, also a placeholder shape: a dark rubber strip with yellow chevrons that run
// in the direction it carries, at the same speed as the belt itself.
function drawBelt(c, b, t) {
  box(c, b.x, b.y, b.w, b.h, '#22262c', 5);
  c.save();
  c.beginPath();
  c.rect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
  c.clip();
  const flat = b.dx !== 0;
  const dir = flat ? b.dx : b.dy;
  const len = flat ? b.w : b.h;
  const half = (flat ? b.h : b.w) / 2 - 7;
  const step = 28;
  const shift = (t * BELT.speed) % step;
  c.strokeStyle = 'rgba(242, 183, 5, 0.6)';
  c.lineWidth = 4;
  c.lineJoin = 'miter';
  for (let k = -step; k < len + step; k += step) {
    // a is the position along the belt, measured from the end the belt moves away from
    const a = dir > 0 ? k + shift : len - k - shift;
    c.beginPath();
    if (flat) {
      const cy = b.y + b.h / 2;
      c.moveTo(b.x + a - 7 * dir, cy - half);
      c.lineTo(b.x + a + 7 * dir, cy);
      c.lineTo(b.x + a - 7 * dir, cy + half);
    } else {
      const cx = b.x + b.w / 2;
      c.moveTo(cx - half, b.y + a - 7 * dir);
      c.lineTo(cx, b.y + a + 7 * dir);
      c.lineTo(cx + half, b.y + a - 7 * dir);
    }
    c.stroke();
  }
  c.restore();
}

// Obstacles with sprites: the file assets/obstacles/<look>.png, drawn standing on the floor.
// h — height on the arena. The grip is the middle of the bottom edge: that is where it stands.
const OBSTACLE_ART = {
  press: { h: 78 },
  cabinet: { h: 80 },
  lathe: { h: 68 },
};
for (const [look, art] of Object.entries(OBSTACLE_ART)) {
  art.grip = [0.5, 1];
  art.img = loadImage(`assets/obstacles/${look}.png`);
}

// The round footprint from the data is where the thing stands; its body rises above it,
// so a character walking behind it is partly hidden. Kinds without a sprite yet are
// placeholder shapes.
function drawObstacle(c, o) {
  const r = o.r;
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath();
  c.ellipse(o.x, o.y + r * 0.45, r * 1.2, r * 0.5, 0, 0, 7);
  c.fill();
  const art = OBSTACLE_ART[o.look];
  if (art) {
    drawArt(c, art, o.x, o.y + r * 0.6);
  } else if (o.kind === 'barrel') {
    // a hit barrel flashes white; a lit one blinks until it goes off
    const lit = o.flash > 0 || (o.fuse >= 0 && Math.floor(o.fuse * 30) % 2 === 0);
    box(c, o.x - r, o.y - r * 2.1, r * 2, r * 2.7, lit ? '#fff' : '#c8442f', 5);
    c.fillStyle = INK;
    c.fillRect(o.x - r, o.y - r * 1.45, r * 2, 2.5);
    c.fillRect(o.x - r, o.y - r * 0.2, r * 2, 2.5);
    box(c, o.x - 5, o.y - r * 1.15, 10, 10, '#ffc21a', 2);
  } else {
    box(c, o.x - r, o.y - r * 3.4, r * 2, r * 4, '#8f949c', 5);
    box(c, o.x - r - 3, o.y + r * 0.2, r * 2 + 6, r * 0.45, '#5b6068', 3);
    box(c, o.x - r, o.y - r * 1.2, r * 2, r * 0.5, '#f2b705', 1);
  }
}

// A barrel explosion: a fireball that swells to the blast radius and fades.
function drawBlast(c, b) {
  const k = b.t / BLAST_TIME;
  const r = b.r * (1 - (1 - k) ** 3);
  c.globalAlpha = 1 - k;
  c.fillStyle = '#ff7a1a';
  c.beginPath();
  c.arc(b.x, b.y, r, 0, 7);
  c.fill();
  c.fillStyle = '#ffe7a3';
  c.beginPath();
  c.arc(b.x, b.y, r * 0.6, 0, 7);
  c.fill();
  c.globalAlpha = 1;
}

// The copier throws sheets of paper, the director throws pink termination notices.
function drawFoeShot(c, s, t) {
  drawItem(c, s.kind === 'boss' ? 'pinkslip' : 'paper', s.x, s.y, 1, s.spin + t * 6);
}

// Nuts and food on the floor bob slightly. A big nut is worth more.
function drawDrop(c, d, t) {
  // a freshly dropped item hops and grows so that there is time to notice it
  const pop = Math.min(1, (d.t ?? 9) / 0.3);
  const grow = 0.5 + 0.5 * pop;
  const y = d.y + Math.sin(t * 5 + d.x) * 1.5 - Math.sin(pop * Math.PI) * 9;
  if (d.kind === 'food') drawItem(c, 'sandwich', d.x, y, grow);
  else {
    // a grey nut gets lost on the dark floor, so there is a warm glow under it
    const k = (d.val > 2 ? 1.4 : 1) * grow;
    const r = 13 * k;
    const glow = c.createRadialGradient(d.x, y, 0, d.x, y, r);
    glow.addColorStop(0, 'rgba(255, 196, 60, 0.5)');
    glow.addColorStop(1, 'rgba(255, 196, 60, 0)');
    c.fillStyle = glow;
    c.fillRect(d.x - r, y - r, r * 2, r * 2);
    drawItem(c, 'nut', d.x, y, k, d.x);
  }
}

// The health bar frame and its slot as fractions of the image width and height: the fill is drawn into the slot.
const hpImg = loadImage('assets/ui/hpbar.png');
const HP_SLOT = { x0: 0.226, x1: 0.955, y0: 0.266, y1: 0.739 };

// An interface label with a dark outline: without it light digits get lost on light details of the floor.
// The font and alignment are whatever is already set on the canvas.
function label(c, text, x, y, fill, outline) {
  c.lineJoin = 'round'; // otherwise the outline grows spikes on sharp letters
  c.lineWidth = outline;
  c.strokeStyle = 'rgba(27,29,33,0.85)';
  c.strokeText(text, x, y);
  c.fillStyle = fill;
  c.fillText(text, x, y);
}

function hud(c, g) {
  const p = g.player;
  const s = g.stats;
  c.textBaseline = 'middle';

  // health: the frame image, a red fill in its slot and the numbers on top
  const bx = 22;
  const by = 20;
  const bw = 196;
  const bh = (bw * hpImg.naturalHeight) / hpImg.naturalWidth || 44;
  if (loaded(hpImg)) {
    c.imageSmoothingQuality = 'high';
    c.drawImage(hpImg, bx, by, bw, bh);
  }
  const sx = bx + HP_SLOT.x0 * bw + 2;
  const sy = by + HP_SLOT.y0 * bh + 2;
  const sw = (HP_SLOT.x1 - HP_SLOT.x0) * bw - 4;
  const sh = (HP_SLOT.y1 - HP_SLOT.y0) * bh - 4;
  const k = Math.max(0, p.hp / s.maxHp);
  if (k > 0) {
    c.beginPath();
    c.roundRect(sx, sy, sw * k, sh, 3);
    c.fillStyle = k < 0.3 ? '#ff4d4d' : '#d9423f';
    c.fill();
    // a highlight along the top edge so the fill does not look flat
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(sx + 2, sy + 1.5, Math.max(0, sw * k - 4), 2.5);
  }
  c.font = 'bold 13px system-ui, sans-serif';
  c.textAlign = 'center';
  label(c, `${Math.ceil(p.hp)} / ${s.maxHp}`, sx + sw / 2, sy + sh / 2 + 0.5, '#fff', 3);

  // shift and timer
  c.font = '18px Impact, "Arial Narrow", sans-serif';
  label(c, `SHIFT ${g.wave} / ${LAST_WAVE}`, W / 2, 36, '#ffc21a', 4);
  if (g.cfg.boss && g.boss) {
    box(c, W / 2 - 220, 52, 440, 18, 'rgba(20,22,26,0.85)', 5);
    const bk = Math.max(0, g.boss.hp / g.boss.maxHp);
    if (bk > 0) {
      c.beginPath();
      c.roundRect(W / 2 - 217, 55, 434 * bk, 12, 3);
      c.fillStyle = '#ff9ec4';
      c.fill();
    }
    c.font = 'bold 13px system-ui, sans-serif';
    label(c, ENEMIES.boss.name, W / 2, 84, '#fff', 3);
  } else {
    const left = Math.max(0, Math.ceil(g.waveT));
    c.font = '40px Impact, "Arial Narrow", sans-serif';
    label(c, `0:${String(left).padStart(2, '0')}`, W / 2, 72, left <= 5 ? '#ffc21a' : '#fff', 6);
  }

  // nuts
  c.textAlign = 'right';
  c.font = `${30 * (1 + 0.3 * g.hudPop)}px Impact, "Arial Narrow", sans-serif`; // pulses on pickup
  label(c, String(Math.floor(g.bolts)), W - 34, 43, '#ffd34d', 5);
  const tw = c.measureText(String(Math.floor(g.bolts))).width;
  drawDrop(c, { kind: 'bolt', val: 5, x: W - 52 - tw, y: 42 }, 0);
}

export function draw(c, g) {
  if (!floor && loaded(floorImg)) floor = buildFloor();
  c.save();
  if (g.shake > 0) {
    const m = g.shake * 22;
    c.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  if (floor) c.drawImage(floor, 0, 0, W, H);
  else {
    // the floor image is still loading
    c.fillStyle = '#2e3239';
    c.fillRect(0, 0, W, H);
  }
  drawFenceBack(c);
  for (const b of g.belts) drawBelt(c, b, g.time);
  for (const d of g.drops) drawDrop(c, d, g.time);
  // Everything that stands on the floor shares one queue, sorted by where it touches the floor:
  // whoever is lower on the screen is closer to the viewer and is drawn on top.
  const queue = [{ y: g.player.y, draw: () => drawBuddy(c, g) }];
  for (const e of g.enemies) if (!e.dead) queue.push({ y: e.y, draw: () => drawEnemy(c, e, g) });
  for (const o of g.obstacles) queue.push({ y: o.y, draw: () => drawObstacle(c, o) });
  queue.sort((a, b) => a.y - b.y);
  for (const item of queue) item.draw();
  drawFenceFront(c);
  for (const b of g.blasts) drawBlast(c, b);
  for (const s of g.shots) drawShot(c, s);
  for (const f of g.flashes) drawFlash(c, f);
  for (const s of g.foeShots) drawFoeShot(c, s, g.time);
  for (const f of g.fx) {
    c.globalAlpha = 1 - f.t / f.life;
    c.fillStyle = f.col;
    c.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
  }
  c.globalAlpha = 1;
  c.font = 'bold 15px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const t of g.texts) {
    c.globalAlpha = 1 - (t.t / 0.6) ** 2;
    c.lineWidth = 3;
    c.strokeStyle = INK;
    c.strokeText(t.txt, t.x, t.y);
    c.fillStyle = t.col;
    c.fillText(t.txt, t.x, t.y);
  }
  c.globalAlpha = 1;
  c.restore();
  if (g.phase === 'wave') {
    // the interface is moved down so it does not overlap the top row of the railing
    c.save();
    c.translate(0, 12);
    hud(c, g);
    c.restore();
  }
}
