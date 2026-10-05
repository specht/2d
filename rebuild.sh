#!/usr/bin/env bash
# Rebuilds what is out of date and restarts the server.
#
#   ./rebuild.sh            recipes and guides that changed, then restart
#   ./rebuild.sh --force    everything again (slow), then restart
#   ./rebuild.sh --no-restart
#
# Both builds decide by content fingerprints (like make), so after a pull only
# what a change touches is recorded again: a recipe when its scene, its sprites
# or the engine changed, a guide when the studio changed. Unchanged ones are
# skipped in a second or two.

set -euo pipefail
cd "$(dirname "$0")"

force=""
restart=1
for arg in "$@"; do
    case "$arg" in
        --force) force="--force" ;;
        --no-restart) restart=0 ;;
        *) echo "unbekannt: $arg (erlaubt: --force, --no-restart)" >&2; exit 2 ;;
    esac
done

tools=rezepte/tools
# the tools' packages: installed once, again when package.json is newer
if [ ! -d "$tools/node_modules" ] || [ "$tools/package.json" -nt "$tools/node_modules" ]; then
    echo "== npm install"
    (cd "$tools" && npm install --no-audit --no-fund && touch node_modules)
fi

start=$SECONDS
echo "== Rezepte"
(cd "$tools" && node build.mjs $force)
echo "== Erste Schritte"
(cd "$tools" && node anleitungen.mjs $force)
echo "== fertig nach $((SECONDS - start)) s"

if [ "$restart" = 1 ]; then
    echo "== Server neu starten"
    ./config.rb restart ruby
fi
