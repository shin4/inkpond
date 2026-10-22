<div align="center">

# 墨池 Inkpond

[简体中文](README.md) · **English**

An ink-wash background of Chinese glyphs for the web.

[![CI](https://github.com/shin4/inkpond/actions/workflows/ci.yml/badge.svg)](https://github.com/shin4/inkpond/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-b4372b.svg)](LICENSE)

[**Live demo**](https://shin4.github.io/inkpond/) · [Session demo](https://shin4.github.io/inkpond/session/)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/qingming-dark.webp" />
  <img alt="The Qingming handscroll unrolling to the left: a timber rainbow bridge arches from the near bank over the river, boats pass, the pointer stirs ripples and a click spreads ink" src="docs/images/qingming-light.webp" />
</picture>

Chinese characters, laid out by stroke density, become a picture: distant hills in mist, a lotus pond with koi, or a slowly unrolling handscroll of *Along the River During the Qingming Festival*. The pointer stirs ripples, a click drops ink that spreads and fades, and page content keeps a clear zone around it.

- **Three scenes**: hills, lotus pond and the Qingming scroll, with optional pale colour
- **Responsive**: ripples follow the pointer, clicks drop ink, koi flee and come to feed, walkers scatter from the ink
- **Out of the way**: content gets a clear zone, and koi, boats and walkers steer around it
- **Light**: Canvas 2D, zero runtime dependencies, under 2 ms of script per frame, steps down on weak devices
- **React optional**: an `<InkPond />` component, or use it without React

## Scenes

| `scene` | Picture | What moves |
| --- | --- | --- |
| `shanshui` (default) | Two ranges of distant hills, mist drifting past | The mist |
| `lotus` | A lotus pond seen from above: leaves, flowers, duckweed | Koi swim around content, scatter from the pointer and come to where ink drops |
| `qingming` | The Qingming handscroll: mountains and city walls, a pagoda and gate towers, taverns along both banks, a timber rainbow bridge across the river | The scroll unrolls to the left, boatmen pole, walkers cross the bridge, ink scatters them |

The lotus and Qingming scenes use a touch of pale colour (vermilion, rouge, ochre, indigo); set `tint={false}` for ink only.

| Lotus | Shanshui |
| --- | --- |
| <img alt="Lotus pond: koi swim to dropped ink and scatter from the pointer" src="docs/images/lotus.webp" /> | <img alt="Shanshui: two ranges of hills in mist, ripples from the pointer, ink from a click" src="docs/images/shanshui.webp" /> |

## Install

Not on npm yet. Install from GitHub; it builds on install:

```bash
npm i github:shin4/inkpond
```

<details>
<summary>With bun, or when npm mentions allow-scripts</summary>

- npm 11 notes dependencies with build scripts (`allow-scripts`) and installs anyway; if your config blocks dependency scripts, run `npm approve-scripts inkpond`.
- bun runs no dependency scripts by default and does not install a dependency's dev dependencies. Your project needs TypeScript, and inkpond must be trusted:

  ```bash
  bun add -d typescript
  bun add github:shin4/inkpond
  bun pm trust inkpond
  ```
- To pin a version, add a commit or tag, e.g. `github:shin4/inkpond#<commit>`.

</details>

## Usage

### React

```tsx
import { InkPond } from "inkpond/react";
import "inkpond/inkpond.css";

<main style={{ position: "relative" }}>
  <InkPond scene="lotus" active={isEmpty} />
  <section data-inkpond-avoid="">…greeting…</section>
  <form data-inkpond-avoid="">…composer…</form>
</main>
```

- The canvas fills the **nearest positioned parent** and takes pointer events from it.
- Elements with `data-inkpond-avoid` get a clear zone, including ones that appear later.
- `active` says whether this view is on screen; a background tab pauses by itself.
- Other options are read once on mount; change the `key` to remount with new ones.

### Without React

```ts
import { createInkPond } from "inkpond";
import "inkpond/inkpond.css";

const pond = createInkPond(document.querySelector("canvas.inkpond")!, {
  scene: "qingming",
});
pond.setActive(false); // when this view is hidden
pond.destroy();        // on unmount
```

### Stirring the water from code

The page can ripple and drop ink itself, say a ripple per keystroke and a drop on send. Coordinates are viewport coordinates (`clientX` / `clientY`):

```ts
pond.ripple(x, y, 0.4); // one ring of waves, strength 0–1, default 1
pond.drop(x, y);        // a drop of ink; refused (false) on a clear-zone element
```

In React, `pondRef` gives you the same object:

```tsx
const pondRef = useRef<InkPond | null>(null); // the InkPond type from "inkpond"
<InkPond pondRef={pondRef} />
// later: pondRef.current?.ripple(x, y)
```

Both do nothing while paused, in reduced motion and on the still tier.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `scene` | `"shanshui"` | `shanshui` / `lotus` / `qingming` |
| `tint` | `true` | Draw pale colour; `false` for ink only |
| `active` | `true` | Whether the view is on screen; background tabs always pause |
| `strength` | `0.45` | Ink depth of the scene; ripples and ink drops are not affected |
| `waveSpeed` | `1` | Wave speed multiplier |
| `levels` | per scene | Glyph levels for the main ground (the hills, or the water in lotus and Qingming), light to dark; other glyphs need your own font |
| `reducedMotion` | follows the system | When on, draws one still picture and ignores the pointer |
| `avoidAttribute` | `data-inkpond-avoid` | Attribute that marks clear zones |
| `avoidPadding` | `20` | Fully clear margin around those elements (CSS px) |
| `avoidFade` | `140` | Width of the fade back to full ink (CSS px) |
| `fontUrl` | the scene's subset | `null` to use the fallback fonts only |
| `fontFamily` / `fallbackFonts` | per scene / serif stack | Font name and fallbacks |
| `tierStorageKey` | `inkpond.tier` | localStorage key that remembers a step down; `null` to forget |

**Colour**: the ink is the canvas `color`, settable with the CSS variable `--inkpond-ink`; `--inkpond-alpha` is the opacity of the darkest ink. Pale colours come from `--inkpond-zhu` (vermilion), `--inkpond-yanzhi` (rouge), `--inkpond-zhe` (ochre) and `--inkpond-huaqing` (indigo). `inkpond.css` handles `prefers-color-scheme` and `.dark` / `data-theme="dark"` on `<html>`; colours follow theme changes.

## Performance

Each glyph is rasterised once into an atlas, and every frame only copies from it. The still parts of a scene are computed once per size, and slow layers such as mist are recomputed every 4 frames.

- **Frame rate on demand**: tier rate while the water moves; about 20–24 fps when only koi, boats or the scroll move; 10 fps when only mist drifts; stops after 30 s without input and wakes on the next pointer move.
- **Three tiers**: standard (60 fps, 16px cells), lite (30 fps, 22px cells) and still. Software rendering starts on still and weak devices on lite; sustained jank steps down at runtime, remembered for 30 days.
- **Accessibility**: pauses in hidden tabs; reduced motion draws one still picture; the canvas is hidden in forced-colours mode.

<details>
<summary>Measurements</summary>

Headless Chrome, 1920×1080, DPR 1.5, script time per frame as median / p95, budget 8 ms:

| Scene | Calm water | Pointer stirring the whole screen | Slow-layer recompute (every 4 frames) |
| --- | --- | --- | --- |
| Shanshui | 0.2 / 0.3 ms | 0.9 / 1.8 ms | 0.1 ms |
| Lotus | 0.2 / 0.3 ms | 1.1 / 1.9 ms | < 0.1 ms |
| Qingming | 0.7 / 0.9 ms | 1.3 / 1.7 ms | 0.2 ms |

Nearly all of it is image copies. With the GPU off and CPU rasterisation, a fully stirred frame takes about 9 ms, which is what the starting tier and the step-down are for. Step-down rules: a median over the last 10 frames above 16 ms, or a frame gap over 60 ms, goes straight to still; every 60 frames, a p95 above 8 ms or a gap over 40 ms steps down one tier. The atlas is a 16-column grid (Qingming at DPR 2 is 640×1400px), well inside the 4096px texture limit of many mobile GPUs.

</details>

## Fonts

Each scene ships a subset of Source Han Serif SC Medium (SIL OFL 1.1) with only the glyphs it uses, loaded when the scene is:

| File | Glyphs | Size |
| --- | --- | --- |
| `inkpond-shanshui.woff2` | 39 | about 10 KiB |
| `inkpond-lotus.woff2` | 66 | about 16 KiB |
| `inkpond-qingming.woff2` | 101 | about 21 KiB |

The OFL forbids modified versions from using the Reserved Font Name "Source", so the subsets are renamed **Inkpond Glyphs**. The licence and a note of the changes are in `src/assets/OFL.txt`.

## Development

```bash
bun install
bun run dev          # project page at http://localhost:5173/, session demo at /session/
bun run test         # unit tests
bun run smoke:pack   # packaging smoke test: install from the tarball and from git, then import, type-check and bundle
bun run build        # library to dist/
bun run build:demo   # demo pages to dist-demo/
```

After changing the glyphs any scene uses, rebuild all subsets from the original OTF (needs `bun` and `uv`; the font is in Adobe's `adobe-fonts/source-han-serif` repository):

```bash
scripts/build-font.sh path/to/SourceHanSerifSC-Medium.otf
```

The project page source is `demo/index.html`; every push to `main` redeploys it through `.github/workflows/pages.yml`.

## Thanks

Inkpond grew from [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks): a sea of characters behind the page that swims, avoids content and answers the pointer. Inkpond turns the idea into ink wash and Chinese glyphs, written from scratch without code from the original. Thanks to [@stackedlol](https://github.com/stackedlol) for the idea.

## Licence

Code under [MIT](LICENSE); the font subsets under SIL OFL 1.1, each applying separately.
