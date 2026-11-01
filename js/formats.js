// Film formats: 35mm and medium format (120). Sets exposures, frames per strip (how labs cut
// the film), the frame shape on the strip (film runs left to right), and how many strips fit
// on one PDF contact sheet page (A4 or Letter).

export const FORMATS = {
  '35mm': { label: '35mm', exposures: [36, 24, 12] },
  120: { label: 'Medium format (120)' },
};

export const FRAME_SIZES = {
  '6x4.5': { label: '6×4.5', exposures: 16, perStrip: 4, aspect: '3 / 4', stripsPerPage: 3 }, // 41.5 × 56 mm, upright on the strip
  '6x6': { label: '6×6', exposures: 12, perStrip: 3, aspect: '1 / 1', stripsPerPage: 3 },
  '6x7': { label: '6×7', exposures: 10, perStrip: 3, aspect: '5 / 4', stripsPerPage: 3 }, // about 70 × 56 mm
  '6x9': { label: '6×9', exposures: 8, perStrip: 2, aspect: '3 / 2', stripsPerPage: 3 },
};

const DEFAULT_LAYOUT = { perStrip: 6, aspect: '3 / 2', stripsPerPage: 8 };

export const is120 = (roll) => roll?.format === '120';

/** Frames per strip, frame shape and strips per PDF page for a roll (35mm when not set). */
export function frameLayout(roll) {
  const size = is120(roll) ? FRAME_SIZES[roll.frameSize] : undefined;
  return size ? { perStrip: size.perStrip, aspect: size.aspect, stripsPerPage: size.stripsPerPage } : DEFAULT_LAYOUT;
}

/** Exposure choices for a format and frame size; the first is the usual one. */
export function exposureChoices(format, frameSize) {
  if (format !== '120') return FORMATS['35mm'].exposures;
  const usual = FRAME_SIZES[frameSize]?.exposures || 12;
  return [...new Set([usual, 16, 15, 12, 10, 8])];
}

/** '120 · 6×6' for medium format, '' for 35mm (the default, not shown). */
export const formatText = (roll) => (is120(roll) ? `120 · ${FRAME_SIZES[roll.frameSize]?.label || ''}`.replace(/ · $/, '') : '');
