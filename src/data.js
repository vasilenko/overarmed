// All content and balance numbers live here: tweak them and see what happens.

export const W = 1120;
export const H = 630;
export const LAST_WAVE = 10;

// Buddy's six arms. The first two are his own, the other four are bionic. The arms themselves
// are never drawn: only the fists, which sit at fixed spots right next to the torso. An empty
// hand shows a gloved fist, a busy one shows its weapon.
// hx, hy — where the fist sits relative to the player's centre (tuned to assets/buddy-walk.png),
// ang — where the fist or the weapon points while there is no target.
export const ARM_SLOTS = [
  { bionic: false, ang: 0, hx: 27, hy: -2 },
  { bionic: false, ang: Math.PI, hx: -27, hy: -2 },
  { bionic: true, ang: -Math.PI * 0.28, hx: 24, hy: -20 },
  { bionic: true, ang: -Math.PI * 0.72, hx: -24, hy: -20 },
  { bionic: true, ang: Math.PI * 0.28, hx: 24, hy: 14 },
  { bionic: true, ang: Math.PI * 0.72, hx: -24, hy: 14 },
];

// How far the fist lunges toward the target when a melee weapon strikes.
export const LUNGE = 12;

// Timing and reach of melee effects: impact — how long the hit burst stays, in seconds;
// slashFade — how long the sword trail lingers after the slash; hitStop — the tiny freeze of the
// whole game when the bat lands, which is what makes the blow feel heavy; stabLunge — how far the
// fist goes forward in a sword stab.
export const MELEE_FX = { impact: 0.2, slashFade: 0.14, hitStop: 0.05, stabLunge: 20 };

// How many seconds the muzzle flash stays visible after a shot.
export const FLASH_TIME = 0.07;

export const BASE_STATS = {
  maxHp: 100, // health
  dmg: 1, // damage multiplier
  rate: 1, // attack speed multiplier
  speed: 1, // run speed multiplier
  armor: 0, // every point cuts incoming damage
  regen: 0, // health per second
  range: 1, // range multiplier
  pickup: 1, // pickup radius multiplier
  greed: 1, // multiplier for nuts dropped by robots
};

export const STAT_INFO = {
  maxHp: { label: 'Health' },
  dmg: { label: 'Damage', pct: true },
  rate: { label: 'Attack speed', pct: true },
  speed: { label: 'Run speed', pct: true },
  armor: { label: 'Armor' },
  regen: { label: 'Healing per second' },
  range: { label: 'Shooting range', pct: true },
  pickup: { label: 'Pickup radius', pct: true },
  greed: { label: 'Nuts from robots', pct: true },
};

export const PLAYER_SPEED = 230;
export const PICKUP_RADIUS = 80;
// How many seconds a dropped item rests on the floor before it can be picked up. Without this
// pause a nut from a robot killed at point-blank range vanishes before you can even see it.
export const DROP_REST = 0.45;

