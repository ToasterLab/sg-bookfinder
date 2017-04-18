const nlb = require("nlb"),
			dotenv = require("dotenv"),
			goodreads = require("goodreads");

dotenv.config(); //prepare api keys from .env

let data = {
	retrieveShelf: "to-read"
};

gr = new goodreads.client({ 'key': process.env.GOODREADS_API_KEY, 'secret': process.env.GOODREADS_API_SECRET });
nlb.setApiKey(process.env.NLB_API_KEY);

function bookfinder(){}

bookfinder.prototype.setUserId = (userId) => {data.userId = userId;};
bookfinder.prototype.getUserInfo = (username) => {
	return new Promise ((resolve, reject) => {
		gr.showUser(username, (res) => {
			if("error" in res){reject(res.error); return;}
			if("private" in res.GoodreadsResponse.user[0] && res.GoodreadsResponse.user[0].private[0] == 'true'){reject("Private profile");return;}
			resolve({
				id: res.GoodreadsResponse.user[0].id[0],
				name: res.GoodreadsResponse.user[0].name[0],
				photo: res.GoodreadsResponse.user[0].image_url[0],
				shelves: res.GoodreadsResponse.user[0].user_shelves[0].user_shelf.map((shelf) => {
					return {
						id: shelf.id[0],
						name: shelf.name[0],
						book_count: shelf.book_count[0],
					};
				})
			});
		});
	});
}
bookfinder.prototype.getBooksOnShelf = (userId, shelf, howMany) => { // will only grab last 200 added
	return new Promise((resolve, reject) => {
		gr.getSingleShelf({userID:userId, shelf:shelf, page:1, per_page:howMany}, (res) => {
			resolve(res.GoodreadsResponse.books[0].book.map((book) => {
				return {
					isbn: book.isbn[0],
					isbn13: book.isbn13[0],
					title: book.title[0],
					image: book.image_url[0],
					url: book.link[0],
					description: book.description[0],
					average_rating: book.average_rating[0],
					ratings_count: book.ratings_count[0],
					published: book.published[0],
					authors: book.authors[0]
				}
			}));
		})
	});
}

let isbn2Availability = (isbn, title, library) => {
	return new Promise((resolve, reject) => {
		nlb.GetAvailabilityInfo({ISBN:isbn}).then((result) => {
			let availability = []
			if(result.constructor === Array){
				result.forEach(info => {
					if(info.BranchID === library){
						 availability.push({
							ISBN: isbn,
							Title: title,
							BranchID: info.BranchID,
							BranchName: info.BranchName,
							LocationDesc: info.LocationDesc,
							CallNumber: info.CallNumber,
							Status: info.StatusDesc
						});
					}
				});
				resolve(availability)
			} else if(result.constructor === Object){
				if(result.BranchID === library){
					availability.push({
						isbn: isbn,
						title: title,
						BranchID: result.BranchID,
						BranchName: result.BranchName,
						LocationDesc: result.LocationDesc,
						CallNumber: result.CallNumber,
						Status: result.StatusDesc
					});
				}
				resolve(availability)
			} else {resolve([])}
		}).catch((err) => {
			if(err !== "Item not available for loan yet" &&
				 err !== "Item found but No records found" &&
				 (err.constructor === Object && "Error" in err)){
				 	reject(err)
			} else {resolve([])}
		})
	})
	
}

let isBookThere = (book, library) => {
	return new Promise ((resolve, reject) => {
		isbn = book.isbn === "object" ? null : book.isbn;
		isbn13 = book.isbn3 === "object" ? null : book.isbn13;
		if(isbn){
			isbn2Availability(isbn, book.title, library).then(result => resolve(result)).catch(reject)
		} else if (isbn13){
			isbn2Availability(isbn13, book.title, library).then(result => resolve(result)).catch(reject)
		} else {
			reject("ISBN invalid");
		}
	});
}

bookfinder.prototype.isBookAvailable = (book, library) => {
	return new Promise ((resolve, reject) => {
		isBookThere(book, library).then((result) => {
			if(typeof result !== "undefined" && result.length > 0){
				result.forEach((v,i) => {
					if(v.Status !== "Not On Loan"){
						result.splice(i,1);
					}
				})
				resolve(result);
			} else {resolve([]);}
		}).catch(reject);
	});
}


/*bookfinder.prototype.getAvailableBooks = (books, library) => {
	return new Promise((resolve, reject) => {
		isbns = books.map((book) => {return (typeof book.isbn === "object" ? null : book.isbn)});
		isbn13s = books.map((book) => {return (typeof book.isbn3 === "object" ? null : book.isbn13)});
		let booksAvailable = []
		isbns.forEach((isbn, i) => {
			if(isbn !== null){
				nlb.GetAvailabilityInfo({ISBN: isbn}).then((res) => {
					if(!(res.constructor === "array")){
						//console.log(JSON.stringify(res))
					}
					res = res.map((info) => {
						if(info.BranchID === library){
							return {
								ISBN: isbn,
								Title: books[i].title,
								BranchID: info.BranchID,
								BranchName: info.BranchName,
								LocationDesc: info.LocationDesc,
								CallNumber: info.CallNumber,
								Status: info.StatusDesc
							}
						}
					})
					booksAvailable.push(res)
				}).catch((err) => {
					//console.log(`${books[i].title} ${err}`)
				})
			}
		})
		//console.log(booksAvailable)
		resolve(booksAvailable);
	})
	
}

module.exports = new bookfinder();

let a = new bookfinder();
console.log("Grabbing user id");
a.getUserInfo("megadeen").then((user) => {
	let userid = user.id;
	console.log(`Hi ${user.name}, your user id is ${userid}`);
	console.log(`Checking books on your to-read shelf`);
	a.getBooksOnShelf(userid, "to-read", 50).then((books) => {
		console.log(`You have ${books.length} on your to-read shelf`);
		console.log(`Checking which are available at Bishan Public Library...`);
		let total = [];
		books = books.map((book) => {
			return a.isBookAvailable(book, "BIPL");
		});
		//books = [Promise.resolve(1),Promise.resolve(2),Promise.resolve(3)]
		Promise.all(books).then((result) => {
			console.log(result);
		}).catch((err) => {
			console.log(err);
		})
	}).catch((err) => {console.log(err)});
	
}).catch((err) => {console.log(err)});*/