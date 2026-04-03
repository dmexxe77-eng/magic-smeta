#!/bin/bash
set -e

DIR="/Users/nikolajgubar/Desktop/MagicAPP/magicapp-v2-4-smart"
PORTABLE_NODE="/Users/nikolajgubar/Desktop/MagicAPP/Последняя рабочая версия/.portable-node/bin"

cd "$DIR"
export PATH="$PORTABLE_NODE:$PATH"

echo "Starting MagicAPP dev server..."
echo "Project: $DIR"
echo "Open: http://127.0.0.1:5175/"
echo ""
echo "To stop: press Ctrl+C"
echo ""

npm run dev

