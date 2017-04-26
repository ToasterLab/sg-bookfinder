/* jshint asi:true */
const fs = require("fs"),
			request = require("request")

const bot = require("./fbot-api.js"),
			bookfinder = require("./sg-bookfinder.js")

let db = {}, //in-memory db {id: state}
		lookups = {
			'book availability': {},
			'book availability buttons': {}
		},
		libraries

function fbot(){}

fbot.prototype.setup = env => {
	let menu = [{
		locale:'default',composer_input_disabled:false,
		call_to_actions:[
			{	title:'book',
				type:'postback',
				payload:JSON.stringify({action:"find book"})
			},
			{	title:'library',
				type:'postback',
				payload:JSON.stringify({action:"find library"})
			},
			{	title:'goodreads',
				type:'postback',
				payload:JSON.stringify({action:"goodreads"})
			}
		]
	}]
	bot.setup(env, menu)
	libraries = JSON.parse(fs.readFileSync('./data/libraries.json','utf8'))
}

let canned = {
	start: {
		text: "Hi, what you want?",
		buttons: [
			{
				content_type:'text', title:'book',
				payload:JSON.stringify({action:'find book'})
			},
			{	content_type:'text', title:'library',
				payload:JSON.stringify({action:"find library"})
			},
			{	content_type:'text', title:'goodreads',
				payload:JSON.stringify({action:"goodreads"})
			}
		]
	},
	again: {
		text: "you still want anything?"
	},
	problem: {
		text: "eh sorry, got problem. try again?"
	},
	availability: {
		text: "which library you want me to check? or nearest one?",
		buttons: [
			{content_type:"location"}
		]
	},
	library: {
		text: "You want go which library? Or you tell me where you are I find nearest one for you.",
		buttons: [
			{content_type:"location"}
		]
	}
}

let chunkButtons = (btns, payload, n) => {
	let result = [], temp = []
	let next = {
		content_type:'text', title:"more",
		payload:{
			action:'more availability buttons'
		}
	}
	let prev = {
		content_type:'text', title:"< back",
		payload:{
			action:'more availability buttons'
		}
	}
	Object.keys(payload).forEach(v => {
		next.payload[v] = payload[v]
		prev.payload[v] = payload[v]
	})
	if(btns.length <= n){return [btns]}
	while(btns.length > 0){
		temp.push(btns.splice(0,1)[0])
		if(typeof next.payload === 'string'){
			next.payload = JSON.parse(next.payload)
			prev.payload = JSON.parse(prev.payload)
		}
		next.payload.page = `${result.length}`
		prev.payload.page = `${result.length-1}`
		next.payload = JSON.stringify(next.payload)
		prev.payload = JSON.stringify(prev.payload)
		if(temp.length === n-1 && result.length === 0){ // first chunk
			temp.push(next)
		} else if(btns.length === 0){ // last chunk
			temp.unshift(prev)
		} else if(temp.length === n-2 && result.length > 0 && btns.length > 0){
			temp.unshift(prev)
			temp.push(next)
		}
		if(temp.length === 11 || btns.length === 0){
			result.push(temp)
			temp = []
		}
	}
	return result
}

let chunkAvailabilityButtons = (btns, payload) => {
	return chunkButtons(btns, payload, 11)
}

