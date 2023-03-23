var moviePageLoaded;

if (moviePageLoaded == null) {
	moviePageLoaded = true;

	var prefixAWS = "http://dvk4w6qeylrn6.cloudfront.net";

	$(function(){
		var isIPhoneX = (screen.width==812 || screen.height==812);
		var smallScreen = screen.width<700;
	
		var pageNumberIndex = 0;
		var chainPlayIndex = 1;
		var videoVolumeIndex = 2;
		var pageTitleIndex = 3;
		var standardMovieIndex = 4;
		var HDMovieIndex = 5;
		var smallMovieIndex = 6;
		var chaptersIndex = 7;
		var thumbnailMovieIndex = 8;
		var fourKMovieIndex = 9;
		
		var widthIndex = 0;
		var heightIndex = 1;
		var movieNameIndex = 2;
		
		var $currentMovieObj;
		var currentMovieWidth = 0;
		var currentMovieHeight = 0;
		var pageCount = 1000;
		
		var useAWS = false;
			
		function targetName(objectName) {
			var href = document.location.href;
			var domains = ["rickandrandy.com", "randyandrick.com", "ubillos.com", "portlandave.com", "randyubillos.com", "rickfath.com"];
			var matched = false;
			
			for (var i = 0; !matched && i<domains.length; i++) {
				matched = href.contains(domains[i]);
			}
			if (matched) {
				var elements = document.location.pathname.split("/");
				
				elements[0] = prefixAWS;
				elements[elements.length-1] = objectName;
				
				objectName = elements.join("/");
			}
			
			return objectName;
		};
		
		$.fn.isHidden = function(){
			return $(this).hasClass("hidden");
	  	};
	
		$.fn.hidden = function(hideState){
			if (hideState) { $(this).addClass("hidden"); }
			else { $(this).removeClass("hidden"); }
	  	};
	
		String.prototype.contains = function(substring) {
			return this.indexOf(substring) !== -1;
		};
		
		String.prototype.splitLines = function() {
			return this.split(/\r\n|\r|\n/g);
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
			var parent = $currentMovieObj.parent()[0]
			
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
			var $chaptersObj = $("#chapters");
			var $chapterSelect = $("#chapterselect");
			var haveChapters = false;
			
			if ($chaptersObj !== null && $chapterSelect !== null) {
				$chaptersObj.hidden(true);
		
				if (chaptersFile.length > 0) {
					var $firstItem = $chapterSelect.children().first();
					
					haveChapters = true;
					
					$chapterSelect.empty();
					$firstItem.appendTo($chapterSelect);
					
					$.get(chaptersFile, function(data) {
						var chapterRows = data.splitLines();
						
						chapterRows.forEach(function(chapterRow){
							var chapterItems = chapterRow.split("\t");
							
							if (chapterItems.length == 2) {
								var $newChapter = $firstItem.clone();
								
								$newChapter.attr("value", chapterItems[0]);
								$newChapter.html(chapterItems[1]);
								$newChapter.appendTo($chapterSelect);
							}
						});
						
						var chapterCount = $chapterSelect[0].length-1;
						$firstItem.html(chapterCount+" Chapters");
						$chaptersObj.attr("title", "Use Up/Down Arrows to Browse");
						$chaptersObj.hidden(chapterCount===0);
					});
				}
			}
			
			if (!haveChapters) {
				$("#index,.index").each(function(){
					$(this).parent().removeAttr("width");
				});
				$("#current").parent().removeAttr("width");
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
			movieElement = e.data;
			if (movieElement.getAttribute("controls") == undefined) {
				e.preventDefault();
				showControls(movieElement, true);
				togglePlayback(movieElement);
			}
		}

		function playerMove(e) {
			showControls(e.data, true);
		}
		
		function setupPlayPause($movieObj) {
			if ($movieObj != null) {
				var movieElement = $movieObj[0];

				$movieObj.on("play", function() {
					showControls(movieElement, false);
					$movieObj.one("mousemove", movieElement, playerMove);
					$movieObj.one("click", movieElement, playerClick);
				});
				$movieObj.on("pause", function() {
					showControls(movieElement, true);
					$movieObj.off("mousemove", playerMove)
					$movieObj.off("click", playerClick)
				});
				$movieObj.on("click", function (e) {
					if (e.offsetX < 50 && e.offsetY < 35) {
						if (fullscreenActive()) {
							setTimeout(function () {
								if (fullscreenActive()) {
									exitFullscreen();
								}
							}, 300);
						}
						else {
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
		
		function setupPage(movieRows, pageIndex) {
			var movieItems = movieRows[pageIndex].split("\t");
			var pageNumber = parseInt(movieItems[pageNumberIndex], 10);
			var searchTerm = document.location.search.substr(1);
			var loadingHD = false;
			var loading4K = false;
			var smallMovie = false;
			var movieInfo;
			var has4K = movieItems.length>fourKMovieIndex && movieItems[fourKMovieIndex].length > 0;
			var hasHD = movieItems.length>HDMovieIndex && movieItems[HDMovieIndex].length > 0;
			var hasSmall =  movieItems.length>smallMovieIndex && movieItems[smallMovieIndex].length > 0;
			var chapters = (movieItems.length>chaptersIndex) ? movieItems[chaptersIndex] : "";
			var requestingSmall = searchTerm.contains("small");
			var requestingHD = hasHD && searchTerm.contains("HD");
			var requesting4K = has4K && searchTerm.contains("4K");
			
			if (hasSmall && requestingSmall) {
				movieInfo = movieItems[smallMovieIndex];
				smallMovie = true;
			} else if (hasSmall && smallScreen && !isIPhoneX && (requestingHD || requesting4K)) {
				movieInfo = movieItems[standardMovieIndex];
				smallMovie = true;
				loadingHD = true;
			} else if (requesting4K && has4K) {
				movieInfo = movieItems[fourKMovieIndex];
				loading4K = true;
			} else if (requestingHD || requesting4K) {
				movieInfo = movieItems[HDMovieIndex];
				loadingHD = true;
			} else if (hasSmall && smallScreen && !isIPhoneX) {
				movieInfo = movieItems[smallMovieIndex];
				smallMovie = true;
			} else {
				movieInfo = movieItems[standardMovieIndex];
			}
			
			var pathElements = movieInfo.split(",");
			var movieName = pathElements[movieNameIndex];
			var addHEVC = false;
			
			currentMovieWidth = pathElements[widthIndex];
			currentMovieHeight = pathElements[heightIndex];
	
			if (movieName.length==3) {
				addHEVC = movieName.endsWith("H");
				movieName = movieName.slice(0, 2);
			}
			else if (movieName.contains("-HEVC")) {
				movieName = movieName.replace("-HEVC", "");
				addHEVC = true;
			}
			
			var $hdprompt = $("#hdprompt");
			var $4kprompt = $("#4kprompt");
	
			if (((hasHD && !loadingHD) || (has4K && !loading4K)) && !(hasSmall && requestingSmall)) {
				var prefix;
				
				if (document.location.href.contains("large")) {
					prefix = "large-"+pageNumber;
				} else {
					prefix = "index" + ((pageNumber>1) ? pageNumber : "");
				}
				
				if (has4K && !requesting4K) {
					$4kprompt.attr("href", prefix+".html?4K");
				}
				else {
					$4kprompt.closest("td").remove();
					$hdprompt.closest("td").attr("width", "100%")
					$4kprompt.closest(".grow").remove();
				}
				
				if (hasHD && !requestingHD) {
					$hdprompt.attr("href", prefix+".html?HD");
				}
				else {
					$hdprompt.closest("td").remove();
					$4kprompt.closest("td").attr("width", "100%")
					$hdprompt.closest(".grow").remove();
				}
				
				if (smallMovie && !isIPhoneX) {
					$hdprompt.html("Switch to HD");
					$4kprompt.closest("td").remove();
					$hdprompt.closest("td").attr("width", "100%")
					$4kprompt.closest(".grow").remove();
				}
			} else {
				$hdprompt.hidden(true);
				$4kprompt.hidden(true);
			}
			
			var heightNumber;
			
			switch (currentMovieHeight) {
				case "2160":		heightNumber = "4K";			break;
				case "1080":		heightNumber = "1080HD";	break;
				default:			heightNumber = "" + currentMovieHeight + "p";	break;
			}
			
			var heightSuffix = " (" + heightNumber + ")";
			
			if (pageCount > 1) {
				$("#current").html(pageNumber+" - "+movieItems[pageTitleIndex] + heightSuffix);			
			} else {
				$("#current").html(movieItems[pageTitleIndex] + heightSuffix);
			}
		
			if (pageNumber > 1) {
				var $previousRef = $("#previousRef");
				var previousPageNumber = pageNumber-1;
				$previousRef.html(previousPageNumber);
				$previousRef.attr("href", pathWithSearchTerm("large-"+previousPageNumber+".html", searchTerm));
			}
			$("#previous").hidden(pageNumber==1);
			
			if (pageNumber < pageCount) {
				var $nextRef = $("#nextRef");
				var nextPageNumber = pageNumber+1;
				$nextRef.html(nextPageNumber);
				$nextRef.attr("href", pathWithSearchTerm("large-"+nextPageNumber+".html", searchTerm));
			}
			$("#next").hidden(pageNumber==pageCount);
				
			if (typeof pagewrap !== 'undefined' ) {
				pagewrap.style.width = currentMovieWidth + "px";
			}
			
			if (movieName.length==2) {
				var baseElements = movieItems[standardMovieIndex].split(",");
				movieName = baseElements[movieNameIndex].replace("-HEVC", "").replace(baseElements[heightIndex], currentMovieHeight).replace(baseElements[widthIndex], currentMovieWidth).replace(/p\d\d/, "p"+movieName);
			}
			
			if (useAWS) {
				movieName = targetName(movieName);
			}
				
			$currentMovieObj = (smallMovie && !isIPhoneX) ? $("#movie2") : $("#movie1");
			
			if ($currentMovieObj.length == 0) {
				$currentMovieObj = $("#video");
			}
			
			if ($currentMovieObj.length > 0) {
				var volume = movieItems[videoVolumeIndex];
				var minHeight = parseInt($currentMovieObj.css("min-height"), 10);
				var $zoomStyle = $("<style id='fszoom' type='text/css' media='screen'>video{width:inherit;height:inherit;} #photo{width:100%;height:100%}</style>");
				
				if (minHeight == 0) {
					minHeight = 540;
				}
				
				var movieid = $currentMovieObj.attr('id')
				if (movieid == "movie1") {
					$("#movie2").remove()
				}
				else if (movieid == "movie2") {
					$("#movie1").remove()
				}
				
				if (smallScreen) {
					minHeight = 640 * (currentMovieHeight / currentMovieWidth);
					
					$currentMovieObj.css("min-height", minHeight);
					$("#previous, #current, #next, #index").css("font-size", "1.4em");
				}
				
				if (smallScreen && currentMovieHeight==360) {
					addHEVC = false;
				}
				if (isIPhoneX && currentMovieHeight==540) {
					addHEVC = false;
				}
				if ($currentMovieObj[0].canPlayType('video/mp4; codecs="hvc1"').length==0) {
					addHEVC = false;
				}
				if (addHEVC) {
					var $newVideo = $('<video class="hidden" id="movie1" style="min-height: '+minHeight+'px" controls autoplay>');
					var $src1 = $("<source type='video/mp4' codecs='hvc1'>");
					var $src2 = $("<source type='video/mp4' codecs='avc1'>");
					var $origMovieObj = $currentMovieObj;
					
					$newVideo.on("loadedmetadata", function () {
						var curSrc = $newVideo[0].currentSrc;

						$currentMovieObj.css("min-height", "");
						
						if (curSrc.contains("-HEVC")) {
							var $label = $("#current");
							var origText = $label.html();
							
							$label.html(origText.replace(")", " - HEVC)"));
							$label.css("cursor", "pointer");
							
							$label.one("click", function() {
								$label.html(origText);
								
								$("#fszoom").remove();
								$origMovieObj.on("loadedmetadata", function () {
									$origMovieObj.css("min-height", "");
									$("head").append($zoomStyle);
								});
								
								$origMovieObj.attr("src", movieName);
								$origMovieObj.attr("width", currentMovieWidth);
								$origMovieObj.attr("height", currentMovieHeight);
								$origMovieObj[0].volume = volume;
								$origMovieObj.hidden(false);
								$newVideo.replaceWith($origMovieObj);
								$currentMovieObj = $origMovieObj;
								setupPlayPause($currentMovieObj);
								$label.css("cursor", "");
							});
						}
					});
					
					$src1.attr("src", movieName.replace(".m", "-HEVC.m"));
					$src2.attr("src", movieName);
					$newVideo.attr("style", $currentMovieObj.attr("style"));
					$newVideo.append($src1, $src2);
					$currentMovieObj.replaceWith($newVideo);
					$currentMovieObj = $newVideo;
				}
				else {
					$currentMovieObj.on("loadedmetadata", function () {
						$currentMovieObj.css("min-height", "");
					});
					$currentMovieObj.attr("src", movieName);
				}
				$currentMovieObj.on("loadedmetadata", function () {
					$("head").append($zoomStyle);
				});

				$currentMovieObj.attr("width", currentMovieWidth);
				$currentMovieObj.attr("height", currentMovieHeight);
				$currentMovieObj[0].volume = volume;
				$currentMovieObj.hidden(false);
			}
	
			if ((parseInt(movieItems[chainPlayIndex], 10) & 1) && !searchTerm.contains("nochain")) {
				$currentMovieObj.one("ended", function () {
					if (pageIndex+1 < movieRows.length) {
						setupPage(movieRows, pageIndex+1);
					}
				});
			}
			
			$("title").html(movieItems[pageTitleIndex]);
			setupChapterList(chapters);
		}
		
		var targetRef = null;
		function setRef() {
			if (targetRef != null) {
				document.location.href = targetRef;
			}
		}

		$.get( "movies.txt", function(data) {
			var currentPageNumber = findPageNumber();
			var movieRows = data.splitLines();
			var pageParams = movieRows[0].split(",");
			var foundIndex = -1;
			
			pageCount = parseInt(pageParams[0], 10);
			useAWS = (pageParams.length > 1) ? parseInt(pageParams[1], 10) : false;
			
			for (var i=1; foundIndex==-1 && i<movieRows.length; i++) {
				if (movieRows[i].split("\t")[pageNumberIndex] == currentPageNumber) {
					foundIndex = i;
				}
			}
			
			if (foundIndex == -1) {
				var override = $("#movie1").attr('indexoverride');
				
				if (override != null) {
					foundIndex = parseInt(override, 10);
				}
			}
			
			if (foundIndex != -1) {
				setupPage(movieRows, foundIndex);
			}
			
			if ($currentMovieObj!=null && smallScreen && $("meta[name='viewport']").length==0) {
				$('head').append('<meta name="viewport" content="width=640">');
			}
	
			if ($currentMovieObj == null) {
				$currentMovieObj = $("video");
				
				if ($currentMovieObj != null) {
					if (pageCount==0 && useAWS) {
						$currentMovieObj.attr("src", targetName($currentMovieObj.attr("src")));
					}
					$currentMovieObj.hidden(false);
				}
			}
			
			setupPlayPause($currentMovieObj);
	
			if ( typeof($currentMovieObj[0].canPlayType) == 'undefined' || $currentMovieObj[0].canPlayType('video/mp4') == '') {
				var filler = '<div style="width:'+currentMovieWidth+'px; height:'+currentMovieHeight+'px;"><center><br><br><br><br><br>Your browser does not support this video.<br>Please use Safari or Chrome.</center></div>';
				
				$currentMovieObj.before(filler);
				$currentMovieObj.remove();
			}
	
			if (document.location.search.length > 1 && document.location.href.contains("large")) {
				var $indexRef = $("#index > a");
				var newRef = $indexRef.attr("href") + document.location.search;
				$indexRef.attr("href", newRef);
			}
	
			$("#index,.index").find("a").each(function(){
				$obj = $(this);
				$obj.attr("href", $obj.attr("href")+"#"+document.location.pathname.split('/').pop());
			});
	
			$("#previous").attr("title", "Previous (left arrow)");
			$("#next").attr("title", "Next (right arrow)");
			
			$("#footer > p,#footer > li").wrapInner('<a href="../../index.html"></a>');

			if ("ontouchstart" in document.documentElement) {
		 		$("a").css("touch-action", "manipulation");
			}

			$(".row, ul#footer").css("margin", "0 5px");

			$("body").css("display", "inline");
		
			var $pagewrap = $("#pagewrap");
			if ($pagewrap !== null) {
				$pagewrap.hidden(false);
			}
			
			var $chapterSelect = $("#chapterselect");
			var handleSelectorFunction = function() {
				if ($currentMovieObj !== null) {
					var timecode = $chapterSelect.val();
					var newTime = timecode;
					
					if (timecode.length>0 && timecode.contains(":")) {
						var timeParts = timecode.split(":");
						var multiplier = 1.0 / 30.0;
						
						newTime = 0;
						
						for (var i=timeParts.length-1; i>=0; i--) {
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
						$currentMovieObj[0].currentTime = newTime;
					}
				}
			};
			$chapterSelect.change(handleSelectorFunction);
			
			$(document).keydown(function(event) {
				if ($currentMovieObj !== null) {
					var movieElement = $currentMovieObj[0];
					var $numberElement = null;
					var handled = true;
					
					switch (event.which) {
						case 66:	/* stop-start, B */
						case 32:	/* spacebar */
							togglePlayback(movieElement);
							break;
						case 33:	/* page up */
						case 37:	/* left */
							if (event.altKey) {
								movieElement.pause();
								movieElement.currentTime -= 1.0 / 60;
							} else if (!$("#previous").isHidden()) {
								$numberElement = $("#previous").find("a");
							}
							break;
						case 34:	/* page down */
						case 39:	/* right */
							if (event.altKey) {
								movieElement.pause();
								movieElement.currentTime += 1.0 / 60;
							} else if (!$("#next").isHidden()) {
								$numberElement = $("#next").find("a");
								
								if ($numberElement.length == 0) {
									$numberElement = $("#index,.index").find("a");
								}
							}
							break;
						case 38:	/* up */
							if (event.altKey) {
								movieElement.currentTime -= 10;
								break;
							} else if ($chapterSelect != null && $chapterSelect[0].selectedIndex > 1) {
								$chapterSelect[0].selectedIndex--;
								handleSelectorFunction();
								break;
							}
							// fall into next case
						case 73:	/* i */
							if (!event.altKey && !event.shiftKey && !event.ctrlKey) {
								$numberElement = $("#index,.index").find("a");
							} else {
								handled = false;
							}
							break;
						case 40:	/* down */
							if (event.altKey) {
								movieElement.currentTime += 10;
							} else if ($chapterSelect != null && $chapterSelect[0].selectedIndex < $chapterSelect.children().length-1) {
								$chapterSelect[0].selectedIndex++;
								handleSelectorFunction();
							}
							break;
						case 33:	/* home */
							movieElement.currentTime = 0;
							break;
						case 34:	/* end */
							movieElement.currentTime = movieElement.duration;
							break;
						case 70:	/* f - fullscreen */
							if (!event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
								doRestart = false;
								if (movieElement.currentTime < 10.0) {
									movieElement.pause();
									movieElement.currentTime = 0;
						            movieElement.removeAttribute("controls");
									setTimeout(function () {
							            if ($currentMovieObj != null && $currentMovieObj[0].paused) {
								            $currentMovieObj[0].play();
							            }
								    }, 1000);
								}
								toggleFullscreen(movieElement);
							}
							else {
								handled = false;
							}
							break;
						case 72:	/* h - hd */
							var $hdprompt = $("#hdprompt");
							
							if (!$hdprompt.isHidden()) {
								$numberElement = $hdprompt;
							}
							break;
						default:
							handled = false;
							break;
					}
					
					if ($numberElement !== null && $numberElement.length>0) {
						targetRef = $numberElement.attr("href");
						
						if (fullscreenActive()) {
							exitFullscreen();
							setTimeout(setRef, 1000);
						}
						else {
							setRef();
						}
					}
					
					if (handled) {
						event.preventDefault();
					}
				}
			});
		}, "text");
	});
}
