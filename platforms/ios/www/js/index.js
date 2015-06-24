var app = angular.module("parkeasy", ["ngRoute", "ngCordova"]).
config(function($routeProvider) {
	$routeProvider.
	when("/hours", {
		templateUrl: "partials/hours.html",
		controller: "HoursCtrl"
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
app.controller("AppCtrl", function($scope, $location) {
	$scope.setRoute = function(route) {
		$location.path(route);
	}

	FastClick.attach(document.body);

	document.addEventListener("deviceready", function() {

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

	}, false);
});

// MAP CONTROLLER
app.controller("MapCtrl", function($scope, $cordovaGeolocation, $location) {

	L.mapbox.accessToken = "pk.eyJ1IjoidG9tYXN6YnJ1ZSIsImEiOiJXWmNlSnJFIn0.xvLReqNnXy_wndeZ8JGOEA";
	var map = L.mapbox.map("map", "mapbox.streets", {
		zoomControl: false
	}).setView([50.935029, 6.953089], 15);

	var markers = {};
	var own;

	// on longpress -> go to hours input
	$("#map").longpress(function() {

		// longpress callback
		$scope.$apply(function() {
			$location.path("hours");
		});

	}, {
		duration: 2000
	});

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
						"alt": p.id
					})
						.bindLabel(p.price + "€", {
							noHide: true,
							direction: "auto"
						})
						.on("click", function(e) {
							window.detail = e.target.options.alt;
							$scope.$apply(function() {
								$location.path("navi");
							});
						})
						.addTo(map);
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
		});
	}

	var watch;

	document.addEventListener("deviceready", function() {

		$cordovaGeolocation
			.getCurrentPosition({
				timeout: 30000,
				enableHighAccuracy: true
			})
			.then(onSuccess);

		// call gps position every 2 seconds
		watch = window.setInterval(function() {

			$cordovaGeolocation
				.getCurrentPosition({
					timeout: 30000,
					enableHighAccuracy: true
				})
				.then(onSuccess);

		}, 2000);
	});

	// DESTROY event for controller
	$scope.$on("$destroy", function() {
		window.clearInterval(watch);
	});
});

// HOURS CONTROLLER 
app.controller("HoursCtrl", function($scope, $location) {

	window.hours = window.hours || 1;
	$scope.hours = window.hours;

	$(".apple-watch").swipe({
		swipeRight: function(event, direction, distance, duration, fingerCount) {
			//This only fires when the user swipes left
			$scope.$apply(function() {
				$location.path("map");
			});
		}
	});

	document.addEventListener("deviceready", function() {

		// play the audio file at url
		var question = new Media("http://translate.google.com/translate_tts?tl=de&q=Wie%20viele%20Stunden%20m%C3%B6chtest%20du%20parken?",

			// success callback
			function() {
				question.release();

				// play siri start sound
				var siri_on = new Media("sounds/siri_on.mp3", function() {

						siri_on.release();

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
					},
					function(err) {
						console.error(err);

						// go back to map
						$scope.$apply(function() {
							$location.path("map");
						});
					});

				siri_on.play();
			},

			function(err) {

				// go back to map
				$scope.$apply(function() {
					$location.path("map");
				});

				console.log("playAudio():Audio Error: " + err);
			}
		);

		// play audio
		question.play();

	}, false);

	// DESTROY event for controller
	$scope.$on("$destroy", function() {
		ApiAIPlugin.cancelAllRequests();
	});
});

// NAVI CONTROLLER
app.controller("NaviCtrl", function($scope, $cordovaGeolocation, $location, $cordovaDeviceOrientation) {

	var watchGPS, watchCompass;

	// get detail info by id
	$.getJSON("http://parkapi.azurewebsites.net/detail?id=" + window.detail, function(parking) {

		// find out streetname
		$.getJSON("http://router.project-osrm.org/nearest?loc=" + parking.Coordinates[1] + "," + parking.Coordinates[0], function(location) {
			$scope.street = location.name || "";
		});

		// GPS success callback
		function onSuccess(position) {

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

			$scope.distance = "(" + parseInt(dist) + "m)";
		}

		document.addEventListener("deviceready", function() {

			$cordovaGeolocation
				.getCurrentPosition({
					timeout: 30000,
					enableHighAccuracy: true
				})
				.then(onSuccess);

			// call gps position every 2 seconds
			watchGPS = window.setInterval(function() {

				$cordovaGeolocation
					.getCurrentPosition({
						timeout: 30000,
						enableHighAccuracy: true
					})
					.then(onSuccess);

			}, 2000);

			// watch device orientation
			watchCompass = $cordovaDeviceOrientation.watchHeading({
				frequency: 1000,
				filter: true
			}).then(
				null,
				function(error) {},
				function(result) {

					console.log(result);

					var magneticHeading = result.magneticHeading;
					var trueHeading = result.trueHeading;

					if (window.position) {
						var Parkhaus = {
							x: parking.Coordinates[0],
							y: parking.Coordinates[1]
						};

						var Standort = {
							x: window.position.coords.longitude,
							y: window.position.coords.latitude
						};

						var deltaX = Parkhaus.x - Standort.x;
						var deltaY = Parkhaus.y - Standort.y;
						var rad = Math.atan2(deltaY, deltaX);

						var winkel = rad * (180 / Math.PI) % 360;

						var bearing = winkel - magneticHeading % 360;

						document.getElementById("arrow").style.transform = "rotate(" + bearing + "deg)";
					}
				});
		});
	});

	$(".apple-watch").swipe({
		swipeRight: function(event, direction, distance, duration, fingerCount) {

			// this only fires when the user swipes left
			$scope.$apply(function() {
				$location.path("map");
			});
		}
	});

	// DESTROY event for controller
	$scope.$on("$destroy", function() {
		window.clearInterval(watchGPS);
		watchCompass.clearWatch();
	});
});

// PARKED CONTROLLER
app.controller("ParkedCtrl", function($scope) {

});