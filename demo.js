const bookfinder = require("./lib/sg-bookfinder.js");

console.log("Grabbing user id");

let continueProcessing = (user) => {
	let userid = user.id;
	console.log(`Hi ${user.name}, your user id is ${userid}`);
	console.log(`Checking books on your to-read shelf`);
	bookfinder.getBooksOnShelf(userid, "to-read", 50, "a").then((books) => {
		console.log(`You have ${books.length} on your to-read shelf`);
		console.log(`Checking which are available at Bishan Public Library...`);
		let total = [];
		books = books.map((book) => {
			return bookfinder.isBookAvailable(book, "BIPL");
		});
		//books = [Promise.resolve(1),Promise.resolve(2),Promise.resolve(3)]
		Promise.all(books).then((result) => {
			console.log(result.filter(n => n.length>0));
		}).catch((err) => {
			console.log(err);
		})
	}).catch((err) => {console.log(err)});
}

bookfinder.getUserInfo("hueyy").then((user) => {
	continueProcessing(user)
}).catch((err) => {
	if(err === "Private profile"){
		bookfinder.getSignInURL().then((url) => {
			console.log(url)
		}).catch(err => console.log(err))
	} else {
		console.log(err)
	}
});