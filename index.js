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
	bookfinder.getSignInURL().then(url => {
		oauths[url.oauthToken] = {
			oauthTokenSecret: url.oauthTokenSecret
		};
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
			curUsers.push(user);
			fs.writeFileSync("data.json",JSON.stringify(curUsers));
			res.send(`<script>localStorage.setItem("user", '${JSON.stringify(user)}');window.location.href='http://bookfinder.ketupat.me'</script>`);
		}).catch(err => {console.log(err)})
	} else {
		res.send("Oauth denied :(")
	}
})

app.get('/fbot', fbot.incoming)
app.post('/fbot', fbot.incoming)

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
				let assemblyLine = []
				for(let i=1;i<=Math.ceil(msg.data.selected.slength/100);i++){
					assemblyLine.push(
						bookfinder.getBooksOnShelf(usr.id, msg.data.selected.shelf, i, 100, "d")
					)
				}
				let counter = 0
				let allBooks = []
				assemblyLine.forEach(p => {
					p.then(result => {
						books = result
						//books = result.reduce((acc, val) => acc.concat(val))
						books.forEach(book => {
							bookfinder.isBookAvailable(book, msg.data.selected.lib).then(result => {
								counter++
								if(result.length > 0){
									allBooks.push(result)
									wSend(ws, "sendBooks", result)
								}
								if(counter === parseInt(msg.data.selected.slength)){
									wSend(ws, "endBooks", allBooks)
								}
							}).catch(err => console.error(err))
						})
					})
				})
				break
		}
	})
})

app.listen(8085, () => {
	console.log('Bookfinder listening on port 8085!')
})
