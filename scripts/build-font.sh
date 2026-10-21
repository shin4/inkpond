#!/usr/bin/env bash
# Rebuild every scene's glyph subset, src/assets/inkpond-<scene>.woff2, from a
# Source Han Serif SC OTF.
# Usage: scripts/build-font.sh path/to/SourceHanSerifSC-Medium.otf
# Each scene's glyph list is read from its module, so the two never drift.
set -euo pipefail
cd "$(dirname "$0")/.."
otf=${1:?path to SourceHanSerifSC-Medium.otf}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
for scene in $(bun -e 'import { SCENES } from "./src/scenes/index.ts"; console.log(SCENES.join(" "))'); do
  text=$(bun -e "import { createScene } from './src/scenes/index.ts'; process.stdout.write(createScene('$scene').glyphs.join(''))")
  uvx --from 'fonttools[woff]==4.55.3' pyftsubset "$otf" --text="$text" \
    --flavor=woff2 --layout-features='' --no-hinting --desubroutinize \
    --name-IDs='*' --output-file="$tmp/$scene.woff2"
  uvx --from 'fonttools[woff]==4.55.3' python -I scripts/rename-font.py \
    "$tmp/$scene.woff2" "src/assets/inkpond-$scene.woff2"
done