// cd — pause between attacks in seconds, range — in arena pixels.
// muzzle — where the sprite's muzzle is relative to the fist: [forward, down]; negative is above the fist.
// Melee weapons: len — length from fist to tip, range — how close to the fist a robot must come
// to be attacked, time — how long one attack lasts, move — how the weapon attacks:
//   smash — the bat: a wind-up and one heavy blow to a single robot; windup is how far the bat
//           is pulled back, in radians;
//   blade — the sword: it stabs a lone robot, but when `crowd` or more robots are within reach it
//           slashes all of them in a wide arc instead; slashDmg, slashTime and arc describe the slash;
//   saw   — the chainsaw: holds the bar on the target and grinds whatever touches it; arc is its wobble.
// Ranged weapons fire bullets unless they have a move of their own:
//   zap   — the jumper cables: no bullet, the charge hits the target at once and then jumps to the
//           nearest robot within `jump` pixels, up to `chain` times; every jump keeps `falloff`
//           of the damage;
//   throw — the boomerang wrench: it flies out past `range`, slowing down, and hits every robot on
//           its way; then it flies back into the hand, pulled in with the acceleration `pull`,
//           and hits them again. The hand is empty meanwhile, and cd only starts at the catch.
export const WEAPONS = {
  revolver: {
    name: 'Revolver', kind: 'ranged', starter: true, cost: 22,
    dmg: 13, cd: 0.75, range: 380, speed: 800, count: 1, spread: 0, pierce: 1, knock: 90,
    muzzle: [25, -7],
    blurb: 'Slow and accurate. The bullet goes through two.',
  },
  bat: {
    name: 'Bat', kind: 'melee', starter: true, cost: 20,
    dmg: 34, cd: 0.8, range: 52, len: 38, move: 'smash', windup: 1.1, time: 0.28, knock: 460,
    blurb: 'One heavy blow to a single robot. Sends it flying.',
  },
  sword: {
    name: 'Sword', kind: 'melee', starter: true, cost: 20,
    dmg: 14, cd: 0.5, range: 52, len: 38, move: 'blade', time: 0.15, knock: 60,
    crowd: 2, slashDmg: 9, slashTime: 0.2, arc: 2.6,
    blurb: 'Stabs a lone robot, slashes wide when they crowd in.',
  },
  rifle: {
    name: 'Assault Rifle', kind: 'ranged', cost: 30,
    dmg: 4, cd: 0.17, range: 340, speed: 760, count: 1, spread: 0.12, pierce: 0, knock: 20,
    muzzle: [35, -6],
    blurb: 'Sprays bullets in bursts.',
  },
  shotgun: {
    name: 'Shotgun', kind: 'ranged', cost: 30,
    dmg: 6, cd: 1.05, range: 250, speed: 620, count: 5, spread: 0.5, pierce: 0, knock: 130,
    muzzle: [36, -6],
    blurb: 'A fan of pellets at point-blank range.',
  },
  chainsaw: {
    name: 'Chainsaw', kind: 'melee', cost: 32,
    dmg: 6, cd: 0.24, range: 48, len: 38, move: 'saw', arc: 0.3, time: 0.2, knock: 30,
    blurb: 'Saws through anything that gets close.',
  },
  cables: {
    name: 'Jumper Cables', kind: 'ranged', cost: 30,
    dmg: 9, cd: 0.9, range: 210, move: 'zap', chain: 4, jump: 110, falloff: 0.8, knock: 0,
    muzzle: [28, 0],
    blurb: 'Zaps a robot, and the charge jumps on to four more.',
  },
  wrench: {
    name: 'Boomerang Wrench', kind: 'ranged', cost: 28,
    dmg: 15, cd: 0.3, range: 260, move: 'throw', speed: 700, pull: 1800, knock: 110,
    muzzle: [14, 0],
    blurb: 'Flies out and comes back. Hits everything in its way, twice.',
  },
};

// How many seconds a lightning arc from the jumper cables stays on screen.
export const ARC_TIME = 0.14;

// mass — how hard it is to push back. ai: chase goes for the player, shooter keeps its distance.
// flies — the robot passes over obstacles instead of walking around them.
export const ENEMIES = {
  intern: { name: 'Intern Bot', hp: 16, speed: 78, dmg: 8, r: 15, bolts: 1, mass: 1, ai: 'chase' },
  drone: { name: 'Courier Drone', hp: 9, speed: 165, dmg: 6, r: 11, bolts: 1, mass: 0.7, ai: 'chase', flies: true },
  copier: { name: 'Copier', hp: 26, speed: 60, dmg: 8, r: 17, bolts: 2, mass: 1.3, ai: 'shooter' },
  forklift: { name: 'Forklift', hp: 90, speed: 48, dmg: 20, r: 24, bolts: 5, mass: 3.5, ai: 'chase' },
  boss: { name: 'Director-3000', hp: 3500, speed: 70, dmg: 25, r: 44, bolts: 40, mass: 25, ai: 'boss', flies: true },
};

