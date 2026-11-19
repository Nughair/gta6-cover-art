// Leonida Cover Works — the hand-in program for gta6-cover-art-01.
//
// The app itself is the static site under app/ (open app/index.html in a
// desktop browser, it runs fully offline). This program is only the
// plumbing that hands the entry in: it copies app/ and screenshots/ into
// the output directory and writes dossier.json there with buildDossier
// from the kit's vendored library, so the gate can rebuild the very same
// dossier from the same files and compare the two byte for byte.
//
// Run it locally the way the grader does, twice if you like — the bytes
// must not change between runs:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const APP_TITLE = 'Leonida Cover Works';
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below are the scorer's own (reference/gate.json): at most 4
// screenshots of 256 KiB, at most 993 files and 48 MiB under app/, no app
// path over 1000 bytes, and the dossier's source text capped at 160 KiB.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`${APP_TITLE}: dossier written (${dossier.length} bytes) to ${outputDir}`);
