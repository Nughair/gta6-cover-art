// editor.js — the studio floor of Leonida Cover Works.
//
// Owns the maker's state (which layout, which grade, what each panel
// holds and where its photo sits), loads photos from the maker's machine
// or from the built-in demo reel, and wires every control on the page to
// the renderer. The preview canvas and the exported PNG come from the
// same renderCover call, so the poster never changes between the two.

import { LAYOUTS, layoutById, panelAtPoint, defaultPanelStates } from './panels.js';
import { GRADES, gradeById, clearGradeCache } from './grades.js';
import { POST_SIZES, sizeById, renderCover, exportCoverPNG } from './render.js';

const SAMPLE_PHOTOS = [
  { src: 'samples/neon-rider.jpg', name: 'Neon Rider (demo)' },
  { src: 'samples/pier-dusk.jpg', name: 'Pier at Dusk (demo)' },
  { src: 'samples/boulevard.jpg', name: 'The Boulevard (demo)' },
  { src: 'samples/rooftop-neon.jpg', name: 'Rooftop Neon (demo)' },
];

export const state = {
  layoutId: 'vice-grid',
  gradeId: 'vice-sunset',
  gradeStrength: 0.9,
  title: 'LEONIDA NIGHTS',
  caption: 'One city. No rules.',
  titlePos: 'top',
  sizeId: 'wide',
  panels: [],
  selected: 0,
};

export const photos = [];

const els = {};
let previewCtx = null;
let redrawQueued = false;

function currentLayout() {
  return layoutById(state.layoutId);
}

function syncPanelCount() {
  const layout = currentLayout();
  const fresh = defaultPanelStates(layout, photos.length);
  state.panels = layout.panels.map((_, i) => {
    const old = state.panels[i];
    if (!old) return fresh[i];
    return {
      photo: old.photo < 0 || old.photo >= photos.length ? fresh[i].photo : old.photo,
      cx: old.cx, cy: old.cy, zoom: old.zoom, grade: old.grade,
    };
  });
  if (state.selected >= state.panels.length) state.selected = 0;
}

// --- photo loading -------------------------------------------------------

function loadPhotoFromURL(src, name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ img, name });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function loadPhotoFromFile(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, name: file.name });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function addPhotos(newPhotos, assignToSelected = true) {
  for (const photo of newPhotos) {
    if (photo) photos.push(photo);
  }
  clearGradeCache();
  if (assignToSelected && photos.length > 0) {
    const panel = state.panels[state.selected];
    if (panel) panel.photo = photos.length - 1;
  }
  syncPanelCount();
  buildPhotoTray();
  refreshPanelControls();
  queueRedraw();
}

// --- preview -------------------------------------------------------------

function queueRedraw() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    drawPreview();
  });
}

function drawPreview() {
  const canvas = els.preview;
  if (!canvas || !previewCtx) return;
  const size = sizeById(state.sizeId);
  const box = canvas.getBoundingClientRect();
  const scale = Math.min(box.width / size.width, box.height / size.height);
  const w = Math.max(50, Math.round(size.width * scale));
  const h = Math.max(50, Math.round(size.height * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  renderCover(previewCtx, state, photos, w, h);
  drawSelectionOutline(w, h);
}

function drawSelectionOutline(w, h) {
  const layout = currentLayout();
  const panel = layout.panels[state.selected];
  if (!panel) return;
  const ctx = previewCtx;
  ctx.save();
  ctx.beginPath();
  panel.points.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x * w, y * h);
    else ctx.lineTo(x * w, y * h);
  });
  ctx.closePath();
  ctx.strokeStyle = '#ffd23c';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 7]);
  ctx.stroke();
  ctx.restore();
}

