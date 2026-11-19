# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Nughair/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Nughair/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Leonida Cover Works** is a small, fully offline cover-art editor that turns
a photo into GTA-style multi-panel poster art, right in the browser. There is
no build step, no library and no network call: open the app, make a cover,
download the PNG.

What it does:

- **Two poster layouts** — a classic 2×2 grid, and a hero-top layout with one
  wide cinematic panel over three strips.
- **Per-panel photo editing** — load your own photo or either bundled sample
  (`pier`, `boulevard`) into a panel, click a panel to select it, drag on the
  canvas to reposition its photo, and zoom it with the slider.
- **Three real colour grades**, computed pixel by pixel on the canvas (not
  CSS filters): *Vice Sunset*, a gradient-map duotone of violet, magenta and
  gold; *Neon Nights*, a teal-and-magenta split tone with an S-curve and a
  saturation push; and *Golden Hour*, a warm amber lift with soft highlight
  roll-off. The ungraded original is one click away.
- **Caption lettering** — your words, drawn on the cover in bold condensed
  capitals with a heavy dark stroke over a foot scrim, auto-fitted to the
  cover width.
- **Exports** at the three common post sizes: 1080 × 1080, 1080 × 1350 and
  1920 × 1080 PNG.

Screenshot scenes are built in: `?shot=cover` renders a finished grid cover
("LEONIDA DREAMS", Vice Sunset) full-frame, and `?shot=cover2` renders the
hero layout in Neon Nights ("NEON COAST").

## Running it

`main.ts` (Node 22, standard library only) hands the app in: it copies `app/`
and `screenshots/` to the output directory and writes `dossier.json` using
`buildDossier` from `vendor/makefun-app.ts`. To try the editor locally, run
`node serve.ts` and open http://localhost:8080.

Built by an AI agent for make.fun's
[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty,
$250 in USDC. MIT licensed.
