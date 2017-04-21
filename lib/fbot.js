/* jshint asi:true */
const request = require("request")

const bookfinder = require("./sg-bookfinder.js")

const verifytoken = "hueyhuey"

let page_token

function fbot(){}

fbot.prototype.setup = env => {page_token = env.FB_PAGE_ACCESS_TOKEN}

let receivedPostback = event => {
	console.log(`Received postback for user ${event.sender.id} and page ${event.recipient_id} at ${event.timestamp} with payload ${event.postback.payload}`)
}

let callSendAPI = (msgData) => {
	request({
		uri: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token: page_token},
		method: 'POST',
		json: msgData

	}, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			console.log(`Successfully sent message with id ${body.message_id} to recipient ${body.recipient_id}`)
		} else {
			console.error("Unable to send message.")
			console.error(body.error)
			console.error(error)
		}
	})
}

/* elements = {
		            title: "rift",
		            subtitle: "Next-generation virtual reality",
		            item_url: "https://www.oculus.com/en-us/rift/",
		            image_url: "http://messengerdemo.parseapp.com/img/rift.png",
		            buttons: [{
		              type: "web_url",
		              url: "https://www.oculus.com/en-us/rift/",
		              title: "Open Web URL"
		            }
*/
let sendGenericMessage = (recipientId, elements) => {
	callSendAPI({
		recipient: {
			id: recipientId
		},
	  message: {
	    attachment: {
	      type: "template",
	      payload: {
	        template_type: "generic",
	        elements: elements
	      }
	    }
	  }
  })
}

let sendTextMessage = (senderId, messageText) => {
	callSendAPI({
			recipient: {
				id: senderId
			},
			message: {
				text: messageText
			}
		})
}

let receivedMsg = event => {
	//console.log(JSON.stringify(event))
	console.log(`Received message for user ${event.sender.id} and page ${event.recipient.id} at ${event.timestamp} with message: ${JSON.stringify(event.message)}`)
	if(event.message){
		sendTextMessage(event.sender.id, event.message.text)
		sendGenericMessage(event.sender.id, [
			{
				title:"Hot Potato",
				subtitle:"the best potatoes money can buy",
				item_url:"hotpotato.com",
				image_url:"https://img.clipartfest.com/ccf8bc742f59244af90aa6af8e674c87_consequence-hot-potato-game-hot-potato-game-clipart_500-494.jpeg",
				buttons: [
					{type: "web_url",
						url: "https://waffle.press",
						title: "Cure Cancer"
					},
					{type: "web_url",
						url: "https://ketupat.me",
						title: "World Peace"
					}
				]
			}
		])
	}
	if(event.postback) {
  	receivedPostback(event)
  }
}

fbot.prototype.incoming = (req, res) => {
	console.log(req.query)
	res.status(200).send("OK")
	if (req.body.object === 'page') {
		// Iterate over each entry - there may be multiple if batched
		req.body.entry.forEach(entry => {
			let pageID = entry.id
			let timeOfEvent = entry.time
			// Iterate over each messaging event
			entry.messaging.forEach(event => {
				if (event.message) {
					receivedMsg(event)
				} else {
					console.log("Webhook received unknown event: ", event)
				}
			});
		})
	}
}

module.exports = new fbot();