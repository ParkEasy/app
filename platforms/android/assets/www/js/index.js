var app = angular.module("parkeasy", ["ngRoute", "ngCordova"]).
config(function($routeProvider) {
	$routeProvider.
	when("/hoursvoice", {
		templateUrl: "partials/hours_voice.html",
		controller: "HoursVoiceCtrl"
	}).
	when("/hourstouch", {
		templateUrl: "partials/hours_touch.html",
		controller: "HoursTouchCtrl"
	}).
	when("/map", {
		templateUrl: "partials/map.html",
		controller: "MapCtrl"
	}).
	when("/navi", {
		templateUrl: "partials/navi.html",
		controller: "NaviCtrl"
	}).
	when("/parked", {
		templateUrl: "partials/parked.html",
		controller: "ParkedCtrl"
	}).
	otherwise({
		redirectTo: "/map"
	});
});

// APP CONTROLLER
app.controller("AppCtrl", function($scope, $location, $cordovaGeolocation) {
	$scope.setRoute = function(route) {
		$location.path(route);
	}

	FastClick.attach(document.body);

	// demo
	$("#demo").on("click", function() {
		if ($("#demo").data("state") === "off") {

			$("#demo").html("Demo-Modus ausschalten");
			$("#demo").data("state", "on");
			window.demomode = true;
		} else {
			$("#demo").html("Demo-Modus einschalten");
			$("#demo").data("state", "off");
			window.demomode = false;
		}
	});

	document.addEventListener("deviceready", function() {

		ApiAIPlugin.init({
				subscriptionKey: "6914b4f2-2e33-42e5-8399-9afd80758713", // insert your subscription key here
				clientAccessToken: "229f0d220220457a8198feda054f7156", // insert your client access key here
				lang: "de" // set lang tag from list of supported languages
			},
			function(result) {
				console.log(JSON.stringify(result));
			},
			function(error) {
				console.log(JSON.stringify(error));
			}
		);

		// publish GPS
		var publishGPS = function(position) {
			window.speed = position.coords.speed;
			PubSub.publish("gps", position);
		};

		// call gps position every 2 seconds
		window.setInterval(function() {

			console.log("gps interval");

			if (!window.demomode) {

				$cordovaGeolocation
					.getCurrentPosition({
						timeout: 30000,
						enableHighAccuracy: true
					})
					.then(publishGPS);
			} else {
				$.getJSON("http://oca.la:8123/get", function(data) {

					// [[50.86727838067179,7.07387501182157,1,28,1,131.83305888840505]]

					if (data.length > 0) {
						var pos = {
							coords: {
								latitude: data[0][0],
								longitude: data[0][1],
								speed: data[0][3],
								heading: data[0][5]
							}
						};

						publishGPS(pos);
					}
				});
			}

		}, 2000);

	}, false);

});

// MAP CONTROLLER
app.controller("MapCtrl", function($scope, $location) {

	L.mapbox.accessToken = "pk.eyJ1IjoidG9tYXN6YnJ1ZSIsImEiOiJXWmNlSnJFIn0.xvLReqNnXy_wndeZ8JGOEA";
	var map = L.mapbox.map("map", "mapbox.streets", {
		zoomControl: false
	}).setView([50.935029, 6.953089], 15);

	var markers = {};
	var own;

	// on longpress -> go to hours input
	$("#map").longpress(function() {

		if (window.speed && window.speed > 1.5) {
			// longpress callback
			$scope.$apply(function() {
				$location.path("hoursvoice");
			});
		} else {
			// longpress callback
			$scope.$apply(function() {
				$location.path("hourstouch");
			});
		}

	}, 2000);

	map.on("dragstart", function() {
		window.pauseFit = true;
	});

	map.on("dragend", function() {
		window.draged = false;

		window.setTimeout(function() {
			window.pauseFit = false;
		}, 10000);
	});

	$(".leaflet-control-attribution").hide();
	$(".mapbox-logo").hide();

	// add the function to the list of subscribers for a particular topic
	// we're keeping the returned token, in order to be able to unsubscribe
	// from the topic later on
	var gps = function(msg, position) {

		var lat = position.coords.latitude;
		var lon = position.coords.longitude;
		var spd = Math.max(0, position.coords.speed);
		var hours = window.hours || 1;

		// load positions
		$.get("http://parkapi.azurewebsites.net/search?lat=" + lat + "&lon=" + lon + "&speed=" + spd + "&hours=" + hours, function(data) {

			if (data.state === "parking") {

				window.clearInterval(watch);
				window.detail = data.parking.id;

				$scope.$apply(function() {
					$location.path("parked");
					if ($location.refresh) $location.refresh();
				});
			} else {
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
							"alt": p.id
						})
							.bindLabel(parseFloat(p.price).toFixed(1) + "€", {
								noHide: true,
								direction: "auto"
							})
							.on("click", function(e) {
								window.detail = e.target.options.alt;
								$scope.$apply(function() {
									$location.path("navi");
									$location.replace();
								});

							})
							.addTo(map);
					}
				}

				var keys = Object.keys(markers);
				for (var m in keys) {
					if (ids.indexOf(keys[m]) < 0) {
						map.removeLayer(markers[keys[m]]);
						delete markers[keys[m]];
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

				if (!window.pauseFit) {

					// create list of markers
					var m = [own];
					for (var i in markers) {
						m.push(markers[i]);
					}
					var group = new L.featureGroup(m);

					map.fitBounds(group.getBounds(), {
						padding: [20, 20]
					});
				}
			}
		});
	};

	PubSub.subscribe("gps", gps);
	console.log("subscribe");

	// DESTROY event for controller
	$scope.$on("$destroy", function() {
		PubSub.unsubscribe(gps);
	});
});

