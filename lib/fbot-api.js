/* jshint asi:true */
const request = require("request")

const verifytoken = "hueyhuey"

let page_token

function bot(){}

let callSettingsAPI = jsonData => {
	console.log(`https://graph.facebook.com/v2.6/me/messenger_profile?fields=persistent_menu&access_token=${page_token}`)
	return new Promise((resolve, reject) => {
		request({
			uri: 'https://graph.facebook.com/v2.6/me/messenger_profile',
			qs: {access_token: page_token},
			method: 'POST',
			json: jsonData
		}, (err, res, body) => {
			if(!err && res.statusCode == 200){
				console.log(`Successfully set ${JSON.stringify(jsonData)}. ${body.result}`)
				resolve(true)
			} else {
				console.error("Unable to set setting")
				console.error(body.error)
				console.error(err)
				reject(err)
			}
		})
	})
}

let setPersistentMenu = menu => {
	return callSettingsAPI({persistent_menu:menu})
}

let setGreetingText = text => {
	// can use {{user_first_name}}, {{user_last_name}} and {{user_full_name}}
	return callSettingsAPI({greeting: [{locale:'default',text:text}]})
}

let setStartButton = () => {
	// note: does not appear on mobile
	return callSettingsAPI({get_started: {payload: JSON.stringify({action:'get started'})}})
}

let callSendAPI = msgData => {
	return new Promise((resolve, reject) => {
		request({
			uri: 'https://graph.facebook.com/v2.6/me/messages',
			qs: {access_token: page_token},
			method: 'POST',
			json: msgData
		}, (error, response, body) => {
			if (!error && response.statusCode == 200) {
				console.log(`Successfully sent message with id ${body.message_id} to recipient ${body.recipient_id}`)
				resolve(true)
			} else {
				console.error("Unable to send message.")
				console.error(body.error)
				console.error(error)
				reject(error)
			}
		})
	})
}

bot.prototype.sendTyping = (recipientId, state) => {
	//boolean, true = typing, false = not typing. also turned off automatically after 20s
	return callSendAPI({
		recipient: {
			id:recipientId
		},
		sender_action: (state ? 'typing_on' : 'typing_off')
	})
}

book.prototype.sendSeen = recipientId => {
	return callSendAPI({
		recipient: {id:recipientId},
		sender_action: 'mark_seen'
	})
}

bot.prototype.sendTemplateMessage = (recipientId, payload) => {
	return callSendAPI({
		recipient: {id: recipientId},
	  message: {attachment: {type: "template",payload: payload}}
  })
}

bot.prototype.sendTextMessage = (senderId, messageText) => {
	return callSendAPI({
		recipient: {id: senderId},
		message: {text: messageText}
	})
}

bot.prototype.sendQuickReply = (senderId, msg, qkReplies) => {
	return callSendAPI({
		recipient: {id: senderId},
		message: {text: msg, quick_replies: qkReplies}
	})
}

bot.prototype.setup = (env,menu) => {
	page_token = env.FB_PAGE_ACCESS_TOKEN
	setGreetingText(env.FB_GREETING_TEXT)
	setStartButton()
	setPersistentMenu(menu)
}

module.exports = new bot()