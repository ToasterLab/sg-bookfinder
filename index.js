/* jshint asi:true */
const fs = require("fs"),
			dotenv = require("dotenv"),
			express = require("express"),
			expressWs = require('express-ws'),
			bodyParser = require('body-parser')
			
const fbot = require("./lib/fbot"),
			bookfinder = require("./lib/sg-bookfinder")

dotenv.config() //prepare api keys from .env

let app = express()
let ews = expressWs(app)

bookfinder.setup(process.env)
fbot.setup(process.env)

app.use(bodyParser.json())			 // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({		 // to support URL-encoded bodies
	extended: true
}));

app.use(express.static('public')) // html & bundle.js
app.use(express.static('./node_modules/bulma/css')) // bulma

// error
throwError = (res, err) => {res.send(JSON.stringify({error: err}))}

let oauths = {}
let curUsers = JSON.parse(fs.readFileSync("data.json", "utf8")) || []

app.get('/login', (req, res) => {
	bookfinder.configure(null, null, "https://bookwhere.ketupat.me/callback")
	bookfinder.getSignInURL().then(url => {
		oauths[url.oauthToken] = {
			oauthTokenSecret: url.oauthTokenSecret
		}
		res.send(JSON.stringify({url: url}))
	}).catch(err => throwError(res,err))
})

app.get('/callback', (req, res) => {
	if(req.query.authorize === "1"){
		console.log(oauths)
		bookfinder.processSignIn(req.query.oauth_token, oauths[req.query.oauth_token].oauthTokenSecret, req.query.authorize).then(result => {
			let user = {
				id: result.userid,
				accessToken: result.accessToken,
				accessTokenSecret: result.accessTokenSecret
			}
			curUsers.push(user)
			fs.writeFileSync("data.json",JSON.stringify(curUsers))
			res.send(`<script>localStorage.setItem("user", '${JSON.stringify(user)}');window.location.href='http://bookfinder.ketupat.me'</script>`)
		}).catch(err => {console.log(err)})
	} else {
		res.send("Oauth denied :(")
	}
})

app.get('/fbot', fbot.incoming)
app.post('/fbot', fbot.incoming)

app.get('/fbot_callback', fbot.callback)

app.ws('/', (ws, req) => {
	let wSend = (ws, event, data) => {ws.send(JSON.stringify({event:event,data:data}))}
	ws.on('message', msg => {
		msg = JSON.parse(msg)
		console.log(msg)
		switch(msg.event){
			case "retrieveUser":
				let user = msg.data
				console.log(`${(new Date()).toLocaleString()} ${JSON.stringify(user)}`)
				bookfinder.setOAuth(user.accessToken, user.accessTokenSecret)
				bookfinder.getUserInfo(user.id).then(user => {
					wSend(ws, "sendUser", user)
				}).catch(err => wSend(ws, "error", err))
				break
			
			case "getBooks":
				let usr = msg.data.user
				bookfinder.getAllAvailableBooksOnShelf(
					usr, msg.data.selected.shelf, 
					msg.data.selected.slength,
					msg.data.selected.lib,
					interim => wSend(ws, "sendBooks", interim)
				).then(result => wSend(ws, "endBooks", result))
				.catch(err => console.error(err))
				break
		}
	})
})

app.listen(8085, () => {
	console.log('Bookfinder listening on port 8085!')
})
