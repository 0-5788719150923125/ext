#!/bin/sh

rm -rf dist
mkdir -p dist

(zip -r ./dist/source.${VERSION}.zip . -x "*.git*" "*.git/*" "node_modules/*" "models/*")

npm run build:chromium 
npm run build:firefox

(cd dist/chromium && zip -ry ../archive-chromium.${VERSION}.zip .)
(cd dist/firefox && zip -ry ../archive-firefox.${VERSION}.zip .)