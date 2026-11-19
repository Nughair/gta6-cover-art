// panels.js — poster layouts for Leonida Cover Works.
// A layout is a list of panel rectangles in normalised cover coordinates
// (0..1 on both axes). The renderer multiplies by the real canvas size, so
// the same layout works for the editor preview and every export size.

// Classic 2x2 grid: four equal panels with a thin gutter between them.
function gridLayout(g) {
  const w = (1 - g) / 2;
  return [
    { x: 0, y: 0, w, h: w },
    { x: w + g, y: 0, w, h: w },
    { x: 0, y: w + g, w, h: w },
    { x: w + g, y: w + g, w, h: w },
  ];
}

// Hero-top: one wide cinematic panel over three vertical strips.
function heroLayout(g) {
  const heroH = 0.58;
  const stripW = (1 - g * 2) / 3;
  const stripH = 1 - heroH - g;
  const panels = [{ x: 0, y: 0, w: 1, h: heroH }];
  for (let i = 0; i < 3; i++) {
    panels.push({ x: i * (stripW + g), y: heroH + g, w: stripW, h: stripH });
  }
  return panels;
}

export const LAYOUTS = {
  grid: { label: 'Classic 2×2 Grid', panels: (gutter) => gridLayout(gutter) },
  hero: { label: 'Hero + Strips', panels: (gutter) => heroLayout(gutter) },
};

// Default crop for panel i: each panel starts zoomed a little and offset to a
// different part of the photo, so a single photo reads as a collage of scenes.
export function defaultCrop(i) {
  const crops = [
    // Panel 0 doubles as the hero panel in the hero layout: that slice is very
    // wide and short, so it keeps zoom near 1 and crops toward the top of the
    // photo (positive oy) to keep the subject's face in frame.
    { ox: 0, oy: 0.35, zoom: 1.02 },
    { ox: -0.18, oy: 0.05, zoom: 1.3 },
    { ox: 0.15, oy: -0.12, zoom: 1.25 },
    { ox: -0.05, oy: -0.2, zoom: 1.4 },
  ];
  return { ...crops[i % crops.length] };
}