let handlePayload = (event, payload) => {
	try{
		payload = JSON.parse(payload)
	} catch (e) {
		console.error(e)
		return
	}
	if(!payload.action){
		console.error(`What kind of payload is this ${JSON.stringify(payload)}`)
		return
	}
	switch(payload.action){
		case 'get started':
			bot.sendQuickReply(event.sender.id,canned.start.text,canned.start.buttons)
			break
		case 'thanks':
			bot.sendQuickReply(event.sender.id, "no problem, anytime", canned.start.buttons)
			break
		case 'find book':
			bot.sendTextMessage(event.sender.id, "What book you looking for?")
			db[event.sender.id] = 'find book'
			break
		case 'find library':
			bot.sendQuickReply(event.sender.id, canned.library.text, canned.library.buttons)
			db[event.sender.id] = 'find library'
			break
		case 'nearest library':
			bot.sendTextMessage(event.sender.id, "Okay I find for you")
			break
		case 'is book available':
			if('library' in payload){
				console.log(payload)
				let result = lookups['book availability'][payload.book]
					.filter(r => r.BranchID === payload.library)
				if(result.length === 0){
					bot.sendQuickReply(event.sender.id, canned.problem.text, canned.start.buttons)
				} else {
					bot.sendTyping(event.sender.id, true)
					bot.sendTextMessage(event.sender.id, `${result[0].BranchName}\n${result[0].LocationDesc}\n${result[0].CallNumber.replace(/\s+/g, ' ')}`).then(() => {
						bot.sendTyping(event.sender.id, false)
						bot.sendQuickReply(event.sender.id, canned.again.text, canned.start.buttons)
					})
				}
			} else if('book' in payload){
				bot.sendTyping(event.sender.id, true)
				bookfinder.whereIsBookAvailable(payload.book).then(results => {
					if(results.length === 0){
						bot.sendQuickReply(event.sender.id, "eh, don't have leh. try another book?", canned.again.buttons)
					} else {
						let availability = {}
						results.forEach(line => {
							if(typeof libraries.filter(l => l.id === line.BranchID)[0] === 'undefined'){
								console.log(line)
							}
							line.nickname = libraries.filter(l => l.id === line.BranchID)[0].nickname
							availability[line.BranchID] = line
						})

						lookups['book availability'][payload.book] = results
						
						let nicknames = Object.keys(availability)
								.map(a => availability[a].nickname).sort().join(", ")
						
						let buttons = []
						Object.keys(availability).forEach(a => {
							buttons.push({
								content_type:'text', title:availability[a].nickname,
								payload:JSON.stringify({
									action:'is book available', 
									book:payload.book,
									library:availability[a].BranchID
								})
							})
						})

						buttons = chunkAvailabilityButtons(buttons, {book: payload.book})
						lookups['book availability buttons'][payload.book] = buttons
						bot.sendQuickReply(event.sender.id, `all these libraries got:`, buttons[0])
					}
				}).catch(err => {
					bot.sendQuickReply(event.sender.id, "eh, don't have leh. try another book?", canned.start.buttons)
					console.error(err)
				})
			} else {
				console.error(`'book' not in payload ${JSON.stringify(payload)}`)
			}
			break

		case 'more availability buttons':
			if(!("book" in payload) || !("page" in payload)){
				bot.sendQuickReply(event.sender.id, canned.problem.text, canned.start.buttons)
			} else {
				let btns = lookups['book availability buttons'][payload.book][payload.page]
				bot.sendQuickReply(event.sender.id, "libraries", btns)
			}
			break
	}
}

