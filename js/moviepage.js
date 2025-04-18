var moviePageLoaded;

if (moviePageLoaded == null) {
	moviePageLoaded = true;

	var prefixAWS = "http://dvk4w6qeylrn6.cloudfront.net";

	Node.prototype.hide = function(hideState) {
		if (hideState) {
			this.classList.add("hidden");
		} else {
			this.classList.remove("hidden");
		}
	};
	
	Node.prototype.isHidden = function() {
		return this.classList.contains("hidden");
	};
	
	String.prototype.splitLines = function() {
		return this.split(/\r\n|\r|\n/g);
	};
	
	function findID(id) {
		return document.getElementById(id);
	}
	
	function find(selector) {
		return document.querySelectorAll(selector);
	}
	
	function findOne(selector) {
		return document.querySelector(selector);
	}

	document.addEventListener("DOMContentLoaded", function() {
		const isIPhoneX = (screen.width>=812 || screen.height>=812);
		const smallScreen = screen.width<700;
	
		const pageNumberIndex = 0;
		const chainPlayIndex = 1;
		const videoVolumeIndex = 2;
		const pageTitleIndex = 3;
		const standardMovieIndex = 4;
		const HDMovieIndex = 5;
		const smallMovieIndex = 6;
		const chaptersIndex = 7;
		const thumbnailMovieIndex = 8;
		const fourKMovieIndex = 9;
		
		const widthIndex = 0;
		const heightIndex = 1;
		const movieNameIndex = 2;
		
		var currentMovieObj;
		var currentMovieWidth = 0;
		var currentMovieHeight = 0;
		var pageCount = 1000;
		
		var useAWS = false;
			
		function targetName(objectName) {
			if (prefixAWS != "") {
				var href = document.location.href;
				var domains = ["rickandrandy.com", "randyandrick.com", "ubillos.com", "portlandave.com", "randyubillos.com", "rickfath.com"];
				var matched = false;
				
				for (var i = 0; !matched && i<domains.length; i++) {
					matched = href.includes(domains[i]);
				}
				if (matched) {
					var elements = document.location.pathname.split("/");
					
					elements[0] = prefixAWS;
					elements[elements.length-1] = objectName;
					
					objectName = elements.join("/");
				}
			}
			
			return objectName;
		};
		
		function pathWithSearchTerm(path, searchTerm) {
			if (searchTerm.length > 0) {
				path = path + "?" + searchTerm;
			}
		
			return path;
		}
	
		function fullscreenActive() {
			if(typeof document.webkitIsFullScreen !== 'undefined') { return document.webkitIsFullScreen; }
			else if(typeof document.webkitFullscreenEnabled !== 'undefined') { return document.webkitFullscreenEnabled; }
			else if(typeof document.mozFullScreen !== 'undefined') { return document.mozFullScreen; }
			else if(typeof document.mozFullScreenEnabled !== 'undefined') { return document.mozFullScreenEnabled; }
			else if(typeof document.msFullscreenEnabled !== 'undefined') { return document.msFullscreenEnabled; }
			else if(typeof document.fullscreenEnabled !== 'undefined') { return document.fullscreenEnabled; }
			else { return false; }
		}
		
		function launchFullscreen() {
			var parent = currentMovieObj.parentElement;
			
			if (parent.requestFullscreen) { parent.requestFullscreen(); }
			else if (parent.mozRequestFullScreen) { parent.mozRequestFullScreen(); }
			else if (parent.webkitRequestFullscreen) { parent.webkitRequestFullscreen(); }
			else if (parent.msRequestFullscreen) { parent.msRequestFullscreen(); }
		}
	
		function exitFullscreen() {
			if (fullscreenActive()) {
				if(document.exitFullscreen) { document.exitFullscreen(); } 
				else if(document.mozCancelFullScreen) { document.mozCancelFullScreen(); } 
				else if(document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
			}
		}
		
		function toggleFullscreen() {
			if (fullscreenActive()) {
				exitFullscreen();
			} else {
				launchFullscreen();
			}
		}
				
		function findPageNumber() {
			var currentPageNumber = 1;
			var currentURL = document.location.pathname;
			var lastSegment = currentURL.substring(currentURL.lastIndexOf("/")+1, currentURL.lastIndexOf("."));
			var digitIndex = lastSegment.search(/\d/);
			
			if (digitIndex >=0) {
				currentPageNumber = parseInt(lastSegment.substr(digitIndex), 10);
			}
			
			return(currentPageNumber);
		}
		
		function setupChapterList(chaptersFile) {
			var chaptersObj = findID("chapters");
			var chapterSelect = findID("chapterselect");
			var haveChapters = false;

			if (chaptersObj && chapterSelect) {
				chaptersObj.hide(true)

				if (chaptersFile.length > 0) {
					var firstItem = chapterSelect.firstElementChild;

					haveChapters = true;

					chapterSelect.innerHTML = "";
					chapterSelect.appendChild(firstItem);

					fetch(chaptersFile)
						.then(response => response.text())
						.then(data => {
							var chapterRows = data.splitLines();

							chapterRows.forEach(function (chapterRow) {
								var chapterItems = chapterRow.split("\t");

								if (chapterItems.length === 2) {
									var newChapter = firstItem.cloneNode(true);

									newChapter.value = chapterItems[0];
									newChapter.textContent = chapterItems[1];
									chapterSelect.appendChild(newChapter);
								}
							});

							var chapterCount = chapterSelect.children.length - 1;
							firstItem.textContent = chapterCount + " Chapters";
							chaptersObj.title = "Use Up/Down Arrows to Browse";
							chaptersObj.hide(chapterCount === 0);
						});
				}
			}

			if (!haveChapters) {
				find("#index, .index").forEach(function (element) {
					element.parentElement.removeAttribute("width");
				});
				if (findID("current")) {
					findID("current").parentElement.removeAttribute("width");
				}
			}
		}
		
		function setPlayback(movieElement, doPlay) {
			var moviePlaying = !(movieElement.paused);
			
			if (moviePlaying != doPlay) {
				if (doPlay) {
					movieElement.play();
				} else {
					movieElement.pause();
				}
				setTimeout(function checkPlaying(desiredPlay, movElem) {
					if (desiredPlay != !(movElem.paused)) {
						if (desiredPlay) {
							movElem.play();
						} else {
							movElem.pause();
						}
					}
				}, 200, doPlay, movieElement);
			}
		}

		function togglePlayback(movieElement) {
			setPlayback(movieElement, movieElement.paused);
		}
		
		function showControls(movieElement, show) {
			if (show) {
				movieElement.setAttribute("controls", "");
			}
			else {
				movieElement.removeAttribute("controls");
			}
		}

		function playerClick(e) {
			movieElement = e.target;
			if (movieElement.getAttribute("controls") == undefined) {
				e.preventDefault();
				showControls(movieElement, true);
				togglePlayback(movieElement);
			}
		}

		function playerMove(e) {
			showControls(e.target, true);
		}
		
		function setupPlayPause(movieElement) {
			if (movieElement != null) {
				movieElement.addEventListener("play", function() {
					showControls(movieElement, false);
					movieElement.addEventListener("mousemove", playerMove);
					movieElement.addEventListener("click", playerClick);
				});
				movieElement.addEventListener("pause", function() {
					showControls(movieElement, true);
					movieElement.removeEventListener("mousemove", playerMove);
					movieElement.removeEventListener("click", playerClick);
				});
				movieElement.addEventListener("click", function(e) {
					if (e.offsetX < 50 && e.offsetY < 35) {
						if (fullscreenActive()) {
							setTimeout(function () {
								if (fullscreenActive()) {
									exitFullscreen();
								}
							}, 300);
						} else {
							setTimeout(function () {
								if (!fullscreenActive()) {
									launchFullscreen();
								}
							}, 300);
						}
					}
				});
			}
		}
		
		function setupMatte(minWidth) {
			var matte = findID("matte");
			if (!matte) {
				return false;
			}

			var windowWidth = window.innerWidth;
			var windowHeight = window.innerHeight;

			var minPadding = 30;
			var minMargin = 30;
			var matteMargin = 30;

			if (minWidth > windowWidth) {
				matteMargin = 0;
			} else if ((minWidth + 2 * minPadding + 2 * minMargin < windowWidth) && 
					   (minWidth + 0.5 * (windowWidth - minWidth) > 16.0 / 9.0 * windowHeight)) {
				if (16.0 / 9.0 * windowHeight > minWidth + 2 * minPadding) {
					matteMargin = 0.5 * (windowWidth - 16.0 / 9.0 * windowHeight);
				} else {
					matteMargin = 0.5 * (windowWidth - minWidth - 2 * minPadding);
				}
			} else {
				matteMargin = (windowWidth - minWidth) / 4.0;
			}

			matte.style.margin = `0 ${matteMargin}px`;

			var video = findOne("#photo video");
			if (video) {
				if (minWidth > windowWidth) {
					video.style.border = "0px";
				} else {
					video.style.border = "4px solid";
				}
			}

			return true;
		}

		function setupPage(movieRows, pageIndex) {
			var movieItems = movieRows[pageIndex].split("\t");
			var pageNumber = parseInt(movieItems[pageNumberIndex], 10);
			var searchTerm = document.location.search.substr(1);
			var loadingHD = false;
			var loading4K = false;
			var smallMovie = false;
			var movieInfo;
			var bigScreen = window.screen.width * window.devicePixelRatio >= 2500;
			var has4K = movieItems.length > fourKMovieIndex && movieItems[fourKMovieIndex].length > 0;
			var hasHD = movieItems.length > HDMovieIndex && movieItems[HDMovieIndex].length > 0;
			var hasSmall = movieItems.length > smallMovieIndex && movieItems[smallMovieIndex].length > 0;
			var chapters = (movieItems.length > chaptersIndex) ? movieItems[chaptersIndex] : "";
			var requestingSmall = searchTerm.includes("small");
			var requestingHD = hasHD && searchTerm.includes("HD");
			var requesting4K = has4K && searchTerm.includes("4K");

			if (hasSmall && requestingSmall) {
				movieInfo = movieItems[smallMovieIndex];
				smallMovie = true;
			} else if (hasSmall && smallScreen && !isIPhoneX && (requestingHD || requesting4K)) {
				movieInfo = movieItems[standardMovieIndex];
				smallMovie = true;
				loadingHD = true;
			} else if (has4K && !requestingHD && (requesting4K || bigScreen)) {
				movieInfo = movieItems[fourKMovieIndex];
				loading4K = true;
			} else if (requestingHD || requesting4K) {
				movieInfo = movieItems[HDMovieIndex];
				loadingHD = true;
			} else if (hasSmall && smallScreen && !isIPhoneX) {
				movieInfo = movieItems[smallMovieIndex];
				smallMovie = true;
			} else if (!smallScreen && hasHD) {
				movieInfo = movieItems[HDMovieIndex];
				requestingHD = true;
				loadingHD = true;
			} else {
				movieInfo = movieItems[standardMovieIndex];
			}

			var pathElements = movieInfo.split(",");
			var movieName = pathElements[movieNameIndex];
			var addHEVC = false;

			currentMovieWidth = pathElements[widthIndex];
			currentMovieHeight = pathElements[heightIndex];

			if (movieName.length == 3) {
				addHEVC = movieName.endsWith("H");
				movieName = movieName.slice(0, 2);
			} else if (movieName.includes("-HEVC")) {
				movieName = movieName.replace("-HEVC", "");
				addHEVC = true;
			}

			var hdPrompt = findID("hdprompt");
			var fourKPrompt = findID("4kprompt") || findID("fourkprompt");

			if (((hasHD && !loadingHD) || (has4K && !loading4K)) && !(hasSmall && requestingSmall)) {
				var prefix = document.location.href.includes("large") ? `large-${pageNumber}` : `index${pageNumber > 1 ? pageNumber : ""}`;

				if (has4K && !loading4K) {
					fourKPrompt.setAttribute("href", `${prefix}.html?4K`);
				} else {
					fourKPrompt.closest("td")?.remove();
					hdPrompt.closest("td")?.setAttribute("width", "100%");
					fourKPrompt.closest(".grow")?.remove();
				}

				if (hasHD && !requestingHD) {
					hdPrompt?.setAttribute("href", `${prefix}.html?HD`);
				} else {
					hdPrompt?.closest("td")?.remove();
					fourKPrompt?.closest("td")?.setAttribute("width", "100%");
					hdPrompt?.closest(".grow")?.remove();
				}

				if (smallMovie && !isIPhoneX) {
					if (hdPrompt) {
						hdPrompt.innerHTML = "Switch to HD";
					}
					fourKPrompt?.closest("td")?.remove();
					hdPrompt?.closest("td").setAttribute("width", "100%");
					fourKPrompt?.closest(".grow").remove();
				}
			} else {
				hdPrompt?.hide(true);
				fourKPrompt?.hide(true);
			}

			var heightNumber;
			switch (currentMovieHeight) {
				case "2160":
					heightNumber = "4K";
					break;
				case "1080":
					heightNumber = "1080HD";
					break;
				default:
					heightNumber = `${currentMovieHeight}p`;
					break;
			}

			var heightSuffix = ` <span id='vidheight' style='font-size: 50%;'>(${heightNumber})</span>`;

			var currentElement = findID("current");
			if (currentElement) {
				if (pageCount > 1) {
					currentElement.innerHTML = `${pageNumber} - ${movieItems[pageTitleIndex]}${heightSuffix}`;
				} else {
					currentElement.innerHTML = `${movieItems[pageTitleIndex]}${heightSuffix}`;
				}
			}

			if (pageNumber > 1) {
				var previousRef = findID("previousRef");
				if (previousRef) {
					var previousPageNumber = pageNumber - 1;
					previousRef.innerHTML = previousPageNumber;
					previousRef?.setAttribute("href", pathWithSearchTerm(`large-${previousPageNumber}.html`, searchTerm));
				}
			}
			findID("previous")?.hide(pageNumber === 1);

			if (pageNumber < pageCount) {
				var nextRef = findID("nextRef");
				if (nextRef) {
					var nextPageNumber = pageNumber + 1;
					nextRef.innerHTML = nextPageNumber;
					nextRef?.setAttribute("href", pathWithSearchTerm(`large-${nextPageNumber}.html`, searchTerm));
				}
			}
			findID("next")?.hide(pageNumber === pageCount);

			if (setupMatte(Number(currentMovieWidth))) {
				window.addEventListener("resize", function () {
					setupMatte(Number(currentMovieWidth));
				});
			}

			if (typeof pagewrap !== "undefined") {
				pagewrap.style.width = `${currentMovieWidth}px`;
			}

			if (movieName.length == 2) {
				var baseElements = movieItems[standardMovieIndex].split(",");
				movieName = baseElements[movieNameIndex]
					.replace("-HEVC", "")
					.replace(baseElements[heightIndex], currentMovieHeight)
					.replace(baseElements[widthIndex], currentMovieWidth)
					.replace(/p\d\d/, `p${movieName}`);
			}

			if (useAWS) {
				movieName = targetName(movieName);
			}

			currentMovieObj = smallMovie && !isIPhoneX ? findID("movie2") : findID("movie1");

			if (!currentMovieObj) {
				currentMovieObj = findID("video");
			}

			if (currentMovieObj) {
				var volume = movieItems[videoVolumeIndex];
				var minHeight = parseInt(window.getComputedStyle(currentMovieObj).getPropertyValue("min-height"), 10) || 540;

				if (smallScreen) {
					minHeight = 640 * (currentMovieHeight / currentMovieWidth);
					currentMovieObj.style.minHeight = `${minHeight}px`;
					find("#previous, #current, #next, #index").forEach(el => {
						el.style.fontSize = "1.4em";
					});
				}

				if (smallScreen && currentMovieHeight == 360) {
					addHEVC = false;
				}
				if (isIPhoneX && currentMovieHeight == 540) {
					addHEVC = false;
				}
				if (!currentMovieObj.canPlayType('video/mp4; codecs="hvc1"')) {
					addHEVC = false;
				}
				if (addHEVC) {
					var newVideo = document.createElement("video");
					newVideo.classList.add("hidden");
					newVideo.id = "movie1";
					newVideo.style.minHeight = `${minHeight}px`;
					newVideo.controls = true;
					newVideo.autoplay = true;

					function adjustHeight(vidElement) {
						const vidHeightElement = document.getElementById("vidheight");
						if (vidHeightElement) {
							let heightStr = `(${vidElement.videoHeight}p${vidElement.currentSrc.includes("-HEVC") ? " - HEVC" : ""})`
								.replace("1080p", "1080HD")
								.replace("2160p", "4K");
							vidHeightElement.textContent = heightStr;
						}
					}
					
					newVideo.addEventListener("loadedmetadata", function () {
						var curSrc = newVideo.currentSrc;

						currentMovieObj.style.minHeight = "";
						adjustHeight(newVideo);

						if (curSrc.includes("-HEVC")) {
							var label = findID("current");
							label.style.cursor = "pointer";

							label.addEventListener("click", function handleClick() {
								document.getElementById("fszoom")?.remove();
								origMovieObj.addEventListener("loadedmetadata", function () {
									origMovieObj.style.minHeight = "";
									adjustHeight(origMovieObj);
									document.head.appendChild(zoomStyle);
								});

								origMovieObj.src = movieName;
								origMovieObj.width = currentMovieWidth;
								origMovieObj.height = currentMovieHeight;
								origMovieObj.volume = volume;
								origMovieObj.hidden = false;
								newVideo.replaceWith(origMovieObj);
								currentMovieObj = origMovieObj;
								setupPlayPause(currentMovieObj);
								label.style.cursor = "";
								label.removeEventListener("click", handleClick);
							}, { once: true });
						}
					});

					var src1 = document.createElement("source");
					src1.type = 'video/mp4; codecs="hvc1"';
					src1.src = movieName.replace(".m", "-HEVC.m");

					var src2 = document.createElement("source");
					src2.type = 'video/mp4; codecs="avc1"';
					src2.src = movieName;

					newVideo.appendChild(src1);
					newVideo.appendChild(src2);

					if (movieName.includes("-2160p")) {
						var src1Clone = src1.cloneNode();
						var src2Clone = src2.cloneNode();
						src1Clone.src = movieName.replace("-2160p", "-1080p").replace(".m", "-HEVC.m");
						src2Clone.src = movieName.replace("-2160p", "-1080p");
						newVideo.appendChild(src1Clone);
						newVideo.appendChild(src2Clone);
					}

					currentMovieObj.replaceWith(newVideo);
					currentMovieObj = newVideo;
				} else {
					currentMovieObj.src = movieName;
				}

				currentMovieObj.width = currentMovieWidth;
				currentMovieObj.height = currentMovieHeight;
				currentMovieObj.volume = volume;
				currentMovieObj.classList.remove("hidden");
			}

			if ((parseInt(movieItems[chainPlayIndex], 10) & 1) && !searchTerm.includes("nochain")) {
				currentMovieObj.addEventListener("ended", function () {
					if (pageIndex + 1 < movieRows.length) {
						setupPage(movieRows, pageIndex + 1);
					}
				});
			}

			document.title = movieItems[pageTitleIndex];
			setupChapterList(chapters);
		}

		var targetRef = null;
		function setRef() {
			if (targetRef != null) {
				document.location.href = targetRef;
			}
		}

		fetch("movies.txt")
			.then(response => response.text())
			.then(data => {
				const currentPageNumber = findPageNumber();
				const movieRows = data.splitLines();
				const pageParams = movieRows[0].split(",");
				let foundIndex = -1;

				pageCount = parseInt(pageParams[0], 10);
				useAWS = (pageParams.length > 1) ? parseInt(pageParams[1], 10) : false;

				for (let i = 1; foundIndex === -1 && i < movieRows.length; i++) {
					if (movieRows[i].split("\t")[pageNumberIndex] == currentPageNumber) {
					foundIndex = i;
					}
				}

				if (foundIndex === -1) {
					const override = findID("movie1")?.getAttribute('indexoverride');
					if (override != null) {
					foundIndex = parseInt(override, 10);
					}
				}

				if (foundIndex !== -1) {
					setupPage(movieRows, foundIndex);
				}

				if (currentMovieObj != null && smallScreen && !findOne("meta[name='viewport']")) {
					const meta = document.createElement('meta');
					meta.name = "viewport";
					meta.content = "width=640";
					document.head.appendChild(meta);
				}

				if (currentMovieObj == null) {
					currentMovieObj = findOne("video");

					if (currentMovieObj != null) {
						if (pageCount === 0 && useAWS) {
							currentMovieObj.src = targetName(currentMovieObj.src);
						}
						currentMovieObj?.hide(false);
					}
				}

				setupPlayPause(currentMovieObj);

				if (typeof currentMovieObj?.canPlayType === 'undefined' || !currentMovieObj.canPlayType('video/mp4')) {
					const filler = `<div style="width:${currentMovieWidth}px; height:${currentMovieHeight}px;">
					<center><br><br><br><br><br>Your browser does not support this video.<br>Please use Safari or Chrome.</center>
					</div>`;
					currentMovieObj.insertAdjacentHTML('beforebegin', filler);
					currentMovieObj.remove();
				}

				if (document.location.search.length > 1 && document.location.href.includes("large")) {
					const indexRef = findOne("#index > a");
					if (indexRef) {
						indexRef.href += document.location.search;
					}
				}

				find("#index a, .index a").forEach(link => {
					link.href += `#${document.location.pathname.split('/').pop()}`;
				});

				findID("previous")?.setAttribute("title", "Previous (left arrow)");
				findID("next")?.setAttribute("title", "Next (spacebar or right arrow)");

				find("#footer > p, #footer > li").forEach(el => {
					if (!el.querySelector("a")) {
						const link = document.createElement("a");
						link.href = "../../index.html";
						link.innerHTML = el.innerHTML;
						el.innerHTML = "";
						el.appendChild(link);
					}
				});

				find(".grow > a, center > a").forEach(el => {
					if (!el.classList.contains("nomodify")) {
						el.style.backgroundColor = "#CCC";
						el.style.padding = "3px 15px";
					}
				});

				find("center > a").forEach(el => {
					if (!el.classList.contains("nomodify")) {
						el.parentElement.style.marginTop = "12px";
					}
				});

				if ("ontouchstart" in document.documentElement) {
					find("a").forEach(el => {
						el.style.touchAction = "manipulation";
					});
				}

				find(".row, ul#footer").forEach(el => {
					el.style.margin = "0 5px";
				});

				document.body.style.display = "inline";

				findID("pagewrap")?.hide(false);

				const chapterSelect = findID("chapterselect");
				if (chapterSelect) {
					chapterSelect.addEventListener("change", () => {
						if (currentMovieObj !== null) {
							let timecode = chapterSelect.value;
							let newTime = timecode;

							if (timecode.length > 0 && timecode.includes(":")) {
								const timeParts = timecode.split(":");
								let multiplier = 1.0 / 30.0;

								newTime = 0;

								for (let i = timeParts.length - 1; i >= 0; i--) {
									newTime += parseInt(timeParts[i], 10) * multiplier;

									if (multiplier < 1.0) {
										multiplier = 1.0;
									} else {
										multiplier *= 60;
									}
								}

								newTime *= 30.0 / 29.97;
							}

							if (newTime >= 0) {
								currentMovieObj.currentTime = newTime;
							}
						}
					});
				}

			document.addEventListener("keydown", event => {
				if (currentMovieObj !== null) {
					const movieElement = currentMovieObj;
					let numberElement = null;
					let handled = true;

					switch (event.key) {
						case "Tab":
							if (!fullscreenActive()) {
								toggleFullscreen();
								break;
							}
						// fall through
						case "b":
						case " ":
							togglePlayback(movieElement);
							break;
						case "PageUp":
						case "ArrowLeft":
							if (event.altKey) {
								movieElement.pause();
								movieElement.currentTime -= 1.0 / 60;
							} else if (!findID("previous")?.isHidden()) {
								numberElement = findOne("#previous a");
							}
							break;
						case "PageDown":
						case "ArrowRight":
							if (event.altKey) {
								movieElement.pause();
								movieElement.currentTime += 1.0 / 60;
							} else if (!findID("next")?.isHidden()) {
								numberElement = findOne("#next a") || findOne("#index a, .index a");
							}
							break;
						case "ArrowUp":
							if (event.altKey) {
								movieElement.currentTime -= 10;
								break;
							} else if (chapterSelect && chapterSelect.selectedIndex > 1) {
								chapterSelect.selectedIndex--;
								chapterSelect.dispatchEvent(new Event("change"));
								break;
							}
						// fall through
						case "i":
							if (!event.altKey && !event.shiftKey && !event.ctrlKey) {
								numberElement = findOne("#index a, .index a");
							} else {
								handled = false;
							}
							break;
						case "ArrowDown":
							if (event.altKey) {
								movieElement.currentTime += 10;
							} else if (chapterSelect && chapterSelect.selectedIndex < chapterSelect.children.length - 1) {
								chapterSelect.selectedIndex++;
								chapterSelect.dispatchEvent(new Event("change"));
							}
							break;
						case "Home":
							movieElement.currentTime = 0;
							break;
						case "End":
							movieElement.currentTime = movieElement.duration;
							break;
						case "f":
							if (!event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
								if (movieElement.currentTime < 10.0) {
									movieElement.pause();
									movieElement.currentTime = 0;
									movieElement.removeAttribute("controls");
									setTimeout(() => {
										if (currentMovieObj && currentMovieObj.paused) {
											currentMovieObj.play();
										}
									}, 1000);
								}
								toggleFullscreen(movieElement);
							} else {
								handled = false;
							}
							break;
						case "h":
							const hdprompt = findID("hdprompt");
							if (!hdprompt?.isHidden()) {
								numberElement = hdprompt;
							}
							break;
						default:
							handled = false;
							break;
					}

					if (numberElement) {
						targetRef = numberElement.href;

						if (fullscreenActive()) {
							exitFullscreen();
							setTimeout(setRef, 1000);
						} else {
							setRef();
						}
					}

					if (handled) {
						event.preventDefault();
					}
				}
			});
		});
	});
}
