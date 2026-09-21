#!/usr/bin/env bash
#
# Entfernt die überflüssigen Quellbäume, die den Build auf Cloudflare Pages brechen.
#
#   bash scripts/cleanup-stale.sh
#
# Hintergrund: Im Repository lagen zeitweise zwei Implementierungen nebeneinander.
# Benutzt wird ausschließlich der Baum unter src/lib, src/features/{scale,export,
# parameters,stage}, src/store und src/components/ui/{button,field,overlay}.tsx.
# Alles andere ist toter Code — und bricht den Build:
#
#   src/core/**                 benötigt das nicht installierte Paket polygon-clipping
#   src/features/scale-editor/** zweite Anwendung, importiert src/core
#   src/app/api/**              Route-Handler mit force-dynamic; mit output:"export"
#                               nicht baubar (und hier ohnehin überflüssig)
#   src/db/**                   Drizzle/PostgreSQL; wird clientseitig nicht gebraucht
#
# Das Skript ist idempotent und löscht nichts, was nicht in der Liste steht.

set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

STALE=(
  "src/core"
  "src/features/scale-editor"
  "src/app/api"
  "src/db"
  "src/lib/api.ts"
  "drizzle.config.json"
  ".env"
)

echo "Scale Generator — überflüssige Quellbäume entfernen"
removed=0
for path in "${STALE[@]}"; do
  if [ -e "$path" ]; then
    rm -rf -- "$path"
    echo "  gelöscht: $path"
    removed=$((removed + 1))
  else
    echo "  nicht vorhanden: $path"
  fi
done

# shadcn-Dateien, die von dieser Anwendung nicht benutzt werden.
# Sie sind harmlos, solange die Radix-Pakete installiert sind — wer aufräumen will,
# nimmt sie mit. button.tsx, field.tsx, overlay.tsx und label.tsx bleiben stehen.
UNUSED_UI=(
  "src/components/ui/dialog.tsx"
  "src/components/ui/input.tsx"
  "src/components/ui/kbd.tsx"
  "src/components/ui/switch.tsx"
  "src/components/ui/tabs.tsx"
  "src/components/ui/toggle-group.tsx"
  "src/components/ui/tooltip.tsx"
)

echo
read -r -p "Nicht benutzte UI-Dateien ebenfalls löschen? [j/N] " answer
case "$answer" in
  [jJyY]*)
    for path in "${UNUSED_UI[@]}"; do
      if [ -e "$path" ]; then
        rm -f -- "$path"
        echo "  gelöscht: $path"
        removed=$((removed + 1))
      fi
    done
    ;;
  *) echo "  behalten (harmlos, aber toter Code)" ;;
esac

echo
echo "$removed Einträge entfernt."
echo "Weiter mit: node scripts/check-deploy.mjs"
