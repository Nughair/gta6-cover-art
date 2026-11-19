// panels.js — the five multi-panel poster layouts of Leonida Cover Works.
//
// Every layout is a list of panels in normalised cover space: x grows to the
// right, y grows downward, both run 0..1, and each panel is a polygon of
// [x, y] points. Because the geometry is normalised, the same layout renders
// untouched into a square post, a portrait post or a wide banner — only the
// canvas it is scaled into changes. The angled cuts are deliberate: GTA-style
// covers never slice a poster into polite rectangles, the dividers lean.

export const LAYOUTS = [
  {
    id: 'vice-grid',
    name: 'Vice Grid',
    blurb: 'The classic four-panel grid with leaning dividers',
    panels: [
      { points: [[0, 0], [0.52, 0], [0.46, 0.52], [0, 0.55]] },
      { points: [[0.52, 0], [1, 0], [1, 0.48], [0.46, 0.52]] },
      { points: [[0, 0.55], [0.46, 0.52], [0.54, 1], [0, 1]] },
      { points: [[0.46, 0.52], [1, 0.48], [1, 1], [0.54, 1]] },
    ],
  },
  {
    id: 'triptych',
    name: 'Triptych',
    blurb: 'Three tall shards, cut on the diagonal',
    panels: [
      { points: [[0, 0], [0.38, 0], [0.30, 1], [0, 1]] },
      { points: [[0.38, 0], [0.68, 0], [0.62, 1], [0.30, 1]] },
      { points: [[0.68, 0], [1, 0], [1, 1], [0.62, 1]] },
    ],
  },
  {
    id: 'hero-strip',
    name: 'Hero & Strips',
    blurb: 'One wide hero scene over three story strips',
    panels: [
      { points: [[0, 0], [1, 0], [1, 0.58], [0, 0.62]] },
      { points: [[0, 0.62], [0.34, 0.60], [0.36, 1], [0, 1]] },
      { points: [[0.34, 0.60], [0.67, 0.585], [0.68, 1], [0.36, 1]] },
      { points: [[0.67, 0.585], [1, 0.58], [1, 1], [0.68, 1]] },
    ],
  },
  {
    id: 'shards',
    name: 'Shards',
    blurb: 'Four diagonal slices, like glass after a joyride',
    panels: [
      { points: [[0, 0], [0.42, 0], [0.18, 1], [0, 1]] },
      { points: [[0.42, 0], [0.66, 0], [0.44, 1], [0.18, 1]] },
      { points: [[0.66, 0], [0.86, 0], [0.68, 1], [0.44, 1]] },
      { points: [[0.86, 0], [1, 0], [1, 1], [0.68, 1]] },
    ],
  },
  {
    id: 'magazine',
    name: 'Magazine',
    blurb: 'A single full-bleed scene with a masthead title',
    panels: [
      { points: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    ],
  },
];

export function layoutById(id) {
  return LAYOUTS.find((layout) => layout.id === id) || LAYOUTS[0];
}

// The axis-aligned box a panel's photo is fitted into before the polygon
// clips it: cover-fit works on boxes, the polygon only decides what shows.
export function panelBounds(panel) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const [x, y] of panel.points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// Path a panel's polygon onto a context already scaled to cover pixels.
export function tracePanelPath(ctx, panel, width, height) {
  ctx.beginPath();
  panel.points.forEach(([x, y], index) => {
    const px = x * width;
    const py = y * height;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

// Hit test for the editor: which panel did the user grab? Points are in
// normalised cover space; a winding fill test over each polygon in order.
export function panelAtPoint(layout, nx, ny) {
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    const pts = layout.panels[i].points;
    let inside = false;
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
      const [ax, ay] = pts[a];
      const [bx, by] = pts[b];
      const crosses = (ay > ny) !== (by > ny);
      if (crosses && nx < ((bx - ax) * (ny - ay)) / (by - ay) + ax) inside = !inside;
    }
    if (inside) return i;
  }
  return -1;
}

// Fresh per-panel placement state for a layout: every panel starts centred
// on its own photo (spread by index) at natural cover-fit zoom.
export function defaultPanelStates(layout, photoCount) {
  return layout.panels.map((_, index) => ({
    photo: photoCount > 0 ? index % photoCount : -1,
    cx: 0.5,
    cy: 0.5,
    zoom: 1,
    grade: '',
  }));
}
