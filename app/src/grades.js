// grades.js — the colour grades that turn a plain photo into poster art.
//
// A grade is a gradient map: three stop colours (shadows, midtones,
// highlights). From them we build one 256-entry lookup table per channel, so
// grading a photo is a single fast pass over its pixels. Before the map we
// run a gentle contrast S-curve and a saturation push, because phone photos
// are flat and poster art is not. A strength slider blends the graded pixels
// back toward the original, and two finishes sit on top: a halftone dot
// screen for the printed-poster look and a fine deterministic grain.

export const GRADES = [
  {
    id: 'vice-sunset',
    name: 'Vice Sunset',
    stops: ['#2b1438', '#e0492f', '#ffd98a'],
    accent: '#ffb347',
    finish: 'grain',
  },
  {
    id: 'neon-nights',
    name: 'Neon Nights',
    stops: ['#101736', '#c22ba0', '#8dfcff'],
    accent: '#ff4fd8',
    finish: 'grain',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    stops: ['#33190a', '#d98a2b', '#fff3c4'],
    accent: '#ffc44d',
    finish: 'grain',
  },
  {
    id: 'poster-ink',
    name: 'Poster Ink',
    stops: ['#101613', '#1f7a6d', '#f4ecd8'],
    accent: '#2ec4a6',
    finish: 'halftone',
  },
  {
    id: 'chrome-noir',
    name: 'Chrome Noir',
    stops: ['#0a0a0a', '#767c83', '#ffffff'],
    accent: '#cfd6dd',
    finish: 'grain',
  },
];

export function gradeById(id) {
  return GRADES.find((grade) => grade.id === id) || GRADES[0];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Build one channel's ramp in two steps. First the full gradient map:
// shadows land on the shadow stop, midtones on the mid stop, highlights
// on the highlight stop. Then pull that map halfway back toward the
// identity line. The halfway pull is the whole trick — the colours lean
// unmistakably toward the grade, but no channel is ever dragged to zero,
// so shadow detail and faces survive. A final pass keeps the ramp
// monotonic so tones can never invert into false-colour bands.
function buildChannelRamp(shadow, mid, highlight) {
  const ramp = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let mapped;
    if (t < 0.5) {
      mapped = shadow + (mid - shadow) * (t * 2);
    } else {
      mapped = mid + (highlight - mid) * ((t - 0.5) * 2);
    }
    ramp[i] = Math.round(i * 0.5 + mapped * 0.5);
  }
  for (let i = 1; i < 256; i++) {
    if (ramp[i] < ramp[i - 1]) ramp[i] = ramp[i - 1];
  }
  return ramp;
}

export function buildGradeLUT(grade) {
  const [sr, sg, sb] = hexToRgb(grade.stops[0]);
  const [mr, mg, mb] = hexToRgb(grade.stops[1]);
  const [hr, hg, hb] = hexToRgb(grade.stops[2]);
  return {
    r: buildChannelRamp(sr, mr, hr),
    g: buildChannelRamp(sg, mg, hg),
    b: buildChannelRamp(sb, mb, hb),
  };
}

// Contrast S-curve around mid-grey; amount 0 leaves the value untouched.
// The result is rounded to an integer on purpose: it indexes the grade
// lookup tables, and a fractional index reads undefined from a typed
// array, which would silently zero the pixel.
function contrastCurve(value, amount) {
  const t = value / 255;
  const curved = t + amount * Math.sin((t - 0.5) * Math.PI) * 0.5;
  return Math.round(Math.max(0, Math.min(255, curved * 255)));
}

// Grade one ImageData in place. The ramp already carries the halfway pull
// toward the photo, so the strength slider simply cross-fades between the
// untouched photo (0) and the full grade (1).
export function applyGradeToPixels(imageData, grade, strength) {
  const lut = buildGradeLUT(grade);
  const data = imageData.data;
  const rampShare = strength;
  const keep = 1 - rampShare;
  for (let i = 0; i < data.length; i += 4) {
    const r0 = data[i], g0 = data[i + 1], b0 = data[i + 2];
    const grey = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
    const sat = 1.12;
    const r1 = contrastCurve(grey + (r0 - grey) * sat, 0.08);
    const g1 = contrastCurve(grey + (g0 - grey) * sat, 0.08);
    const b1 = contrastCurve(grey + (b0 - grey) * sat, 0.08);
    data[i]     = lut.r[r1] * rampShare + r0 * keep;
    data[i + 1] = lut.g[g1] * rampShare + g0 * keep;
    data[i + 2] = lut.b[b1] * rampShare + b0 * keep;
  }
  return imageData;
}

// Draw the graded copy of a photo once and cache it: panels then composite
// the cached canvas, which keeps both the live preview and the PNG export
// fast no matter how many panels share the photo.
const gradedCache = new Map();

export function gradedPhotoCanvas(photo, grade, strength) {
  const key = `${photo.name}|${grade.id}|${strength.toFixed(2)}`;
  const hit = gradedCache.get(key);
  if (hit) return hit;

  const source = photo.img;
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(source.naturalWidth, source.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (strength > 0.01) {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.putImageData(applyGradeToPixels(pixels, grade, strength), 0, 0);
  }
  gradedCache.set(key, canvas);
  return canvas;
}

export function clearGradeCache() {
  gradedCache.clear();
}

// Deterministic grain: a hash of the pixel position, so every render of the
// same cover is identical (the entry program must produce the same bytes on
// every run, and a cover should not shimmer between preview and export).
export function grainAlpha(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// Halftone dot screen, drawn as one translucent pass over the finished
// cover: dot radius follows the darkness under each cell, the way ink
// builds up on a printed poster.
export function drawHalftone(ctx, width, height, cell = 7) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 10, 10, 0.20)';
  for (let y = cell / 2; y < height; y += cell) {
    for (let x = cell / 2; x < width; x += cell) {
      const shade = grainAlpha(Math.round(x), Math.round(y));
      const radius = (cell * 0.34) * (0.35 + shade * 0.65);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Fine film grain over the finished cover: sparse light and dark specks.
export function drawGrain(ctx, width, height, amount = 0.05) {
  const step = Math.max(2, Math.round(width / 480));
  ctx.save();
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const v = grainAlpha(x, y);
      if (v > 0.82) {
        ctx.fillStyle = `rgba(255,255,255,${amount * (v - 0.82) * 4})`;
        ctx.fillRect(x, y, step, step);
      } else if (v < 0.18) {
        ctx.fillStyle = `rgba(0,0,0,${amount * (0.18 - v) * 4})`;
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  ctx.restore();
}
