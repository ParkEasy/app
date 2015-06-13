/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var app = {
	// Application Constructor
	initialize: function() {
		this.bindEvents();
	},

	// Bind Event Listeners
	//
	// Bind any events that are required on startup. Common events are:
	// 'load', 'deviceready', 'offline', and 'online'.
	bindEvents: function() {
		document.addEventListener("deviceready", this.onDeviceReady, false);
		document.addEventListener("startrecording", this.recordHours, false);

		var mc = new Hammer.Manager(document.getElementById("case"));

		mc.add(new Hammer.Tap({
			event: "doubletap",
			taps: 2
		}));

		mc.on("doubletap", this.startHourInput);
	},

	// deviceready Event Handler
	//
	// The scope of 'this' is the event. In order to call the 'receivedEvent'
	// function, we must explicitly call 'app.receivedEvent(...);'
	onDeviceReady: function() {
		FastClick.attach(document.body);

		ApiAIPlugin.init({
				subscriptionKey: "6914b4f2-2e33-42e5-8399-9afd80758713", // insert your subscription key here
				clientAccessToken: "229f0d220220457a8198feda054f7156", // insert your client access key here
				lang: "de" // set lang tag from list of supported languages
			},
			function(result) {},
			function(error) {
				console.log(JSON.stringify(error));
			}
		);
	},

	// startHourInput Event Handler
	startHourInput: function() {

		console.log("doubletap");

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

					// check if it was stunden or minuten
					if (std != "") {
						var hour = parseInt(std);
						if (hour == 1) {
							value = hour + " Stunde";
						} else {
							value = hours + " Stunden";
						}
					} else if (min != "") {
						var minute = parseInt(min);
						value = minute + " Minuten";
					}

					var okays = ["Alles klar", "In Ordnung", "Geht klar", "Sehr wohl", "Okay", "Super", "OK"];
					var greeting = okays[Math.floor(Math.random() * okays.length)];
					var url = "http://translate.google.com/translate_tts?ie=UTF-8&q=" + encodeURIComponent(greeting) + "." + encodeURIComponent(value) + ".&tl=de-DE";

					var confirmation = new Media(url, function() {
						confirmation.release();
					}, function(err) {
						console.error(err);
					});
				}
			},
			function(error) {

				ApiAIPlugin.cancelAllRequests();
				console.log(error);

				// http://translate.google.com/translate_tts?tl=de&q=Tut%20mir%20Leid,%20das%20habe%20ich%20nicht%20verstanden.

				// place your error processing here
				var sorry = ["Tut mir Leid", "Sorry", "Oh weh", "Oh nein", "Entschuldige", "Mein Fehler", "Ups"];
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