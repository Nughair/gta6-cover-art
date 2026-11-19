// studio.js — Leonida Cover Works: a multi-panel GTA-style cover-art editor.
// One photo (or one per panel) is cropped into a poster layout, graded with
// real pixel operations (grades.js), captioned in bold condensed lettering,
// and exported as a PNG. Screenshot modes: ?shot=cover and ?shot=cover2 render
// a finished cover full-frame; no query opens the editor.

import { applyGrade, GRADES } from './grades.js';
import { LAYOUTS, defaultCrop } from './panels.js';

const GUTTER = 0.012; // normalised gutter between panels
const state = {
  layout: 'grid',
  grade: 'vice',
  caption: 'LEONIDA DREAMS',
  selected: 0,
  // Each panel: { img, ox, oy, zoom } — offsets are fractions of the overflow.
  panels: [],
};

function freshPanels(img) {
  return [0, 1, 2, 3].map((i) => ({ img, ...defaultCrop(i) }));
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Draw one panel: crop the panel's photo to the panel rect, grade the pixels
// on an offscreen canvas, then blit. Returns nothing; draws into ctx.
function drawPanel(ctx, panel, rect, W, H, gradeKey) {
  const px = Math.round(rect.x * W);
  const py = Math.round(rect.y * H);
  const pw = Math.round(rect.w * W);
  const ph = Math.round(rect.h * H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  ctx.fillStyle = '#17101f';
  ctx.fillRect(px, py, pw, ph);
  const img = panel.img;
  if (img) {
    // Cover-fit scale, enlarged by the panel zoom.
    const scale = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * panel.zoom;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    // Offset shifts the crop window within the overflow on each axis.
    const dx = px + (pw - dw) / 2 + panel.ox * (dw - pw);
    const dy = py + (ph - dh) / 2 + panel.oy * (dh - ph);
    const off = document.createElement('canvas');
    off.width = pw;
    off.height = ph;
    const octx = off.getContext('2d');
    octx.drawImage(img, dx - px, dy - py, dw, dh);
    if (gradeKey !== 'none') {
      const data = octx.getImageData(0, 0, pw, ph);
      applyGrade(data, gradeKey);
      octx.putImageData(data, 0, 0);
    }
    ctx.drawImage(off, px, py);
  }
  ctx.restore();
  // Thin keyline so panels read as separate poster cells.
  ctx.strokeStyle = 'rgba(10, 6, 18, 0.85)';
  ctx.lineWidth = Math.max(2, W * 0.002);
  ctx.strokeRect(px, py, pw, ph);
}

// The caption: bold condensed capitals, white fill with a soft warm tint, a
// heavy dark stroke, sitting on a scrim band at the foot of the cover.
function drawCaption(ctx, W, H, caption) {
  const text = (caption || '').trim().toUpperCase();
  if (!text) return;
  const bandH = H * 0.17;
  const grad = ctx.createLinearGradient(0, H - bandH, 0, H);
  grad.addColorStop(0, 'rgba(8, 4, 16, 0)');
  grad.addColorStop(1, 'rgba(8, 4, 16, 0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - bandH, W, bandH);
  let size = H * 0.105;
  const setFont = () => {
    ctx.font = `900 ${size}px "Arial Narrow", Impact, "Franklin Gothic Medium", sans-serif`;
  };
  setFont();
  try { ctx.letterSpacing = `${size * 0.04}px`; } catch { /* older engines */ }
  while (ctx.measureText(text).width > W * 0.92 && size > 14) {
    size -= 2;
    setFont();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#12041f';
  ctx.lineWidth = size * 0.16;
  const y = H - H * 0.045;
  ctx.strokeText(text, W / 2, y);
  const fill = ctx.createLinearGradient(0, y - size, 0, y);
  fill.addColorStop(0, '#fff7e0');
  fill.addColorStop(1, '#ffd166');
  ctx.fillStyle = fill;
  ctx.fillText(text, W / 2, y);
}

// Render the whole cover into ctx at W×H. When `forEditor` is true the
// selected panel gets a bright outline.
export function renderCover(ctx, W, H, forEditor) {
  ctx.fillStyle = '#0d0916';
  ctx.fillRect(0, 0, W, H);
  const rects = LAYOUTS[state.layout].panels(GUTTER);
  rects.forEach((rect, i) => {
    if (state.panels[i]) drawPanel(ctx, state.panels[i], rect, W, H, state.grade);
  });
  drawCaption(ctx, W, H, state.caption);
  if (forEditor) {
    const rect = rects[state.selected];
    if (rect) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = Math.max(3, W * 0.005);
      ctx.strokeRect(rect.x * W, rect.y * H, rect.w * W, rect.h * H);
    }
  }
}

// ---- Editor wiring -------------------------------------------------------

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function redraw() {
  renderCover(ctx, canvas.width, canvas.height, true);
}

function panelIndexAt(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  const nx = (cx - rect.left) / rect.width;
  const ny = (cy - rect.top) / rect.height;
  const rects = LAYOUTS[state.layout].panels(GUTTER);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (nx >= r.x && nx <= r.x + r.w && ny >= r.y && ny <= r.y + r.h) return i;
  }
  return -1;
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function syncZoomSlider() {
  const slider = document.getElementById('zoom');
  const panel = state.panels[state.selected];
  if (slider && panel) slider.value = String(panel.zoom);
}

function wireEditor() {
  const captionInput = document.getElementById('caption');
  captionInput.addEventListener('input', () => {
    state.caption = captionInput.value;
    redraw();
  });

  document.querySelectorAll('[data-layout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.layout = btn.dataset.layout;
      document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b === btn));
      redraw();
    });
  });
  document.querySelectorAll('[data-grade]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.grade = btn.dataset.grade;
      document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b === btn));
      redraw();
    });
  });
  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const img = await loadImage(`samples/${btn.dataset.sample}.jpg`);
      state.panels[state.selected].img = img;
      setStatus(`Loaded the ${btn.dataset.sample} photo into panel ${state.selected + 1}.`);
      redraw();
    });
  });

  document.getElementById('photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await loadImage(URL.createObjectURL(file));
    state.panels[state.selected].img = img;
    setStatus(`Your photo is in panel ${state.selected + 1}. Click another panel to place a different one.`);
    redraw();
  });

  document.getElementById('zoom').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    redraw();
  });

  // Click selects a panel; dragging repositions that panel's photo.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const idx = panelIndexAt(e.clientX, e.clientY);
    if (idx === -1) return;
    state.selected = idx;
    syncZoomSlider();
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const panel = state.panels[state.selected];
    panel.ox += (e.clientX - drag.x) / rect.width * 1.6;
    panel.oy += (e.clientY - drag.y) / rect.height * 1.6;
    panel.ox = Math.max(-0.6, Math.min(0.6, panel.ox));
    panel.oy = Math.max(-0.6, Math.min(0.6, panel.oy));
    drag = { x: e.clientX, y: e.clientY };
    redraw();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });

  document.querySelectorAll('[data-export]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [w, h] = btn.dataset.export.split('x').map(Number);
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      renderCover(off.getContext('2d'), w, h, false);
      off.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `leonida-cover-${w}x${h}.png`;
        a.click();
        setStatus(`Saved leonida-cover-${w}x${h}.png`);
      }, 'image/png');
    });
  });
}

// ---- Boot: editor or screenshot scene ------------------------------------

const params = new URLSearchParams(location.search);
const shot = params.get('shot');

async function boot() {
  if (shot === 'cover' || shot === 'cover2') {
    document.body.classList.add('shot');
    // Full-frame cover: the canvas becomes exactly the window.
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (shot === 'cover') {
      state.layout = 'grid';
      state.grade = 'vice';
      state.caption = 'LEONIDA DREAMS';
      state.panels = freshPanels(await loadImage('samples/pier.jpg'));
    } else {
      state.layout = 'hero';
      state.grade = 'neon';
      state.caption = 'NEON COAST';
      state.panels = freshPanels(await loadImage('samples/boulevard.jpg'));
    }
    renderCover(ctx, canvas.width, canvas.height, false);
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
    return;
  }
  // Editor: preload the pier sample into every panel.
  state.panels = freshPanels(await loadImage('samples/pier.jpg'));
  syncZoomSlider();
  wireEditor();
  redraw();
}

boot();
