# Leonida Cover Works

A cover-art studio for make.fun's **gta6-cover-art-01** bounty: drop in a
photo, and walk out with multi-panel, GTA-style cover art as a shareable
PNG — bold display lettering, leaning panel dividers, and a Vice City
sunset or neon colour grade, in an original design with no borrowed
artwork, logos or fonts.

## The app

`app/` is a plain static site with no build step. Serve it with any static
file server (or run `node serve.ts` and open http://localhost:8080) and it
works fully offline in a desktop browser; photos are read on the maker's
own machine and never uploaded anywhere.

- **Five panel layouts** — Vice Grid, Triptych, Hero & Strips, Shards and
  Magazine — drawn as angled polygons, never polite rectangles.
- **Any photo, every panel** — load several photos, give each panel its
  own, spread one photo across them all, drag to re-frame and scroll to
  zoom, per panel.
- **Five colour grades** — Vice Sunset, Neon Nights, Golden Hour, Poster
  Ink (with a halftone dot screen) and Chrome Noir — gradient-map LUTs
  with a strength slider and optional per-panel overrides.
- **Lettering** — the title and caption are set in Anton (SIL Open Font
  License, shipped as a file under `app/fonts/` with its license),
  auto-fitted, stroked and leaned forward the way poster type should be.
- **One-click export** — PNG at 1080×1080, 1080×1350 or 1920×1080. The
  grade is baked into a cached copy of each photo first, so export stays
  fast even at full banner size.

The four photos under `app/samples/` were made with an image model for
this entry and are free to use; they preload as a demo reel so the studio
shows itself working the moment it opens.

## Handing it in

`main.ts` (Node 22, standard library only) copies `app/` and
`screenshots/` to the output directory and writes `dossier.json` with
`buildDossier` from `vendor/makefun-app.ts`, the kit's library, unchanged.
Running it twice produces identical bytes.

## Screenshots

`screenshots/` holds the entry's screenshots in order: an exported wide
cover, the studio at work with a photo loaded, an exported portrait
cover, and a second studio view in another layout and grade.

## License

MIT — see `LICENSE`. The Anton font is under the SIL Open Font License
1.1 — see `app/fonts/OFL.txt`.
