/* jshint asi:true */
const nlb = require("nlb"),
			url = require("url"),
			gb = require("google-books-search"),
			goodreads = require("./goodreads").default

let gr, gbs = {}

function bookfinder(){}

/**
 * @function setup
 * Sets up all clients and sets the relevant API keys
 * @param {object} env - environment variable or other object
 * @param {string} env.GOODREAD_API_KEY - Goodreads API Key
 * @param {string} env.GOODREADS_API_SECRET - Goodreads API Secret
 * @param {string} env.NLB_API_KEY - NLB's API Key
 * @param {string} env.GOOGLE_BOOKS_KEY - Google Books API Key
 */

bookfinder.prototype.setup = env => {
	gr = goodreads.client({
		'key': env.GOODREADS_API_KEY,
		'secret': env.GOODREADS_API_SECRET,
		'callback': "https://bookwhere.ketupat.me/callback" // default is http://example.com/calback
	})
	nlb.setApiKey(env.NLB_API_KEY)
	gbs.apiKey = env.GOOGLE_BOOKS_KEY
}

/**
 * @function setGoodreadsCallback
 * to set callback. useful if not all callbacks are created and handled the same way
 * @param {url} callback - callback url
 */
bookfinder.prototype.setGoodreadsCallback = callback => {
	gr.configure(null, null, callback)
}
bookfinder.prototype.setOAuth = (key, secret) => {gr.oauthAccessToken = key; gr.oauthAcessTokenSecret = secret;}
bookfinder.prototype.getSignInURL = () => {
	return new Promise((resolve, reject) => {
		gr.requestToken().then((result) => {
			if(result.constructor === Object){resolve(result)} else {reject(result)}
		})
	})
}
bookfinder.prototype.processSignIn = (token, secret, authorize) => { // handle /callback requests
	return new Promise((resolve, reject) => {
		gr.processCallback(token, secret, authorize).then((callback) => {
			resolve(callback)
		});
	});
}
bookfinder.prototype.getMe = () => {
	return new Promise((resolve, reject) => {
		gr.showAuthUser(gr.oauthAccessToken, gr.oauthAcessTokenSecret).then(res => {
			if(res) resolve({
				id:res['$']['id'],
				name: res['name'][0],
				link: res['link'][0]
			});
			else reject(res);
		});
	});
}
bookfinder.prototype.getUserInfo = (input) => {
	return new Promise ((resolve, reject) => {
		gr.showUser(input).then(res => {
			if("error" in res){reject(res.error); return;}
			if("private" in res && res.private[0] == 'true'){
				gr.getShelves(res.id[0]).then((result) => {
					if("error" in result){reject(result.error); return;}
					resolve({
						id: res.id[0],
						name: res.name[0],
						photo: res.image_url[0].replace('http://','https://'),
						url: `https://www.goodreads.com/user/show/${res.id[0]}`,
						shelves: result.user_shelf.map((shelf) => {
							return {
								id: shelf.id[0],
								name: shelf.name[0],
								book_count: shelf.book_count[0],
							}
						})
					})
				}).catch(err => reject(err))
			} else {
				resolve({
					id: res.id[0],
					name: res.name[0],
					photo: res.image_url[0].replace('http://','https://'),
					url: `https://www.goodreads.com/user/show/${res.id[0]}`,
					shelves: res.user_shelves[0].user_shelf.map((shelf) => {
						return {
							id: shelf.id[0],
							name: shelf.name[0],
							book_count: shelf.book_count[0],
						};
					})
				})
			}
		}).catch(err => reject(err))
	})
}
bookfinder.prototype.getBooksOnShelf = (userId, shelf, page, howMany, order) => { // will only grab last 200 added
	return new Promise((resolve, reject) => {
		gr.getSingleShelf({
			userID:userId,
			shelf:shelf,
			page:page,
			per_page:howMany,
			sort: "date_added",
			order: order
		}).then((res) => {
			if("error" in res){
				reject(res.error);
				return;
			} else {
				resolve(res.map((book) => {
					return {
						isbn: book.isbn[0],
						isbn13: book.isbn13[0],
						title: book.title[0],
						image: book.image_url[0].replace('http://','https://'),
						url: book.link[0].replace('http://','https://'),
						description: book.description[0],
						average_rating: book.average_rating[0],
						ratings_count: book.ratings_count[0],
						published: book.published[0],
						authors: book.authors[0]
					}
				}));
			}
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
							isbn: isbn,
							title: title,
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
			reject(`ISBN invalid (${isbn})`) // ${JSON.stringify(book)}
		}
	});
}

bookfinder.prototype.isBookAvailable = (book, library) => {
	return new Promise ((resolve, reject) => {
		isBookThere(book, library).then(result => {
			if(typeof result !== "undefined" && result.length > 0){
				result = result.filter(r => r.Status === "Not On Loan")
				result.map(v => {
					v.description = book.description
					v.image = book.image
					v.url = book.url
					v.published = book.published
					v.authors = book.authors
					v.average_rating = book.average_rating
					v.ratings_count = book.ratings_count
					return v
				})
				resolve(result)
			} else {resolve([])}
		}).catch(reject)
	})
}

bookfinder.prototype.whereIsBookAvailable = isbn => {
	return new Promise((resolve, reject) => {
		nlb.GetAvailabilityInfo({ISBN:isbn}).then(result => {
			if(result.constructor === Array){
				resolve(result.filter(r => r.StatusDesc === "Not On Loan"))
			} else if(result.constructor === Object){
				resolve([result].filter(r => r.StatusDesc === "Not On Loan"))
			} else {resolve([])}
		}).catch((err) => {
			console.log(err)
			if(err !== "Item not available for loan yet" &&
				 err !== "Item found but No records found" &&
				 (err.constructor === Object && "Error" in err)){
				 	reject(err)
			} else {resolve([])}
		})
	})
}

let isValidISBN = isbn => {
  isbn = isbn.replace(/[^\dX]/gi, '')
  if(isbn.length != 10) return false
  let chars = isbn.split('')
  if(chars[9].toUpperCase() == 'X'){
    chars[9] = 10
  }
  let sum = 0
  for (let i = 0; i < chars.length; i++) {
    sum += ((10-i) * parseInt(chars[i]))
  }
  return ((sum % 11) == 0)
}

bookfinder.prototype.findInNLB = title => {
	if(isValidISBN(title)){
		return nlb.GetTitleDetails({ISBN: title})
	} else {
		return nlb.Search({field: "Title", terms: title})
	}
}

bookfinder.prototype.findInGoodreads = title => {return gr.searchBooks(title)}

bookfinder.prototype.grId2ISBN = id => {
	return new Promise((resolve, reject) => {
		gr.showBook(id).then(b => resolve(b.isbn13[0]), reject)
	})
}

/**
 * @function findInGoogleBooks
 * Searches Google Books for the specified title
 * @param {string} title - title of the book 'The Magicians'
 * @returns {Promise} - array of book objects matching specified title
 */
bookfinder.prototype.findInGoogleBooks = title => {
	return new Promise((resolve, reject) => {
		gb.search(title, {
			key: gbs.apiKey,
			type:'books',
		}, (error, results, response) => {
			if(error){reject(error)}
			resolve(results)
		})
	})
}

/**
 * @function getAllAvailableBooksOnShelf
 *  Grabs all books on a user's specified shelf that are not on loan in a specified library
 * @param {object} user - containing user's id {id: 232143}
 * @param {string} shelf - name of shelf 'to-read'
 * @param {integer} shelf_length - how many books are on the shelf
 * @param {string} library - abbreviation BIPL
 * @param {function} adhoc - callback function called on results as they are obtained
 * @returns {Promise} - when all processing is done. contains an array of all books sent to adhoc
 */
bookfinder.prototype.getAllAvailableBooksOnShelf = (user, shelf, shelf_length, library, adhoc) => {
	return new Promise((resolve, reject) => {
		let assemblyLine = []
		for(let i=1;i<=Math.ceil(shelf_length/100);i++){
			assemblyLine.push(
				self.getBooksOnShelf(user.id, shelf, i, 100, "d")
			)
		}
		let counter = 0
		let allBooks = []
		assemblyLine.forEach(p => {
			p.then(result => {
				books = result
				books.forEach(book => {
					self.isBookAvailable(book, library).then(result => {
						counter++
						if(result.length > 0){
							allBooks.push(result)
							adhoc(result)
						}
						if(counter === parseInt(shelf_length)){
							resolve(allBooks)
						}
					}).catch(err => reject(err))
				})
			})
		})
	})
}
var self = new bookfinder()
module.exports = self