// Obstacles on the factory floor. A new layout is rolled at the start of every shift.
// r — radius of the round footprint that blocks movement and bullets, Buddy's and the robots' alike.
// Footprints are round on purpose: robots walk straight at Buddy, and a round shape lets them
// slide around it instead of getting stuck on a corner.
// A barrel can be destroyed: hp is how much damage it takes before it blows up. blast is the radius
// of the explosion, dmg is what robots inside it take (scaled with the shift, like their health),
// selfDmg is what Buddy takes, fuse is the delay before another barrel caught in the blast goes off.
export const OBSTACLES = {
  machine: { r: 28, looks: ['press', 'cabinet', 'lathe'] }, // looks: sprites to pick from, assets/obstacles/<look>.png
  pillar: { r: 17 },
  barrel: { r: 13, hp: 14, blast: 100, dmg: 55, selfDmg: 22, fuse: 0.14 },
};

// How long the explosion stays on screen, in seconds.
export const BLAST_TIME = 0.45;

// Conveyor belts block nothing: they carry along whatever stands on them — Buddy, walking robots
// and dropped items alike. len and wide are the belt size in arena pixels, speed is how fast it
// carries (Buddy runs at 230), count is how many belts a shift gets.
// grip: a walking robot is carried at no more than this share of its own speed, so even the
// slowest one can still make headway against a belt instead of being stuck on it forever.
export const BELT = { len: 196, wide: 42, speed: 95, count: 2, grip: 0.6 }; // len / wide matches the sprite's shape

// How many obstacles of each kind a shift gets, and how much room they leave.
export const LAYOUT = {
  count: { machine: 3, pillar: 3, barrel: 4 },
  edge: 100, // stay this far from the arena edges, where the robots come in
  clear: 120, // stay this far from Buddy when the shift starts
  gap: 78, // free space between two footprints: enough for the widest walking robot
};

// mods are added to BASE_STATS. Items stack without limit.
// An item's icon is the file assets/gear/<key>.png.
export const ITEMS = {
  coffee: { name: 'Vending Machine Coffee', cost: 16, mods: { rate: 0.12 } },
  energy: { name: 'Energy Drink', cost: 14, mods: { speed: 0.12, maxHp: -8 } },
  helmet: { name: 'Spare Hard Hat', cost: 18, mods: { armor: 2 } },
  boots: { name: 'Steel-Toe Boots', cost: 16, mods: { maxHp: 25, speed: -0.04 } },
  lunch: { name: 'Packed Lunch', cost: 18, mods: { regen: 1.5 } },
  union: { name: 'Union Card', cost: 20, mods: { maxHp: 15, armor: 1 } },
  overtime: { name: 'Overtime', cost: 18, mods: { dmg: 0.2, maxHp: -10 } },
  magnet: { name: 'Fridge Magnet', cost: 10, mods: { pickup: 0.6 } },
  tape: { name: 'Blue Electrical Tape', cost: 24, mods: { dmg: 0.1, rate: 0.08 } },
  level: { name: 'Laser Level', cost: 14, mods: { range: 0.18 } },
  bonus: { name: 'Quarterly Bonus', cost: 20, mods: { greed: 0.25 } },
  grease: { name: 'Grease Can', cost: 16, mods: { rate: 0.07, speed: 0.07 } },
};

// What happens on shift n.
export function waveCfg(n) {
  const boss = n === LAST_WAVE;
  const pool = [['intern', 10]];
  if (n >= 2) pool.push(['drone', 3 + n * 0.4]);
  if (n >= 3) pool.push(['copier', 2 + n * 0.2]);
  if (n >= 5) pool.push(['forklift', 1 + (n - 5) * 0.5]);
  return {
    boss,
    pool,
    dur: boss ? 0 : 18 + n * 2.5, // the boss shift lasts as long as the boss is alive
    interval: boss ? 1.6 : Math.max(0.85, 1.8 - n * 0.1), // pause between groups
    group: boss ? 3 : 2 + Math.floor(n / 3), // robots per group
    hpMul: 1 + 0.16 * (n - 1),
    dmgMul: 1 + 0.06 * (n - 1),
  };
}
