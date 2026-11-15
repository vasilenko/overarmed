// A tiny synthesizer: every sound is a short beep, no files needed.

let ac = null;
let muted = false;
const last = {};

// name: [waveform, start frequency, end frequency, duration, volume]
const SOUNDS = {
  shoot: ['square', 620, 300, 0.05, 0.02],
  swing: ['triangle', 240, 90, 0.09, 0.05],
  hit: ['square', 190, 120, 0.04, 0.02],
  boom: ['sawtooth', 130, 40, 0.14, 0.04],
  pick: ['sine', 880, 1400, 0.06, 0.04],
  heal: ['sine', 520, 1040, 0.18, 0.06],
  hurt: ['sawtooth', 220, 60, 0.25, 0.1],
  dead: ['sawtooth', 300, 30, 0.9, 0.12],
  ring: ['square', 90, 180, 0.3, 0.05],
  buy: ['sine', 660, 990, 0.1, 0.07],
  deny: ['square', 130, 100, 0.12, 0.05],
  wave: ['triangle', 440, 880, 0.35, 0.08],
  win: ['triangle', 520, 1560, 0.8, 0.1],
  blast: ['sawtooth', 95, 28, 0.45, 0.16],
  smash: ['square', 150, 45, 0.18, 0.13],
  slash: ['triangle', 1000, 320, 0.11, 0.06],
  zap: ['sawtooth', 1700, 240, 0.13, 0.05],
};

export function play(name) {
  const d = SOUNDS[name];
  if (muted || !d) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const now = ac.currentTime;
    if (now - (last[name] ?? -1) < 0.045) return; // don't spam the same sound
    last[name] = now;
    const [type, f0, f1, dur, vol] = d;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f1, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  } catch {
    // the game is playable without sound too
  }
}

export function toggleMute() {
  muted = !muted;
  return muted;
}