// Pointer work on the preview: tap selects a panel, drag re-frames its
// photo, the wheel zooms into it. Positions are tracked in normalised
// cover space so the gesture feels the same at any preview size.
function wirePreviewGestures() {
  const canvas = els.preview;
  let drag = null;

  const toCover = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  canvas.addEventListener('pointerdown', (event) => {
    const p = toCover(event);
    const hit = panelAtPoint(currentLayout(), p.x, p.y);
    if (hit >= 0) {
      state.selected = hit;
      refreshPanelControls();
    }
    drag = { x: p.x, y: p.y };
    canvas.setPointerCapture(event.pointerId);
    queueRedraw();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const p = toCover(event);
    const panel = state.panels[state.selected];
    if (panel && panel.photo >= 0) {
      panel.cx = clamp01(panel.cx + (drag.x - p.x));
      panel.cy = clamp01(panel.cy + (drag.y - p.y));
    }
    drag = { x: p.x, y: p.y };
    queueRedraw();
  });

  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const panel = state.panels[state.selected];
    if (!panel) return;
    const step = event.deltaY < 0 ? 1.06 : 0.94;
    panel.zoom = Math.max(0.4, Math.min(4, panel.zoom * step));
    syncZoomSlider();
    queueRedraw();
  }, { passive: false });
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// --- control builders ----------------------------------------------------

function buildSwatches(container, items, currentId, onPick) {
  container.innerHTML = '';
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch' + (item.id === currentId ? ' active' : '');
    button.dataset.id = item.id;
    button.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'swatch-name';
    label.textContent = item.name;
    button.appendChild(label);
    if (item.stops) {
      const strip = document.createElement('span');
      strip.className = 'swatch-strip';
      strip.style.background = `linear-gradient(90deg, ${item.stops[0]}, ${item.stops[1]}, ${item.stops[2]})`;
      button.appendChild(strip);
    }
    if (item.blurb) button.title = item.blurb;
    button.addEventListener('click', () => onPick(item.id));
    container.appendChild(button);
  }
}

function markActiveSwatches(container, currentId) {
  container.querySelectorAll('.swatch').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === currentId);
  });
}

function buildPhotoTray() {
  const tray = els.photoTray;
  tray.innerHTML = '';
  photos.forEach((photo, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'photo-chip';
    chip.title = photo.name;
    const thumb = document.createElement('img');
    thumb.src = photo.img.src;
    thumb.alt = photo.name;
    chip.appendChild(thumb);
    chip.addEventListener('click', () => {
      const panel = state.panels[state.selected];
      if (panel) panel.photo = index;
      queueRedraw();
    });
    tray.appendChild(chip);
  });
}

function refreshPanelControls() {
  const panel = state.panels[state.selected];
  els.panelLabel.textContent = `Panel ${state.selected + 1} of ${state.panels.length}`;
  if (!panel) return;
  els.panelPhoto.innerHTML = '';
  photos.forEach((photo, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = photo.name;
    els.panelPhoto.appendChild(option);
  });
  els.panelPhoto.value = String(panel.photo);
  els.panelGrade.innerHTML = '';
  const follow = document.createElement('option');
  follow.value = '';
  follow.textContent = 'Follow global grade';
  els.panelGrade.appendChild(follow);
  for (const grade of GRADES) {
    const option = document.createElement('option');
    option.value = grade.id;
    option.textContent = grade.name;
    els.panelGrade.appendChild(option);
  }
  els.panelGrade.value = panel.grade;
  syncZoomSlider();
}

function syncZoomSlider() {
  const panel = state.panels[state.selected];
  if (panel) els.panelZoom.value = String(panel.zoom);
}

// --- wiring ---------------------------------------------------------------

function grabElements() {
  for (const id of [
    'preview', 'photoTray', 'photoInput', 'layoutSwatches', 'gradeSwatches',
    'gradeStrength', 'titleInput', 'captionInput', 'titlePos', 'sizeSelect',
    'panelLabel', 'panelPhoto', 'panelGrade', 'panelZoom', 'exportBtn',
    'fillAllBtn', 'shuffleBtn',
  ]) {
    els[id] = document.getElementById(id);
  }
}

