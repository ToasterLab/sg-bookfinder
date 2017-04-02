const fs = require("fs"),
			express = require("express"),
			bodyParser = require('body-parser'),
			bookfinder = require("./lib/sg-bookfinder.js");
			
let app = express();

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

app.use(express.static('public')) // html & bundle.js
app.use(express.static('./node_modules/bulma/css')) // bulma

// error
throwError = (res, err) => {res.send(JSON.stringify({error: err}))}

let oauths = {};
let curUsers = JSON.parse(fs.readFileSync("data.json", "utf8")) || [];

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
			res.send(`<script>localStorage.setItem("user", '${JSON.stringify(user)}');window.location.href='http://localhost:3000'</script>`);
		}).catch(err => {console.log(err)})
	} else {
		res.send("Oauth denied :(")
	}
})

app.post('/user', (req, res) => {
	let user = JSON.parse(req.body.user);
	bookfinder.setOAuth(user.accessToken, user.accessTokenSecret);
	bookfinder.getBooksOnShelf(user.id, "to-read", 50, "a").then((books) => {
		res.send(books);
	});
  /*bookfinder.getUserInfo(username).then((user) => {
  	console.log(user)
		bookfinder.getBooksOnShelf(user.id, "to-read", 50, "a").then((books) => {
			res.send(books)
			books = books.map((book) => {
				return bookfinder.isBookAvailable(book, "BIPL");
			});
			//books = [Promise.resolve(1),Promise.resolve(2),Promise.resolve(3)]
			Promise.all(books).then((result) => {
				res.send(result.filter(n => n.length>0));
			}).catch(err => res.send(err));
		}).catch(err => res.send(err))
	}).catch((err) => {
		throwError(res,err);
	});*/
});

app.listen(3000, () => {
  console.log('Bookfinder listening on port 3000!')
})
