// Data model, as in docs/DATA.md. Keep the two in step.

/** @typedef {'No' | 'Maybe' | 'Yes'} Tri */

/**
 * @typedef {object} Roll
 * @property {string} id                 'R003', unique, user-facing ('R001C' = colour)
 * @property {'bw' | 'colour'} process   decides the negative ID series (slide film counts as colour)
 * @property {'35mm' | '120'} [format]   35mm when not set
 * @property {'6x4.5' | '6x6' | '6x7' | '6x9'} [frameSize]  120 only
 * @property {string} [labNumber]        '5331', '167870jaqu_008613'
 * @property {string} filmStock          'Fomapan 400'
 * @property {number} [boxIso]
 * @property {number} [shotIso]          exposure index used (push / pull)
 * @property {number} exposures          36
 * @property {string} [cameraId]
 * @property {string} [defaultLensId]
 * @property {string} [loadedAt]         ISO datetime (from Shoot)
 * @property {'shooting' | 'at_lab' | 'developed' | 'archived'} status
 * @property {string} [storageLocation]
 * @property {string} [notes]
 */

/**
 * @typedef {object} Negative
 * @property {string} id                 'YYYY-NNNN' (B&W) or 'YYYY-CNNNN' (colour), unique, never reused
 * @property {string} rollId
 * @property {number} [strip]
 * @property {number} [frame]            first frame number, used for sorting
 * @property {string} [frameLabel]       as written on the film: '6', '3-4', '6A'
 * @property {string} [dateTaken]        'YYYY-MM', 'YYYY-MM-DD' or ISO datetime
 * @property {string} [category]
 * @property {string} subject
 * @property {string} [location]
 * @property {string} [cameraId]
 * @property {string} [lensId]
 * @property {string} [filmStock]
 * @property {boolean} digitized
 * @property {'S' | 'L'} [scanSize]
 * @property {string} [scanFile]
 * @property {string} [scanBlobId]
 * @property {string} [thumbBlobId]      JPEG preview of the scan (longest side 1280)
 * @property {'Clear' | 'Soft' | 'Out of focus'} [focus]
 * @property {'Under' | 'Good' | 'Over'} [exposure]
 * @property {string} [aperture]         'f/8' (from Shoot, or typed)
 * @property {string} [shutter]          '1/125'
 * @property {number} [ev]               metered EV at the film speed used, one decimal
 * @property {'Average' | 'Spot' | 'Estimate' | 'Typed'} [meterMode]
 * @property {string} [notes]
 * @property {'None' | 'Edit'} action
 * @property {boolean} actionComplete
 * @property {string} [editedFile]
 * @property {string} [editBlobId]
 * @property {string} [editThumbBlobId]  JPEG preview of the edit
 * @property {1 | 2 | 3 | 4 | 5} [rating]
 * @property {Tri} social
 * @property {Tri} print
 * @property {boolean} printed
 * @property {string} [storageLocation]  overrides the roll's if set
 * @property {boolean} posted
 * @property {string} [postedAt]
 * @property {string} [caption]
 * @property {boolean} [liked]          Feed, local only
 * @property {boolean} [saved]          Feed, local only
 * @property {'draft' | 'catalogued'} status
 * @property {string} [shotId]           the Shoot log entry it was synced from
 * @property {string} [refThumbBlobId]   that shot's reference photo (shown until a scan is attached)
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} ShotLog
 * @property {string} id
 * @property {string} rollId
 * @property {number} shotNumber
 * @property {string} takenAt
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {string} [placeName]
 * @property {string} lensId
 * @property {string} [aperture]
 * @property {string} [shutter]          '1/125', 'B'
 * @property {{ ev: number, iso: number, mode: 'Average' | 'Spot' | 'Estimate' | 'Typed', source: 'photo' | 'light' | 'typed' }} [meter]  from the Meter screen
 * @property {string} [light]
 * @property {string} [filter]
 * @property {string} [category]
 * @property {{ items: string[], role?: string, setup?: string }} [lighting]
 * @property {string} [note]
 * @property {string} [refPhotoBlobId]
 * @property {string} [refThumbBlobId]   JPEG preview of the reference photo
 * @property {string} [syncedNegativeId]  the draft negative made from this shot
 * @property {string} [syncedNegativeId]
 */

/** @typedef {{ id: string, name: string }} Camera */
/** @typedef {{ id: string, name: string, maxAperture?: number }} Lens */
/** @typedef {{ name: string, iso?: number, process?: 'bw' | 'colour' | 'slide', formats?: string[], custom?: boolean }} FilmStock */
/** @typedef {{ id: string, name: string }} LightingItem */

export const CATEGORIES = ['Street', 'Architecture', 'Portrait', 'Landscape'];
export const TRI = ['No', 'Maybe', 'Yes'];
export const FOCUS = ['Clear', 'Soft', 'Out of focus'];
export const EXPOSURE = ['Under', 'Good', 'Over'];
export const METER_MODES = ['Average', 'Spot', 'Estimate', 'Typed'];
export const ACTIONS = ['None', 'Edit'];
export const ROLL_STATUS = ['shooting', 'at_lab', 'developed', 'archived'];
export const LIGHT = ['Bright sun', 'Overcast', 'Shade', 'Golden hour', 'Indoor', 'Night'];
export const FILTERS = ['None', 'Yellow', 'Orange', 'Red', 'Green', 'ND', 'Polariser'];
export const LIGHTING_ROLES = ['Key', 'Fill', 'Rim / back', 'Bounce', 'Background'];

/** Turns a gear name into a stable id: 'Nikkor 24mm f/2' → 'nikkor-24mm-f-2'. */
export function slug(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** A negative with every required field set to its default. */
export function newNegative(fields) {
  const now = new Date().toISOString();
  return {
    subject: '',
    digitized: false,
    action: 'None',
    actionComplete: false,
    social: 'No',
    print: 'No',
    printed: false,
    posted: false,
    status: 'catalogued',
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

/** A roll with every required field set to its default. */
export function newRoll(fields) {
  return { filmStock: '', exposures: 36, status: 'developed', process: 'bw', format: '35mm', ...fields };
}
