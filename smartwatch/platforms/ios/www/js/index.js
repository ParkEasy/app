var app = {
	// Application Constructor
	initialize: function() {
		this.bindEvents();
		this.screen_map();
	},

	// Bind Event Listeners
	//
	// Bind any events that are required on startup. Common events are:
	// "load", "deviceready", "offline", and "online".
	bindEvents: function() {
		document.addEventListener("deviceready", this.onDeviceReady, false);
		document.addEventListener("startrecording", this.recordHours, false);

		var that = this;

		$(".apple-watch, #map").longpress(function() {
			// longpress callback
			that.startHourInput();
		});
	},


	// SCREEN: MAP
	screen_map: function() {
		L.mapbox.accessToken = "pk.eyJ1IjoidG9tYXN6YnJ1ZSIsImEiOiJXWmNlSnJFIn0.xvLReqNnXy_wndeZ8JGOEA";
		var map = L.mapbox.map("map", "mapbox.streets", {
			zoomControl: false
		}).setView([50.935029, 6.953089], 15);

		var markers = {};
		var own;

		$(".leaflet-control-attribution").hide();
		$(".mapbox-logo").hide();

		// currentPosition Sucess Event Handler
		function onSuccess(position) {

			var lat = position.coords.latitude;
			var lon = position.coords.longitude;
			var spd = Math.max(0, position.coords.speed);
			var hours = window.hours || 1;

			// load positions
			$.get("http://parkapi.azurewebsites.net/search?lat=" + lat + "&lon=" + lon + "&speed=" + spd + "&hours=" + hours, function(data) {

				var ids = [];
				for (var d in data.parking) {

					var p = data.parking[d];
					ids.push(p.id);

					if (!markers[p.id]) {
						markers[p.id] = L.marker([p.coord[1], p.coord[0]], {
							"icon": L.mapbox.marker.icon({
								"marker-size": "large",
								"marker-symbol": "parking",
								"marker-color": "#3498db"
							}),
							"alt": p.name
						}).addTo(map);
					}
				}

				var keys = Object.keys(markers);
				for (var m in keys) {
					if (ids.indexOf(keys[m]) < 0) {
						map.removeLayer(markers[keys[m]]);
					}
				}

				// add or update own position
				if (!own) {
					own = L.marker([lat, lon], {
						"icon": L.mapbox.marker.icon({
							"marker-size": "large",
							"marker-symbol": "car",
							"marker-color": "#e74c3c"
						})
					}).addTo(map);

				} else {
					own.setLatLng([lat, lon]);
				}

				map.panTo([lat, lon]);
			});

		};

		// onError Callback receives a PositionError object
		function onError(error) {
			alert('code: ' + error.code + '\n' +
				'message: ' + error.message + '\n');
		}

		// call gps position every 2.5 seconds
		window.setInterval(function() {
			navigator.geolocation.getCurrentPosition(onSuccess, onError);
		}, 2500);

	},

	// deviceready Event Handler
	//
	// The scope of "this" is the event. In order to call the "receivedEvent"
	// function, we must explicitly call "app.receivedEvent(...);"
	onDeviceReady: function() {
		FastClick.attach(document.body);

		ApiAIPlugin.init({
				subscriptionKey: "6914b4f2-2e33-42e5-8399-9afd80758713", // insert your subscription key here
				clientAccessToken: "229f0d220220457a8198feda054f7156", // insert your client access key here
				lang: "de" // set lang tag from list of supported languages
			},
			function(result) {
				console.log(JSON.stringify(error));
			},
			function(error) {
				console.log(JSON.stringify(error));
			}
		);
	},

	// startHourInput Event Handler
	startHourInput: function() {

		// play the audio file at url
		var question = new Media("http://translate.google.com/translate_tts?tl=de&q=Wie%20viele%20Stunden%20m%C3%B6chtest%20du%20parken?",

			// success callback
			function() {
				question.release();

				// play siri start sound
				var siri_on = new Media("sounds/siri_on.mp3", function() {

						siri_on.release();

						var e = new CustomEvent("startrecording");
						document.dispatchEvent(e);
					},
					function(err) {
						console.error(err);
					});

				siri_on.play();
			},

			function(err) {
				console.log("playAudio():Audio Error: " + err);
			}
		);

		// play audio
		question.play();
	},

	// RECORD HOURS
	recordHours: function() {

		// try starting a recording
		ApiAIPlugin.levelMeterCallback(function(level) {

			var circle1 = document.getElementById("mycircle1");

			transform = "scale3d(" + (level + 1.0) + ", " + (level + 1.0) + ", " + (level + 1.0) + ")";
			circle1.style.transform = transform;
			circle1.style.webkitTransform = transform;

			console.log(transform);
		});

		ApiAIPlugin.setListeningStartCallback(function() {
			console.log("listen start");
		});

		ApiAIPlugin.setListeningFinishCallback(function() {
			console.log("listen stop");
		});

		ApiAIPlugin.requestVoice({}, // empty for simple requests, some optional parameters can be here
			function(response) {

				console.log(response.result);

				if (!response.result.parameters) {
					var sorry = ["Tut mir Leid", "Sorry", "Oh weh", "Oh nein", "Entschuldige", "Mein Fehler", "Ups"];
					var greeting = sorry[Math.floor(Math.random() * sorry.length)];
					var siri_off = new Media("http://translate.google.com/translate_tts?tl=de&q=" + encodeURIComponent(greeting) + ".%20Das%20habe%20ich%20nicht%20verstanden.", function() {
						siri_off.release();
					}, function(err) {
						console.error(err);
					});

					siri_off.play();

				} else {

					// place your result processing here
					var std = response.result.parameters.Stunden;
					var min = response.result.parameters.Minuten;

					var value = "";
					var hours = 0.0;

					// check if it was stunden or minuten
					if (std != "") {
						var hour = hours = parseInt(std);
						if (hour == 1) {
							value = hour + " Stunde";
						} else {
							value = hour + " Stunden";
						}
					} else if (min != "") {
						var minute = parseInt(min);
						hours = minute / 60.0;
						value = minute + " Minuten";
					}

					window.hours = hours;

					var okays = ["Alles klar", "In Ordnung", "Geht klar", "Okay", "Super", "OK"];
					var greeting = okays[Math.floor(Math.random() * okays.length)];
					var url = "http://translate.google.com/translate_tts?ie=UTF-8&q=" + encodeURIComponent(greeting) + "." + encodeURIComponent(value) + ".&tl=de-DE";

					var confirmation = new Media(url, function() {
						confirmation.release();
					}, function(err) {
						console.error(err);
					});

					confirmation.play();
				}
			},
			function(error) {

				ApiAIPlugin.cancelAllRequests();
				console.log(error);

				// http://translate.google.com/translate_tts?tl=de&q=Tut%20mir%20Leid,%20das%20habe%20ich%20nicht%20verstanden.

				// place your error processing here
				var sorry = ["Tut mir Leid", "Oh nein", "Entschuldige", "Mein Fehler", "Ups"];
				var greeting = sorry[Math.floor(Math.random() * sorry.length)];
				var siri_off = new Media("http://translate.google.com/translate_tts?tl=de&q=" + encodeURIComponent(greeting) + ".%20Das%20habe%20ich%20nicht%20verstanden.", function() {
					siri_off.release();
				}, function(err) {
					console.error(err);
				});

				siri_off.play();
			});
	}
};