#!/bin/sh

rm -rf dist

(cd .. && zip -r ext/dist/source.${VERSION}.zip ./ext -x "*.git*" "*.git/*" "node_modules/*")

npm run build:chromium 
npm run build:firefox

(cd dist/chromium && zip -ry ../archive-chromium.${VERSION}.zip .)
(cd dist/firefox && zip -ry ../archive-firefox.${VERSION}.zip .)