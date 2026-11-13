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
// Melee weapons hit with a swing: len — length from fist to tip, arc — width of the arc in radians,
// time — how long the swing lasts, range — how close to the fist a robot must come to get hit.
export const WEAPONS = {
  revolver: {
    name: 'Revolver', kind: 'ranged', starter: true, cost: 22,
    dmg: 13, cd: 0.75, range: 380, speed: 800, count: 1, spread: 0, pierce: 1, knock: 90,
    muzzle: [25, -7],
    blurb: 'Slow and accurate. The bullet goes through two.',
  },
  bat: {
    name: 'Bat', kind: 'melee', starter: true, cost: 20,
    dmg: 22, cd: 0.85, range: 52, len: 38, arc: 2.4, time: 0.2, knock: 300,
    blurb: 'A wide swing that knocks robots back.',
  },
  sword: {
    name: 'Sword', kind: 'melee', starter: true, cost: 20,
    dmg: 10, cd: 0.5, range: 52, len: 38, arc: 1.7, time: 0.16, knock: 60,
    blurb: 'Fast slashes, one way and then the other.',
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
    dmg: 6, cd: 0.24, range: 48, len: 38, arc: 0.3, time: 0.2, knock: 30,
    blurb: 'Saws through anything that gets close.',
  },
};

// mass — how hard it is to push back. ai: chase goes for the player, shooter keeps its distance.
export const ENEMIES = {
  intern: { name: 'Intern Bot', hp: 16, speed: 78, dmg: 8, r: 15, bolts: 1, mass: 1, ai: 'chase' },
  drone: { name: 'Courier Drone', hp: 9, speed: 165, dmg: 6, r: 11, bolts: 1, mass: 0.7, ai: 'chase' },
  copier: { name: 'Copier', hp: 26, speed: 60, dmg: 8, r: 17, bolts: 2, mass: 1.3, ai: 'shooter' },
  forklift: { name: 'Forklift', hp: 90, speed: 48, dmg: 20, r: 24, bolts: 5, mass: 3.5, ai: 'chase' },
  boss: { name: 'Director-3000', hp: 3500, speed: 70, dmg: 25, r: 44, bolts: 40, mass: 25, ai: 'boss' },
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
