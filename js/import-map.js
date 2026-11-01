// Maps one spreadsheet row to a roll reference + negative, following docs/DATA.md.
// Pure functions. Every value that gets changed is reported as a 'fixed' problem.

import { COLOUR } from './ids.js';
import { newNegative, slug } from './schema.js';

// Sheet column → key. Headers are matched loosely (case, spaces, '#', '/').
const COLUMNS = {
  negativeid: 'id', filmroll: 'roll', strip: 'strip', frame: 'frame', datetaken: 'date',
  subjectdescription: 'subject', location: 'location', camera: 'camera', lens: 'lens',
  filmtype: 'film', digitized: 'digitized', filesize: 'size', digitalfile: 'scanFile',
  focus: 'focus', exposure: 'exposure', notes: 'notes', action: 'action',
  actioncomplete: 'actionComplete', editedfile: 'editedFile', rating: 'rating',
  social: 'social', print: 'print', printed: 'printed',
};

const headerKey = (header) => header.toLowerCase().replace(/[^a-z]/g, '');

/** Finds the header row (the one with "Negative ID") and maps column index → key. */
export function readHeader(rows) {
  const index = rows.findIndex((row) => row.some((cell) => headerKey(cell) === 'negativeid'));
  if (index === -1) return null;
  const columns = rows[index].map((cell) => COLUMNS[headerKey(cell)] || null);
  return { index, columns };
}

export function rowToRecord(row, columns) {
  const record = {};
  columns.forEach((key, i) => { if (key) record[key] = (row[i] || '').trim(); });
  return record;
}

// Typos from docs/DATA.md. Fixed and reported. 'Skif' has no certain fix, so it is only flagged.
const TYPOS = [
  [/\bSStreet\b/g, 'Street'],
  [/\bFBabylon\b/g, 'Babylon'],
  [/\bFernsehen Turm\b/g, 'Fernsehturm'],
  [/\bGraffit\b(?!i)/g, 'Graffiti'],
];
const FLAG_ONLY = [/\bSkif\b/];

const CATEGORY_PATTERN = /^(s?street photography|street|architecture|portrait|landscape)\s*-?\s*/i;
const CATEGORY_NAMES = { street: 'Street', 'street photography': 'Street', architecture: 'Architecture', portrait: 'Portrait', landscape: 'Landscape' };

const TRI_VALUES = { yes: 'Yes', y: 'Yes', no: 'No', n: 'No', maybe: 'Maybe' };
const TRUE_VALUES = ['true', 'yes', 'y', '1', '✓', 'x'];

export const toBool = (value) => TRUE_VALUES.includes((value || '').toLowerCase());
export const toTri = (value) => TRI_VALUES[(value || '').toLowerCase()] || null;

export function parseRoll(value) {
  // A letter after the number is kept: 'R001C' (colour) is a different roll from 'R001'.
  const match = /^R+(\d+)([A-Z]*)\s*(?:\((.*)\))?/i.exec(value || '');
  if (!match) return null;
  return { rollId: `R${match[1].padStart(3, '0')}${match[2].toUpperCase()}`, labNumber: match[3]?.trim() || undefined };
}

/** A roll ID ending in C ('R001C') is a colour roll. */
export const isColourRoll = (rollId) => /\d+C$/.test(rollId || '');

/** '2026-0001' → '2026-C0001' for negatives on a colour roll. */
export const toColourId = (id) => id.replace(/^(\d{4})-(\d{4})$/, `$1-${COLOUR}$2`);

export function parseFrame(value) {
  const match = /\d+/.exec(value || '');
  return { frameLabel: value || undefined, frame: match ? Number(match[0]) : undefined };
}

export function splitSubject(value) {
  const match = CATEGORY_PATTERN.exec(value || '');
  // Needs a separator, or a capital straight after ('PortraitMonika'), so 'Streetlight' stays whole.
  const next = value?.[match?.[0].length] || '';
  const joined = match && match[0].length === match[1].length;
  if (!match || (joined && next && next === next.toLowerCase())) return { category: undefined, subject: value || '' };
  const name = match[1].toLowerCase().replace(/^sstreet/, 'street');
  return { category: CATEGORY_NAMES[name], subject: value.slice(match[0].length).trim() };
}

export const normaliseFilm = (value) => value.replace(/\bForma\s*Pan\b|\bFormapan\b/gi, 'Fomapan');
export const normaliseLens = (value) => value.replace(/\bf\s?(\d+(?:\.\d+)?)\b/g, 'f/$1');
export const normaliseLocation = (value) => value.replace(/,(?=\S)/g, ', ').replace(/\s+/g, ' ');

