// render.js — paints a finished Leonida cover onto any canvas.
//
// One pure function, renderCover(ctx, state, photos, width, height), backs
// both the live editor preview and the PNG export, so what the maker sees
// is byte-for-byte the art they download. Photos are drawn cover-fit into
// each panel's bounding box and clipped by the panel polygon; the colour
// grade is baked into a cached copy of each photo first (see grades.js),
// which keeps a full 1920x1080 export quick.

import { layoutById, panelBounds, tracePanelPath } from './panels.js';
import { gradeById, gradedPhotoCanvas, drawGrain, drawHalftone } from './grades.js';

export const POST_SIZES = [
  { id: 'square', name: 'Square post', width: 1080, height: 1080 },
  { id: 'portrait', name: 'Portrait post', width: 1080, height: 1350 },
  { id: 'wide', name: 'Wide banner', width: 1920, height: 1080 },
];

export function sizeById(id) {
  return POST_SIZES.find((size) => size.id === id) || POST_SIZES[0];
}

const INK = '#0d0a12';
const PAPER = '#f7efdd';

// Draw one panel: clip to its polygon, then blit the graded photo so it
// covers the panel box, centred on the maker's chosen focal point.
function drawPanelPhoto(ctx, panel, placement, photos, width, height) {
  const bounds = panelBounds(panel);
  const boxW = bounds.width * width;
  const boxH = bounds.height * height;
  const boxX = bounds.minX * width;
  const boxY = bounds.minY * height;

  ctx.save();
  tracePanelPath(ctx, panel, width, height);
  ctx.clip();

  const photo = photos[placement.photo];
  if (!photo) {
    const empty = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
    empty.addColorStop(0, '#2a1a3e');
    empty.addColorStop(1, '#0e2a3a');
    ctx.fillStyle = empty;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.restore();
    return;
  }

  const graded = gradedPhotoCanvas(photo, placement.gradeRef, placement.gradeStrength);
  const fit = Math.max(boxW / graded.width, boxH / graded.height) * placement.zoom;
  const drawW = graded.width * fit;
  const drawH = graded.height * fit;
  const drawX = boxX + placement.cx * boxW - drawW / 2;
  const drawY = boxY + placement.cy * boxH - drawH / 2;
  ctx.drawImage(graded, drawX, drawY, drawW, drawH);
  ctx.restore();
}

// The poster's skeleton: dark seams under a paper-light core line, the way
// the classic multi-panel covers separate their scenes.
function drawDividers(ctx, layout, width, height) {
  const seam = Math.max(5, width * 0.0075);
  ctx.save();
  ctx.lineJoin = 'round';
  for (const panel of layout.panels) {
    tracePanelPath(ctx, panel, width, height);
    ctx.strokeStyle = INK;
    ctx.lineWidth = seam;
    ctx.stroke();
  }
  for (const panel of layout.panels) {
    tracePanelPath(ctx, panel, width, height);
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = seam * 0.38;
    ctx.stroke();
  }
  ctx.restore();
}

function drawFrame(ctx, width, height) {
  const band = Math.max(10, width * 0.014);
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = band;
  ctx.strokeRect(band / 2, band / 2, width - band, height - band);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = band * 0.3;
  const inset = band * 1.15;
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  ctx.restore();
}

// Fit the display face to the cover: shrink the font until the title fits
// its line, so a long caption never spills off the poster.
function fitFontSize(ctx, text, family, weight, maxWidth, startSize) {
  let size = startSize;
  while (size > 12) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  }
  return size;
}

