#/bin/bash

pug public
browserify scripts/app.js -o public/bundle.js
node index.js