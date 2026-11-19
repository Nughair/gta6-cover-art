// grades.js — colour grades for Leonida Cover Works.
// Every grade is a real per-pixel operation over ImageData: nothing here is a
// CSS filter or a translucent overlay. Each grade maps a pixel (r,g,b) to a
// new pixel, so the exported PNG carries the grade baked in.

// Interpolate between two [r,g,b] stops.
function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// Three-stop gradient map driven by luminance: shadows -> mid -> highlight.
function gradientMap(r, g, b, shadow, mid, high) {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const c = lum < 0.5
    ? mix(shadow, mid, lum * 2)
    : mix(mid, high, (lum - 0.5) * 2);
  return c;
}

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// "Vice Sunset": a duotone gradient map — inky violet shadows melt through
// hot magenta mids into a pale gold highlight, like a posterised sunset.
function viceSunset(r, g, b) {
  const [nr, ng, nb] = gradientMap(r, g, b, [38, 10, 66], [255, 46, 136], [255, 214, 130]);
  // Keep a whisper of the original chroma so faces and cars stay readable.
  return [nr * 0.82 + r * 0.18, ng * 0.82 + g * 0.18, nb * 0.82 + b * 0.18];
}

// "Neon Nights": teal-leaning shadows, magenta highlights, punchy contrast
// and a saturation push — wet asphalt under club signs.
function neonNights(r, g, b) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // S-curve contrast around the pixel's own luminance.
  const t = lum / 255;
  const curved = (t * t * (3 - 2 * t)) * 255;
  const k = lum > 1 ? curved / lum : 1;
  let nr = r * k, ng = g * k, nb = b * k;
  // Saturation push away from grey. (Strengthened in the revision pass: at
  // 1.35 the grade read as a warm tint in screenshots, not a night grade.)
  const grey = (nr + ng + nb) / 3;
  nr = grey + (nr - grey) * 1.55;
  ng = grey + (ng - grey) * 1.55;
  nb = grey + (nb - grey) * 1.55;
  // Split tone: shadows toward teal, highlights toward magenta.
  const shadowAmt = 1 - t;
  nr += 34 * t - 10 * shadowAmt;
  ng += 18 * shadowAmt;
  nb += 44 * shadowAmt + 26 * t;
  return [nr, ng, nb];
}

// "Golden Hour": warm amber lift, gentle highlight bloom and softened blues —
// late sun over the causeway.
function goldenHour(r, g, b) {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const warmth = 0.35 + 0.65 * lum;
  let nr = r * (1 + 0.22 * warmth) + 14 * (1 - lum);
  let ng = g * (1 + 0.06 * warmth) + 4 * (1 - lum);
  let nb = b * (1 - 0.16 * warmth);
  // Soft highlight roll-off so skies do not clip to white.
  if (nr > 235) nr = 235 + (nr - 235) * 0.4;
  if (ng > 235) ng = 235 + (ng - 235) * 0.4;
  return [nr, ng, nb];
}

export const GRADES = {
  none: { label: 'Original', apply: null },
  vice: { label: 'Vice Sunset', apply: viceSunset },
  neon: { label: 'Neon Nights', apply: neonNights },
  golden: { label: 'Golden Hour', apply: goldenHour },
};

// Apply a grade, in place, to an ImageData buffer. No-op for 'none'.
export function applyGrade(imageData, gradeKey) {
  const grade = GRADES[gradeKey];
  if (!grade || !grade.apply) return imageData;
  const d = imageData.data;
  const fn = grade.apply;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = fn(d[i], d[i + 1], d[i + 2]);
    d[i] = clamp(r);
    d[i + 1] = clamp(g);
    d[i + 2] = clamp(b);
  }
  return imageData;
}