export function normaliseFocus(value) {
  const v = (value || '').toLowerCase();
  if (!v) return undefined;
  if (v.startsWith('out')) return 'Out of focus';
  if (v.startsWith('sof')) return 'Soft';
  if (v.startsWith('clear') || v.startsWith('sharp')) return 'Clear';
  return null;
}

export function normaliseExposure(value) {
  const v = (value || '').toLowerCase();
  if (!v) return undefined;
  if (v.startsWith('under')) return 'Under';
  if (v.startsWith('over')) return 'Over';
  if (v.startsWith('good') || v.startsWith('ok') || v.startsWith('correct')) return 'Good';
  return null;
}

/** '2026-08' and '2026-08-15' are kept; '2026-00' means unknown. */
export function normaliseDate(value) {
  if (!value) return { date: undefined };
  if (/^\d{4}-00$/.test(value)) return { date: undefined, unknown: true };
  if (/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/.test(value)) return { date: value };
  return { date: undefined, unrecognised: true };
}

/**
 * Maps one record (column key → text) to { rollRef, negative, problems }.
 * rollRef = { rollId, labNumber }; negative is null when the row can't be used.
 */
export function mapRecord(record, line) {
  const problems = [];
  const dashed = (record.id || '').replace(/[–—]/g, '-');
  const rollRef = parseRoll(record.roll);
  const id = rollRef && isColourRoll(rollRef.rollId) ? toColourId(dashed) : dashed;
  const report = (type, detail) => problems.push({ type, id: id || undefined, line, detail });

  const fixed = (field, from, to) => {
    if (from !== to) report('fixed', `${field}: "${from}" → "${to}"`);
    return to;
  };
  const fixText = (field, value) => {
    let text = value || '';
    TYPOS.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
    FLAG_ONLY.forEach((pattern) => { if (pattern.test(text)) report('check', `${field}: "${text}" may contain a typo`); });
    return fixed(field, value || '', text);
  };

  if (record.id && record.id !== dashed) report('fixed', 'ID: en dash → hyphen');
  if (id !== dashed) report('fixed', 'ID: colour roll → C series');
  if (rollRef && !(record.roll || '').startsWith(rollRef.rollId)) report('fixed', `Roll: "${record.roll}" → "${rollRef.rollId}"`);

  const { category, subject } = splitSubject(fixText('Subject', record.subject));
  const { date, unknown, unrecognised } = normaliseDate(record.date);
  if (unknown) report('fixed', `Date: "${record.date}" is unknown, left empty`);
  if (unrecognised) report('check', `Date: "${record.date}" not recognised, left empty`);

  const focus = normaliseFocus(record.focus);
  if (focus === null) report('check', `Focus: "${record.focus}" not recognised`);
  else if (focus && record.focus !== focus) fixed('Focus', record.focus, focus);
  const exposure = normaliseExposure(record.exposure);
  if (exposure === null) report('check', `Exposure: "${record.exposure}" not recognised`);

  // The Rating column sometimes holds Yes / Maybe / No (R001): treat it as Social.
  let social = toTri(record.social);
  let rating;
  if (/^[1-5]$/.test(record.rating || '')) rating = Number(record.rating);
  else if (toTri(record.rating)) {
    if (!social) social = toTri(record.rating);
    report('fixed', `Rating: "${record.rating}" read as Social`);
  }

  const camera = record.camera || '';
  const lens = record.lens ? fixed('Lens', record.lens, normaliseLens(record.lens)) : '';
  const film = record.film ? fixed('Film', record.film, normaliseFilm(record.film)) : '';
  const placeName = record.location ? fixText('Location', record.location) : '';
  const location = placeName ? fixed('Location', placeName, normaliseLocation(placeName)) : '';
  const size = (record.size || '').toUpperCase();

  if (!id || !rollRef) {
    return { rollRef, negative: null, problems, gear: {} };
  }

  const negative = newNegative({
    id,
    rollId: rollRef.rollId,
    strip: Number(record.strip) || undefined,
    ...parseFrame(record.frame),
    dateTaken: date,
    category,
    subject,
    location: location || undefined,
    cameraId: camera ? slug(camera) : undefined,
    lensId: lens ? slug(lens) : undefined,
    filmStock: film || undefined,
    digitized: toBool(record.digitized),
    scanSize: size === 'S' || size === 'L' ? size : undefined,
    scanFile: record.scanFile || undefined,
    focus: focus || undefined,
    exposure: exposure || undefined,
    notes: fixText('Notes', record.notes) || undefined,
    action: /^edit/i.test(record.action || '') ? 'Edit' : 'None',
    actionComplete: toBool(record.actionComplete),
    editedFile: record.editedFile || undefined,
    rating,
    social: social || 'No',
    print: toTri(record.print) || 'No',
    printed: toBool(record.printed),
  });

  return { rollRef, negative, problems, gear: { camera, lens, film } };
}