let handleMessage = event => {
	switch(db[event.sender.id]){
		case 'find book':
			// I'm telling you what book I want
			if(event.message.text){
				bot.sendTyping(event.sender.id, true)
				console.log(event.message.text)
				bookfinder.findInGoogleBooks(event.message.text).then(result => {
					if(result.constructor !== Array || result.length === 0){
						throw Error("No Google Books results")
					}
					let list = []
					result.forEach(book => {
						if(typeof book.subtitle !== 'undefined'){
							book.blurb = `${book.subtitle}\n`
						} else {book.blurb = ''}
						if(typeof book.authors !== 'undefined'){
							book.blurb += `${book.authors.join(', ')}\n`
						}
						if(typeof book.publishedDate !== 'undefined'){
							book.blurb += `published in ${book.publishedDate.substring(0,4)}\n`
						}
						if(typeof book.description !== 'undefined'){
							book.blurb += `${book.description}`
						}
						if(book.industryIdentifiers.filter(i => i.type === "ISBN_13").length === 1){
							book.isbn = book.industryIdentifiers.filter(i => i.type === "ISBN_13")[0].identifier
						} else {
							book.isbn = book.industryIdentifiers[0].identifier
						}
						list.push({
							title: book.title,
							subtitle: book.blurb,
							image_url: book.thumbnail,
							default_action: {
								type: 'web_url',
								url: book.link
								//`https://books.google.com/books?vid=ISBN${book.industryIdentifiers[0].identifier}`
							},
							buttons: [{
								type: 'postback',
								title: 'Availability',
								payload: JSON.stringify({
									action:'is book available', book: book.isbn
								})
							}]
						})
					})
					bot.sendTemplateMessage(event.sender.id, {
						template_type: 'generic',
						elements: list
					}).then(() => {
						bot.sendTyping(event.sender.id, false)
						bot.sendQuickReply(event.sender.id, canned.again.text, canned.start.buttons)
					})
					console.log(JSON.stringify(result))
				/*bookfinder.findInGoodreads(event.message.text).then(result => {
					if(typeof result === 'undefined'){throw Error("No Goodreads results")}
					console.log(result)
					result = result.slice(0,4)
					//let isbns = result.map(b => bookfinder.grId2ISBN(b.best_book[0].id[0]._))
					//Promise.all(isbns).then(values => {
						//result = result.map((b,i) => {b.isbn = values[i]; return b})
					*/
				}).catch(err => {
					bot.sendTextMessage(event.sender.id, "eh sorry don't have. you typo issit? tell me again?")
					console.error(err)
				})
			} else {
				bot.sendTextMessage(event.sender.id, "Eh what kind of book is that?? Give me the title of the book lah...")
			}
			break
			
		case 'find library': // I'm telling you what library I want
			if(typeof event.message.attachments[0] !== 'undefined' && event.message.attachments[0].type === 'location'){
				let coords = event.message.attachments[0].payload.coordinates
				bot.sendTextMessage(event.sender.id, "Oh you want nearest one ah")
			} if (typeof event.message.text === 'string'){
				
				bot.sendTextMessage(event.sender.id, "Okay I find library for you")
			}
			break
		
		default: // includes 'default'
			// I'm lost and I'm not sure what to do
			// check if the idiot typed instead of pressing the buttons
			bot.sendQuickReply(event.sender.id, canned.start.text, canned.start.buttons)
			break
	}
}

let receivedPostback = event => {
	console.log(`Received postback for user ${event.sender.id} and page ${event.recipient.id} at ${event.timestamp} with payload ${event.postback.payload}`)
	if(event.postback.payload){
		handlePayload(event, event.postback.payload)
	}
}

let receivedMsg = event => {
	console.log(`Received message for user ${event.sender.id} and page ${event.recipient.id} at ${event.timestamp} with message: ${JSON.stringify(event.message)}`)
	if(!(event.sender.id in db)){
		db[event.sender.id] = 'default'
	}
	if(event.message.quick_reply && event.message.quick_reply.payload){
		handlePayload(event, event.message.quick_reply.payload)
	} else {
		handleMessage(event)
	}
}

fbot.prototype.incoming = (req, res) => {
	console.log(JSON.stringify(req.body))
	res.status(200).send("OK")
	if (req.body.object === 'page') {
		// Iterate over each entry - there may be multiple if batched
		req.body.entry.forEach(entry => {
			let pageID = entry.id
			let timeOfEvent = entry.time
			// Iterate over each messaging event
			entry.messaging.forEach(event => {
				if (JSON.stringify(event.message)) {
					console.log(event.message)
					receivedMsg(event)
				} else if (JSON.stringify(event.postback)){
					console.log(JSON.stringify(event.postback))
					receivedPostback(event)
				} else {
					console.log("Webhook received unknown event: ", event)
				}
			})
		})
	}
}

module.exports = new fbot()