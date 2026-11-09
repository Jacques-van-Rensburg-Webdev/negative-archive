// Darkroom timer: Web Audio cues (started from a tap) and the screen wake lock.

const LEVEL = 0.15;
let audio;

function beep(frequency, seconds, delay = 0) {
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = frequency;
  gain.gain.value = LEVEL;
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + seconds);
}

/** Call from a tap: browsers only allow sound after one. */
export function unlockSound() {
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    audio = audio || new Context();
    audio.resume();
  } catch {
    audio = undefined;
  }
}

/** Plays 'agitate', 'tick' or 'end'. */
export function playCue(kind) {
  if (!audio) return;
  if (kind === 'agitate') { beep(880, 0.12); beep(880, 0.12, 0.24); }
  if (kind === 'tick') beep(1200, 0.05);
  if (kind === 'end') [0, 0.5, 1].forEach((delay) => beep(660, 0.35, delay));
}

let lock;
let wanted = false;

async function acquire() {
  try {
    lock = await navigator.wakeLock?.request('screen');
  } catch {
    lock = undefined;
  }
}

/** Keeps the screen on while wanted is true. Failures are ignored. */
export function keepAwake(on) {
  if (on === wanted) return;
  wanted = on;
  if (on) acquire();
  else {
    lock?.release().catch(() => {});
    lock = undefined;
  }
}

document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') acquire();
});
