/* jshint asi:true */

let computeSlength =  () => {
			app.selected.slength = app.oauth.shelves.filter(s => (s.name === app.selected.shelf))[0]["book_count"]._
		}
let wSend = (ws, event, data) => {ws.send(JSON.stringify({event:event,data:data}))}
let user = localStorage.getItem("user")

var socket = new WebSocket(`ws://${location.host}`)

var app = new Vue({
	el: '#app',
	data: {
		oauth: null,
		books: [],
		loading: true,
		selected: {
			shelf:null,
			lib: "BIPL",
			slength:null
		},
		bookfinding: false,
		libraries: [{"id":"AMKPL","name":"Ang Mo Kio Public Library"},{"id":"BEPL","name":"Bedok Public Library"},{"id":"BIPL","name":"Bishan Public Library"},{"id":"BBPL","name":"Bukit Batok Public Library"},{"id":"BMPL","name":"Bukit Merah Public Library"},{"id":"BPPL","name":"Bukit Panjang Public Library"},{"id":"CLL","name":"Central Public Library"},{"id":"CSPL","name":"Cheng San Public Library"},{"id":"CCKPL","name":"Choa Chu Kang Public Library"},{"id":"CMPL","name":"Clementi Public Library"},{"id":"GEPL","name":"Geylang East Public Library"},{"id":"JRL","name":"Jurong Regional Library"},{"id":"JWPL","name":"Jurong West Public Library"},{"id":"LKCRL","name":"Lee Kong Chian Reference Library"},{"id":"11LKCRL","name":"Lee Kong Chian Reference Library Level 11"},{"id":"07LKCRL","name":"Lee Kong Chian Reference Library Level 7"},{"id":"08LKCRL","name":"Lee Kong Chian Reference Library Level 8"},{"id":"09LKCRL","name":"Lee Kong Chian Reference Library Level 9"},{"id":"LSC","name":"Library Supply Centre"},{"id":"LSCAV","name":"Library Supply Centre for AV"},{"id":"CNPL","name":"Library@Chinatown"},{"id":"EPPL","name":"Library@Esplanade"},{"id":"OCPL","name":"Library@Orchard"},{"id":"MPPL","name":"Marine Parade Public Library"},{"id":"MOLLEY","name":"Mobile Bus"},{"id":"LOLC","name":"NL Heritage"},{"id":"PRPL","name":"Pasir Ris Public Library"},{"id":"QUPL","name":"Queenstown Public Library"},{"id":"SBPL","name":"Sembawang Public Library"},{"id":"SKPL","name":"Sengkang Public Library"},{"id":"SRPL","name":"Serangoon Public Library"},{"id":"TRL","name":"Tampines Regional Library"},{"id":"TPPL","name":"Toa Payoh Public Library"},{"id":"WRL","name":"Woodlands Regional Library"},{"id":"YIPL","name":"Yishun Public Library"}]
	},
	methods: {
		login: function () {
			this.$http.get('/login').then(response => {
				// get body data
				if("url" in response.body){
					window.location.href = response.body.url.url;
				}
				if("error" in response.body){console.error(response.body.error)}
			}, response => {
				console.error(response)
			});
		},
		checkShelf: () => {
			app.bookfinding = true
			wSend(socket, "getBooks", {user: app.oauth, selected: app.selected})
		},
		openBook: function(book){window.location.href=book[0].url}
	},
	watch: {
		"selected.shelf": computeSlength
	}
})

if(user === null){
	app.login()
} else {
	app.oauth = JSON.parse(user)
	socket.addEventListener('open', function (event) {
  	wSend(socket, "retrieveUser", app.oauth)
	})
	socket.addEventListener('message', function (event) { //event.data
		let result = JSON.parse(event.data)
		console.log(result)
    switch(result.event){
    	case "sendUser":
    		app.loading = false
    		Object.assign(app.oauth, result.data)
				app.selected.shelf = app.oauth.shelves[2].name
				computeSlength()
				app.checkShelf()
    		break
    	case "sendBooks":
    		app.books.push(result.data)
    		break
    	case "endBooks":
    		app.bookfinding = false
    		app.books = result.data
    		break
    	case "error":
    		console.error(result.data)
    		break
    }
	})
}

