// main.js — the page's entry module: boot the studio once the document
// and the Anton display face are ready, so the first preview already
// carries the real lettering.

import { bootStudio } from './editor.js';

async function start() {
  try {
    await document.fonts.load('400 80px Anton');
  } catch {
    // The face is a local file; if it somehow fails, the studio still
    // boots and the lettering falls back to a heavy sans.
  }
  await bootStudio();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
