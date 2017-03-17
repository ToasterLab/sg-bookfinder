const express = require("express"),
			bookfinder = require("./lib/sg-bookfinder.js");
			
let app = express();

app.use(express.static('public')) // html & bundle.js
app.use(express.static('./node_modules/bulma/css')) // bulma

app.listen(3000, function () {
  console.log('Bookfinder listening on port 3000!')
})