// The lettering: a heavy stroked title with a warm gradient fill and a
// slight forward lean, a caption strip beneath it, and a rotated sticker
// badge in the corner — the three marks that make a photo read as a cover.
function drawLettering(ctx, state, grade, width, height) {
  const title = (state.title || '').trim();
  const caption = (state.caption || '').trim();
  if (!title && !caption) return;

  const atTop = state.titlePos !== 'bottom';
  const margin = width * 0.055;
  const bandH = height * (title && caption ? 0.30 : 0.20);
  const bandY = atTop ? 0 : height - bandH;

  ctx.save();
  const scrim = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (atTop) {
    scrim.addColorStop(0, 'rgba(8, 4, 16, 0.55)');
    scrim.addColorStop(1, 'rgba(8, 4, 16, 0)');
  } else {
    scrim.addColorStop(0, 'rgba(8, 4, 16, 0)');
    scrim.addColorStop(1, 'rgba(8, 4, 16, 0.55)');
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY, width, bandH);

  const centreX = width / 2;
  let cursorY = atTop ? margin + height * 0.02 : height - margin - height * 0.02;

  if (caption) {
    ctx.textAlign = 'center';
    ctx.textBaseline = atTop ? 'top' : 'bottom';
    const capSize = fitFontSize(ctx, caption, 'Anton, sans-serif', '400', width * 0.8, height * 0.052);
    ctx.font = `400 ${capSize}px Anton, sans-serif`;
    ctx.fillStyle = grade.accent;
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = capSize * 0.18;
    ctx.shadowOffsetY = capSize * 0.06;
    const capY = atTop ? cursorY : cursorY;
    ctx.fillText(caption.toUpperCase(), centreX, capY);
    cursorY = atTop ? capY + capSize * 1.25 : capY - capSize * 1.25;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  if (title) {
    ctx.textAlign = 'center';
    ctx.textBaseline = atTop ? 'top' : 'bottom';
    const titleSize = fitFontSize(ctx, title.toUpperCase(), 'Anton, sans-serif', '400', width * 0.88, height * 0.17);
    ctx.font = `400 ${titleSize}px Anton, sans-serif`;
    ctx.save();
    ctx.translate(centreX, cursorY);
    ctx.transform(1, 0, -0.06, 1, 0, 0); // the forward lean
    const fill = ctx.createLinearGradient(0, atTop ? 0 : -titleSize, 0, atTop ? titleSize : 0);
    fill.addColorStop(0, '#fff8ea');
    fill.addColorStop(0.55, '#ffd98a');
    fill.addColorStop(1, '#ff7a3c');
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = titleSize * 0.16;
    const y = atTop ? 0 : -titleSize;
    ctx.strokeText(title.toUpperCase(), 0, y + (atTop ? titleSize * 0.82 : titleSize * 0.82));
    ctx.fillStyle = fill;
    ctx.fillText(title.toUpperCase(), 0, y + (atTop ? titleSize * 0.82 : titleSize * 0.82));
    ctx.restore();
  }
  ctx.restore();

  drawSticker(ctx, grade, width, height, atTop);
}

// A small rotated badge, the poster's seal: studio name and year, set in
// the grade's accent colour.
function drawSticker(ctx, grade, width, height, titleAtTop) {
  const label = 'LEONIDA COVER WORKS';
  ctx.save();
  const size = height * 0.034;
  ctx.font = `400 ${size}px Anton, sans-serif`;
  const w = ctx.measureText(label).width + size * 1.6;
  const h = size * 2.0;
  const x = width - w - width * 0.045;
  const y = titleAtTop ? height - h - height * 0.045 : height * 0.045;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.07);
  ctx.fillStyle = grade.accent;
  ctx.strokeStyle = INK;
  ctx.lineWidth = size * 0.14;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.28);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, size * 0.05);
  ctx.restore();
}

// Paint the whole cover. `placements` are the editor's per-panel states,
// resolved against the layout so a panel can override the global grade.
export function renderCover(ctx, state, photos, width, height) {
  const layout = layoutById(state.layoutId);
  const grade = gradeById(state.gradeId);

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, width, height);

  layout.panels.forEach((panel, index) => {
    const placement = state.panels[index] || { photo: -1, cx: 0.5, cy: 0.5, zoom: 1, grade: '' };
    const panelGrade = placement.grade ? gradeById(placement.grade) : grade;
    drawPanelPhoto(ctx, panel, {
      photo: placement.photo,
      cx: placement.cx,
      cy: placement.cy,
      zoom: placement.zoom,
      gradeRef: panelGrade,
      gradeStrength: state.gradeStrength,
    }, photos, width, height);
  });

  drawDividers(ctx, layout, width, height);
  drawFrame(ctx, width, height);

  if (grade.finish === 'halftone') drawHalftone(ctx, width, height, Math.max(5, width / 150));
  drawGrain(ctx, width, height, 0.05);

  drawLettering(ctx, state, grade, width, height);
  ctx.restore();
}

// Render a cover offscreen at a post size and hand back the canvas.
export function renderCoverCanvas(state, photos, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  renderCover(canvas.getContext('2d'), state, photos, size.width, size.height);
  return canvas;
}

// The one-click path from photo to shareable PNG: render at the chosen
// post size and download it.
export function exportCoverPNG(state, photos, size) {
  const canvas = renderCoverCanvas(state, photos, size);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leonida-cover-${size.width}x${size.height}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}
