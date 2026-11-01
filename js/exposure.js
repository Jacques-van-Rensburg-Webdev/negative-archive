// Exposure maths for the meter: EV from a phone photo's EXIF, ⅓-stop apertures and shutter
// speeds, solving one from the other, filter factors and reciprocity failure.
// EV here is the scene's EV at ISO 100 (EV₁₀₀) unless a name says otherwise.

const log2 = Math.log2;
const round1 = (n) => Math.round(n * 10) / 10;

/** EV₁₀₀ of the scene from the phone's own exposure (N, t, ISO). */
export const evFromExif = ({ fNumber, exposureTime, iso }) => log2((fNumber * fNumber) / exposureTime) - log2(iso / 100);

/** EV at a film speed: EV₁₀₀ + log₂(ISO ÷ 100). */
export const evAtIso = (ev100, iso) => ev100 + log2(iso / 100);

/** Rough EV₁₀₀ for the Shoot Light chips, used when there is no metering photo. */
export const LIGHT_EV = { 'Bright sun': 15, Overcast: 12, Shade: 12, 'Golden hour': 12, Indoor: 7, Night: 4 };

/** Stops of light a filter takes away. ND is set in stops by the user. */
export const FILTER_STOPS = { None: 0, Yellow: 1, Orange: 2, Red: 3, Green: 2, Polariser: 4 / 3 };

// ⅓-stop scales. Values are exact (2^(k/6) and 2^(−k/3)); labels are the marked ones.
const APERTURE_LABELS = ['1', '1.1', '1.2', '1.4', '1.6', '1.8', '2', '2.2', '2.5', '2.8', '3.2', '3.5', '4', '4.5', '5', '5.6', '6.3', '7.1', '8', '9', '10', '11', '13', '14', '16', '18', '20', '22', '25', '29', '32'];
export const APERTURES = APERTURE_LABELS.map((label, k) => ({ label: `f/${label}`, value: 2 ** (k / 6) }));

const SHUTTER_LABELS = [
  '1/8000', '1/6400', '1/5000', '1/4000', '1/3200', '1/2500', '1/2000', '1/1600', '1/1250', '1/1000', '1/800', '1/640',
  '1/500', '1/400', '1/320', '1/250', '1/200', '1/160', '1/125', '1/100', '1/80', '1/60', '1/50', '1/40', '1/30', '1/25',
  '1/20', '1/15', '1/13', '1/10', '1/8', '1/6', '1/5', '1/4', '1/3', '0.4"', '1/2', '0.6"', '0.8"', '1"', '1.3"', '1.6"',
  '2"', '2.5"', '3"', '4"', '5"', '6"', '8"', '10"', '13"', '15"', '20"', '25"', '30"', '40"', '50"', '60"',
];
export const SHUTTERS = SHUTTER_LABELS.map((label, k) => ({ label, value: 2 ** ((k - 39) / 3) }));

/** Full stops only, for chips and equivalent pairs. */
export const FULL_APERTURES = APERTURES.filter((_, k) => k % 3 === 0);
export const FULL_SHUTTERS = SHUTTERS.filter((_, k) => k % 3 === 0);

const nearest = (scale, value) => scale.reduce((best, s) => (Math.abs(log2(s.value / value)) < Math.abs(log2(best.value / value)) ? s : best));

/** 'f/8' or 8 → 8. */
export const apertureValue = (a) => (typeof a === 'number' ? a : Number(String(a).replace(/^f\//, '')));

/** '1/125' → 0.008, '2"' or '2s' → 2. */
export function shutterValue(s) {
  const text = String(s).trim().replace(/["s]$/, '');
  if (text.includes('/')) {
    const [a, b] = text.split('/').map(Number);
    return a / b;
  }
  return Number(text);
}

/** A time in seconds as text: '1/125', '4"', '2 min 30 s'. */
export function shutterText(seconds) {
  if (seconds > 60) {
    const total = Math.round(seconds);
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return sec ? `${min} min ${sec} s` : `${min} min`;
  }
  return nearest(SHUTTERS, seconds).label;
}

// Reciprocity: for metered times over 1 s, adjusted = metered ^ p (Schwarzschild).
// Ilford publishes p; Kodak's tables are fitted. approx marks stocks without published data.
const RECIPROCITY = [
  [/hp5/i, 1.31], [/fp4/i, 1.26], [/delta 100/i, 1.26], [/delta 400/i, 1.41], [/delta 3200/i, 1.33],
  [/pan ?f/i, 1.33], [/sfx/i, 1.43], [/xp2/i, 1.31], [/tri-?x/i, 1.6], [/t-?max 100/i, 1.15], [/t-?max 400/i, 1.24],
  [/portra/i, 1.33, true], [/ektar/i, 1.33, true],
];
const GENERAL_P = 1.3;

/** { p, approx } for a film stock name. */
export function reciprocityFor(film) {
  const found = RECIPROCITY.find(([pattern]) => pattern.test(film || ''));
  return found ? { p: found[1], approx: Boolean(found[2]) } : { p: GENERAL_P, approx: true };
}

export const reciprocityTime = (seconds, p) => (seconds > 1 ? seconds ** p : seconds);

/**
 * Settings for a reading. ev100 = scene; iso = film speed; stops = filter + calibration offsets
 * (positive = more exposure). Lock 'aperture' (give aperture) or 'shutter' (give shutter).
 * Returns { ev, aperture, shutter, metered, corrected, reciprocity? } with labels and seconds.
 */
export function solve({ ev100, iso, stops = 0, lock = 'aperture', aperture, shutter, film, lens = {} }) {
  const ev = evAtIso(ev100, iso) - stops; // exposure value the camera needs
  if (lock === 'aperture') {
    const n = apertureValue(aperture);
    const metered = (n * n) / 2 ** ev;
    const { p, approx } = reciprocityFor(film);
    const corrected = reciprocityTime(metered, p);
    return {
      ev: round1(ev),
      aperture: nearest(APERTURES, n).label,
      shutter: shutterText(corrected),
      metered,
      corrected,
      reciprocity: metered > 1 ? { metered: shutterText(metered), approx } : undefined,
    };
  }
  const t = shutterValue(shutter);
  const widest = lens.maxAperture || 1;
  const n = Math.sqrt(t * 2 ** ev);
  const inRange = APERTURES.filter((a) => a.value >= widest - 0.01);
  const chosen = nearest(inRange, n);
  return {
    ev: round1(ev),
    aperture: chosen.label,
    shutter: nearest(SHUTTERS, t).label,
    metered: t,
    corrected: t,
    outOfRange: n < widest * 0.9 ? 'under' : n > 32 * 1.1 ? 'over' : undefined,
  };
}

/** Equivalent pairs at full-stop apertures within a lens's range (widest to f/22). */
export function equivalents({ ev100, iso, stops = 0, film, lens = {} }) {
  const widest = lens.maxAperture || 1.4;
  return FULL_APERTURES
    .filter((a) => a.value >= widest - 0.05 && a.value <= 22.7)
    .map((a) => solve({ ev100, iso, stops, aperture: a.label, film }))
    .filter((pair) => pair.corrected >= SHUTTERS[0].value * 0.9 && pair.corrected <= 3600) // '1/8000' is really 1/8192
    .map(({ aperture, shutter }) => ({ aperture, shutter }));
}
