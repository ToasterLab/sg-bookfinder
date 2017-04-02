var app = new Vue({
	el: '#app',
	data: {
		oauth: null,
		books: null
	},
	methods: {
		login: function(){
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
		checkShelf: function(){
			this.$http.post('/user', {user: user}).then(response => {
				if(response.body.constructor === Object && "error" in response.body){
					console.error(response.body.error)
				} else {app.books = response.body;}
			})
		},
		openBook: function(book){window.location.href=book.url;}
	}
})

let user = localStorage.getItem("user");

if(user === null){
	app.login();
} else {
	app.oauth = JSON.parse(user);
	app.checkShelf();
}