function wireControls() {
  els.photoInput.addEventListener('change', async () => {
    const files = [...els.photoInput.files];
    els.photoInput.value = '';
    await addPhotos(await Promise.all(files.map(loadPhotoFromFile)));
  });

  els.fillAllBtn.addEventListener('click', () => {
    const panel = state.panels[state.selected];
    if (!panel || panel.photo < 0) return;
    for (const p of state.panels) p.photo = panel.photo;
    queueRedraw();
  });

  els.shuffleBtn.addEventListener('click', shuffleLook);

  buildSwatches(els.layoutSwatches, LAYOUTS, state.layoutId, (id) => {
    state.layoutId = id;
    syncPanelCount();
    markActiveSwatches(els.layoutSwatches, id);
    refreshPanelControls();
    queueRedraw();
  });

  buildSwatches(els.gradeSwatches, GRADES, state.gradeId, (id) => {
    state.gradeId = id;
    markActiveSwatches(els.gradeSwatches, id);
    queueRedraw();
  });

  els.gradeStrength.addEventListener('input', () => {
    state.gradeStrength = Number(els.gradeStrength.value);
    queueRedraw();
  });

  els.titleInput.addEventListener('input', () => {
    state.title = els.titleInput.value;
    queueRedraw();
  });
  els.captionInput.addEventListener('input', () => {
    state.caption = els.captionInput.value;
    queueRedraw();
  });
  els.titlePos.addEventListener('change', () => {
    state.titlePos = els.titlePos.value;
    queueRedraw();
  });
  els.sizeSelect.addEventListener('change', () => {
    state.sizeId = els.sizeSelect.value;
    queueRedraw();
  });

  els.panelPhoto.addEventListener('change', () => {
    const panel = state.panels[state.selected];
    if (panel) panel.photo = Number(els.panelPhoto.value);
    queueRedraw();
  });
  els.panelGrade.addEventListener('change', () => {
    const panel = state.panels[state.selected];
    if (panel) panel.grade = els.panelGrade.value;
    queueRedraw();
  });
  els.panelZoom.addEventListener('input', () => {
    const panel = state.panels[state.selected];
    if (panel) panel.zoom = Number(els.panelZoom.value);
    queueRedraw();
  });

  els.exportBtn.addEventListener('click', () => {
    exportCoverPNG(state, photos, sizeById(state.sizeId));
  });

  window.addEventListener('resize', queueRedraw);
}

// A one-click new look: cycle the layout and grade together and re-spread
// the photos, for makers who want the machine to surprise them.
function shuffleLook() {
  const layoutIndex = Math.floor(Math.random() * LAYOUTS.length);
  const gradeIndex = Math.floor(Math.random() * GRADES.length);
  state.layoutId = LAYOUTS[layoutIndex].id;
  state.gradeId = GRADES[gradeIndex].id;
  syncPanelCount();
  state.panels.forEach((panel, i) => {
    if (photos.length > 0) panel.photo = (i + gradeIndex) % photos.length;
  });
  markActiveSwatches(els.layoutSwatches, state.layoutId);
  markActiveSwatches(els.gradeSwatches, state.gradeId);
  refreshPanelControls();
  queueRedraw();
}

// --- boot ------------------------------------------------------------------

export async function bootStudio() {
  grabElements();
  previewCtx = els.preview.getContext('2d');
  els.titleInput.value = state.title;
  els.captionInput.value = state.caption;
  els.gradeStrength.value = String(state.gradeStrength);
  for (const size of POST_SIZES) {
    const option = document.createElement('option');
    option.value = size.id;
    option.textContent = `${size.name} · ${size.width}×${size.height}`;
    els.sizeSelect.appendChild(option);
  }
  els.sizeSelect.value = state.sizeId;

  syncPanelCount();
  wireControls();
  wirePreviewGestures();
  refreshPanelControls();
  queueRedraw();

  const loaded = await Promise.all(SAMPLE_PHOTOS.map((s) => loadPhotoFromURL(s.src, s.name)));
  await addPhotos(loaded, false);
  syncPanelCount();
  refreshPanelControls();
  queueRedraw();
}

// A small handle for scripted demos and screenshots: the same calls the
// page's own buttons make, nothing behind a curtain.
window.LCW = {
  state,
  photos,
  ready: () => document.fonts.ready,
  setLayout: (id) => {
    state.layoutId = id;
    syncPanelCount();
    markActiveSwatches(els.layoutSwatches, id);
    refreshPanelControls();
    queueRedraw();
  },
  setGrade: (id) => {
    state.gradeId = id;
    markActiveSwatches(els.gradeSwatches, id);
    queueRedraw();
  },
  setTitle: (title, caption) => {
    state.title = title;
    state.caption = caption;
    els.titleInput.value = title;
    els.captionInput.value = caption;
    queueRedraw();
  },
  exportPNG: (sizeId) => exportCoverPNG(state, photos, sizeById(sizeId || state.sizeId)),
};
