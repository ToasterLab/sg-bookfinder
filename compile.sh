#/bin/bash

pug public
browserify public/app.js -o public/bundle.js
node index.js