// HOURSVOICE CONTROLLER 
app.controller("HoursVoiceCtrl", function($scope, $location) {

	window.hours = window.hours || 1;
	$scope.hours = window.hours;

	$(".apple-watch").swipe({
		swipeRight: function(event, direction, distance, duration, fingerCount) {
			//This only fires when the user swipes left
			$location.path("map");
			$location.replace();
		}
	});

	document.addEventListener("deviceready", function() {

		// play the audio file at url
		var question = new Media("http://translate.google.com/translate_tts?tl=de&q=Wie%20viele%20Stunden%20moechtest%20du%20parken?",

			// success callback
			function() {
				question.release();

				window.setTimeout(function() {

					// try starting a recording
					ApiAIPlugin.levelMeterCallback(function(level) {

						var circle = document.getElementById("circle");

						if (circle) {
							transform = "scale3d(" + (level + 1.0) + ", " + (level + 1.0) + ", " + (level + 1.0) + ")";
							circle.style.transform = transform;
							circle.style.webkitTransform = transform;
						}

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

							if (!response || !response.result.parameters) {
								var sorry = ["Tut mir Leid", "Sorry", "Oh weh", "Oh nein", "Entschuldige", "Mein Fehler", "Ups"];
								var greeting = sorry[Math.floor(Math.random() * sorry.length)];
								var siri_off = new Media("http://translate.google.com/translate_tts?tl=de&q=" + encodeURIComponent(greeting) + ".%20Das%20habe%20ich%20nicht%20verstanden.", function() {
									siri_off.release();

									// go back to map
									$scope.$apply(function() {
										$location.path("map");
									});

								}, function(err) {
									console.error(err);

									// go back to map
									$scope.$apply(function() {
										$location.path("map");
									});
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
								$scope.hours = hours;

								var okays = ["Alles klar", "In Ordnung", "Geht klar", "Okay", "Super", "OK"];
								var greeting = okays[Math.floor(Math.random() * okays.length)];
								var url = "http://translate.google.com/translate_tts?ie=UTF-8&q=" + encodeURIComponent(greeting) + "." + encodeURIComponent(value) + ".&tl=de-DE";

								var confirmation = new Media(url, function() {

									confirmation.release();

									// go back to map
									$scope.$apply(function() {
										$location.path("map");
									});

								}, function(err) {
									console.error(err);

									// go back to map
									$scope.$apply(function() {
										$location.path("map");
									});
								});

								confirmation.play();
							}
						},
						function(error) {

							ApiAIPlugin.cancelAllRequests();
							console.log(error);

							// place your error processing here
							var sorry = ["Tut mir Leid", "Oh nein", "Entschuldige", "Mein Fehler", "Ups"];
							var greeting = sorry[Math.floor(Math.random() * sorry.length)];
							var siri_off = new Media("http://translate.google.com/translate_tts?tl=de&q=" + encodeURIComponent(greeting) + ".%20Das%20habe%20ich%20nicht%20verstanden.", function() {
								siri_off.release();

								// go back to map
								$scope.$apply(function() {
									$location.path("map");
								});

							}, function(err) {
								console.error(err);

								// go back to map
								$scope.$apply(function() {
									$location.path("map");
								});
							});

							siri_off.play();
						});

				}, 500);
			},

			function(err) {

				// go back to map
				$scope.$apply(function() {
					$location.path("map");
				});

				console.log("playAudio(): Audio Error: " + err);
			}
		);

		// play audio
		question.play();

	}, false);

	//DESTROY event for controller
	$scope.$on("$destroy", function() {
		ApiAIPlugin.cancelAllRequests();
	});
});

// NAVI CONTROLLER
app.controller("NaviCtrl", function($scope, $location, $cordovaDeviceOrientation) {

	var gps, watchCompass;

	// get detail info by id
	$.getJSON("http://parkapi.azurewebsites.net/detail?id=" + window.detail, function(parking) {

		// find out streetname
		$.getJSON("http://router.project-osrm.org/nearest?loc=" + parking.Coordinates[1] + "," + parking.Coordinates[0], function(location) {
			$scope.street = location.name || parking.Name;
		});

		// GPS success callback
		gps = function(msg, position) {

			console.log(parking);

			var Parkhaus = {
				x: parking.Coordinates[0],
				y: parking.Coordinates[1]
			};

			window.position = position;

			var Standort = {
				x: position.coords.longitude,
				y: position.coords.latitude
			};

			var deltaX = Parkhaus.x - Standort.x;
			var deltaY = Parkhaus.y - Standort.y;

			var distsquare = deltaX * deltaX + deltaY * deltaY;
			var dist = Math.sqrt(distsquare) * 63781.37;

			$scope.$apply(function() {
				$scope.distance = "(" + parseInt(dist) + "m)";
			});

			// parked
			if (parseInt(dist) <= 7 && position.coords.speed <= 1) {
				window.detail = parking.Id;
				PubSub.unsubscribe(gps);
				window.clearInterval(watchCompass);
				$cordovaDeviceOrientation.clearWatch(watchCompass);
				$location.path("parked");
				$location.refresh();
			}

			if (window.demomode) {

				var point1 = {
					"type": "Feature",
					"properties": {},
					"geometry": {
						"type": "Point",
						"coordinates": [position.coords.longitude, position.coords.latitude]
					}
				};

				var point2 = {
					"type": "Feature",
					"properties": {},
					"geometry": {
						"type": "Point",
						"coordinates": [parking.Coordinates[0], parking.Coordinates[1]]
					}
				};

				var winkel = turf.bearing(point1, point2) % 360;
				var bearing = (winkel - position.coords.heading) % 360;

				console.log(position.coords.heading, winkel, bearing);

				var arr = document.getElementById("arrow");
				if (arr) {

					arr.style.transform = "rotate(" + bearing + "deg)";
					arr.style.webkitTransform = "rotate(" + bearing + "deg)";
				}
			}
		};

		PubSub.subscribe("gps", gps);

		document.addEventListener("deviceready", function() {

			// watch device orientation
			watchCompass = $cordovaDeviceOrientation.watchHeading({
				frequency: 2500,
				filter: true
			}).then(
				null,
				function(error) {},
				function(result) {

					var heading = result.magneticHeading || result.trueHeading;

					if (window.position && !window.demomode) {

						var point1 = {
							"type": "Feature",
							"properties": {},
							"geometry": {
								"type": "Point",
								"coordinates": [window.position.coords.longitude, window.position.coords.latitude]
							}
						};

						var point2 = {
							"type": "Feature",
							"properties": {},
							"geometry": {
								"type": "Point",
								"coordinates": [parking.Coordinates[0], parking.Coordinates[1]]
							}
						};

						var winkel = turf.bearing(point1, point2) % 360;
						var bearing = (winkel - heading) % 360;

						console.log(heading, winkel, bearing);

						var arr = document.getElementById("arrow");
						if (arr) {

							arr.style.transform = "rotate(" + bearing + "deg)";
							arr.style.webkitTransform = "rotate(" + bearing + "deg)";
						}
					}
				});
		});
	});

	$(".apple-watch").swipe({
		swipeRight: function(event, direction, distance, duration, fingerCount) {

			// this only fires when the user swipes left+
			PubSub.unsubscribe(gps);
			window.clearInterval(watchCompass);
			$cordovaDeviceOrientation.clearWatch(watchCompass);

			$location.path("map");
			$location.replace();
		}
	});

	// DESTROY event for controller
	$scope.$on("$destroy", function() {
		PubSub.unsubscribe(gps);
		$cordovaDeviceOrientation.clearWatch(watchCompass);
	});
});

// PARKED CONTROLLER
app.controller("ParkedCtrl", function($scope, $location) {

	$(".apple-watch").swipe({
		swipeRight: function(event, direction, distance, duration, fingerCount) {
			console.log("swipe");
			//This only fires when the user swipes left
			$scope.$apply(function() {
				$location.path("map");
				$location.replace();
			});
		}
	});

	$.getJSON("http://parkapi.azurewebsites.net/detail?id=" + window.detail, function(parking) {
		console.log(parking);

		$scope.$apply(function() {
			$scope.name = parking.Name;
		});
	});

	$("#freeQuestion").on("change", function(e) {

		if (window.detail) {
			var v = $(e.target).val();
			$.get("http://parkapi.azurewebsites.net/status?id=" + window.detail + "&amount=" + v, function(result) {
				console.log(result);
				if (result) {
					navigator.notification.alert("Deine Einschätzung wurde gespeichert.", function() {
						$scope.$apply(function() {
							$location.path("map");
							$location.replace();
						});

					}, "Danke!", "OK")
				}
			});
		}
	});
});

// HOURSTOUCH CONTROLLER
app.controller("HoursTouchCtrl", function($scope, $location) {

	window.hours = window.hours || 1;

	var hourspart = parseInt(window.hours);
	var minutespart = window.hours - hourspart;

	console.log(hourspart, minutespart);

	var min = (minutespart == 0.5) ? 5 : 0;

	$("#out2").val(hourspart);
	$("#out").val(min);

	$(".apple-watch").swipe({
		swipeRight: function(event, direction, distance, duration, fingerCount) {

			window.hours = parseFloat($("#out2").val() + "." + $("#out").val());

			navigator.notification.alert("Alles klar, " + window.hours + " Stunden", function() {

				$scope.$apply(function() {
					$location.path("map");
					$location.replace();
				});
			}, "Gespeichert!", "OK")

		}
	});
});