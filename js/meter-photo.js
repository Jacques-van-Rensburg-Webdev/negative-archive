// Brightness of a metering photo in linear light: a centre-weighted average and spot samples.
// A patch at 18 % linear is middle grey for the exposure the phone used, so a reading's EV is
// the photo's EV + log₂(linear ÷ 0.18). Spots near black or white are marked clipped.

const SIZE = 192; // longest side of the analysed copy
const MIDDLE_GREY = 0.18;
const SPOT = 0.025; // spot radius as a share of the photo's width (5 % circle)

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Linear luminance of every pixel of a small copy. */
async function pixels(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = SIZE / Math.max(bitmap.width, bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const { data } = context.getImageData(0, 0, width, height);
  const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i += 1) {
    const r = toLinear(data[i * 4] / 255);
    const g = toLinear(data[i * 4 + 1] / 255);
    const b = toLinear(data[i * 4 + 2] / 255);
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return { lum, width, height };
}

/** Centre-weighted mean: weight falls from 1 in the middle to 0.25 at the corners. */
function centreWeighted({ lum, width, height }) {
  let sum = 0;
  let weights = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x + 0.5) / width - 0.5;
      const dy = (y + 0.5) / height - 0.5;
      const w = 1 - 0.75 * Math.min(1, Math.hypot(dx, dy) / 0.7071);
      sum += lum[y * width + x] * w;
      weights += w;
    }
  }
  return sum / weights;
}

/** Mean of a circle at (x, y), both 0–1. clipped: most of it near black or white. */
function spotAt({ lum, width, height }, x, y) {
  const radius = Math.max(1, SPOT * width);
  const cx = x * width;
  const cy = y * height;
  let sum = 0;
  let count = 0;
  let extreme = 0;
  for (let py = Math.floor(cy - radius); py <= Math.ceil(cy + radius); py += 1) {
    for (let px = Math.floor(cx - radius); px <= Math.ceil(cx + radius); px += 1) {
      if (px < 0 || py < 0 || px >= width || py >= height || Math.hypot(px + 0.5 - cx, py + 0.5 - cy) > radius) continue;
      const value = lum[py * width + px];
      sum += value;
      count += 1;
      if (value < 0.002 || value > 0.93) extreme += 1;
    }
  }
  return { linear: Math.max(sum / Math.max(count, 1), 1e-4), clipped: extreme > count / 2 };
}

/**
 * Reads a photo: { width, height, average, spot(x, y) }. average and spot().linear are linear
 * luminance; stopsFromGrey(linear) gives the offset from middle grey in stops.
 */
export async function analysePhoto(file) {
  const image = await pixels(file);
  return {
    width: image.width,
    height: image.height,
    average: Math.max(centreWeighted(image), 1e-4),
    spot: (x, y) => spotAt(image, x, y),
  };
}

export const stopsFromGrey = (linear) => Math.log2(linear / MIDDLE_GREY);
