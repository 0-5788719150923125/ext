#!/bin/sh

npm run build:chromium 
npm run build:firefox

(cd dist/chromium && zip -ry ../archive-chromium.${VERSION}.zip .)
(cd dist/firefox && zip -ry ../archive-firefox.${VERSION}.zip .)