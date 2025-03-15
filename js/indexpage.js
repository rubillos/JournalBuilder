var indexPageLoaded;

if (indexPageLoaded == null) {
	indexPageLoaded = true;

	$.event.special.touchstart = { setup: function( _, ns, handle ){ this.addEventListener("touchstart", handle, { passive: true }); } };
	$.event.special.touchmove = { setup: function( _, ns, handle ){ this.addEventListener("touchmove", handle, { passive: true }); } };
	$.event.special.scroll = { setup: function( _, ns, handle ){ this.addEventListener("scroll", handle, { passive: true }); } };
	$.event.special.resize = { setup: function( _, ns, handle ){ this.addEventListener("resize", handle, { passive: true }); } };
	$.event.special.mouseenter = { setup: function( _, ns, handle ){ this.addEventListener("mouseenter", handle, { passive: true }); } };
	$.event.special.mouseleave = { setup: function( _, ns, handle ){ this.addEventListener("mouseleave", handle, { passive: true }); } };
	
	String.prototype.splitLines = function() {
		return this.split(/\r\n|\r|\n/g);
	};
	
	var version_attr = $("body").attr("version")
	var version = (version_attr!=null && version_attr.length>0) ? parseInt(version_attr) : 1
	
	if (version < 2) {
		var newTitle = document.title.split(" - ")[0].split("@1x")[0].split("• ").join("").split(" •").join("");
		if (/\d\d\d\d-\d\d-\d\d-/.test(newTitle)) {
			newTitle = newTitle.slice(11);
		}
		document.title = newTitle;
	}

	var screenWidth = screen.width;
	var contentWidth = 800;
	var mobileDevice = false;
	var panopage = false;
	var $content = $("#content");
	var videoElements = [];
	var maxZoom = 120;
	var isLocal = false;

	var margins = (screenWidth < 700) ? 40 : 80;
	
	if (window.visualViewport != null) {
		if (window.visualViewport.width < 500) {
			screenWidth = 680;
		}
	}
	
	if ($content.length == 1) {
		contentWidth = $content.outerWidth();
	}
	if (contentWidth == 0) {
		contentWidth = $("#headerImg > img").outerWidth();
	}
	
	if ((screenWidth < contentWidth) && ($('head > meta[name="viewport"]').length == 0)) {
		$('head').append('<meta name="viewport" content="width='+(contentWidth+margins)+'">');
	}
	else {
		if (document.location.href.includes("Users/mediaserver") && $(window).width()>(contentWidth+100) && $(".sideinfo").length==0) {
			maxZoom = 150;
			isLocal = true;
		}
		
		updateZoom();

		$(window).resize(function() {
			updateZoom();
		});
	}
	
	function updateZoom() {
		if (contentWidth+margins > window.innerWidth) {
			var zoom = Math.max(50, window.innerWidth / (contentWidth + margins) * 100);
			$('body').css("zoom", zoom+"%");
		}
		else if ($('body').css("zoom") != null) {
			var zoomText = $('body').css("zoom");
			var currentZoom = parseFloat(zoomText);
			
			if (!zoomText.slice(-1) != "%") {
				currentZoom *= 100.0;
			}
			
			var zoomScale = window.innerWidth / (contentWidth + margins);
			var newZoom = Math.min(maxZoom, currentZoom * zoomScale);
			
			$('body').css("zoom", newZoom+"%");
		}
	}
		
	if ($("#content").attr("panopage") != null) {
		$("#picblock > tbody > tr").each(function() {
			var $obj = $(this);
			$obj.children("td:gt(0)").detach().wrap("<tr></tr>").parent().appendTo($obj.parent());
		});
		$("#picblock .imageblock").each(function() {
			var $obj = $(this);
			
			$obj.width(4 * $obj.width());
			
			var headerWidth = $("div#headerImg > img").width();

			$obj.find("img").each(function() {
				var $img = $(this);
				
				var aspectRatio = $img.height() / $img.width();
				$img.width(headerWidth);
				$img.height(headerWidth * aspectRatio);
			});
		});
		panopage = true;
	}
	
	if (screenWidth < 700) {
		if (!panopage && $("body").css("display") == "none") {
			if ($("#content").attr("norewrap") == null) {
				if (version>="3") {
					$picblock = $("div.picblock");
					
					if ($picblock.length > 0) {
						sizeText = $picblock.css("grid-template-columns");
						commaIndex = sizeText.indexOf(",");
						if (commaIndex != -1) {
							sizeText = sizeText.slice(commaIndex+1);
						}
						
						thumbsize = parseInt(sizeText);
						newthumbsize = thumbsize * 2 + 15
						$picblock.css("grid-template-columns", newthumbsize + "px " + newthumbsize + "px")
					}
					
					$(".imagediv").each(function() {
						var $obj = $(this);
						$obj.find("img").each(function() {
							var $img = $(this);
							$obj.width(newthumbsize);
							$img.width(Math.floor(newthumbsize / thumbsize * $img.width()));
							$img.height(Math.floor(newthumbsize / thumbsize * $img.height()));
						});
					});
					$("ul#nav").css("font-size", "1.3em").css("line-height", "2.0em").css("margin-bottom", "20px");
				}
				else {
					if (version=="2") {
						$("div.picrow").each(function() {
							var $obj = $(this);
							var $clone = $obj.clone().empty()
							$obj.children("div:gt(1)").detach().wrapAll($clone).parent().insertAfter($obj);
						});
						
						$(".imagediv").each(function() {
							var $obj = $(this);
							$obj.find("img").each(function() {
								var $img = $(this);
								$obj.width(2 * $obj.width());
								$img.width(2 * $img.width());
								$img.height(2 * $img.height());
							});
						});
					}
					else {
						$("#picblock > tbody > tr").each(function() {
							var $obj = $(this);
							$obj.children("td:gt(1)").detach().wrapAll("<tr></tr>").parent().insertAfter($obj);
						});
						$("#picblock .imageblock").each(function() {
							var $obj = $(this);
							$obj.width(2 * $obj.width());
							$obj.find("img").each(function() {
								var $img = $(this);
								$img.width(2 * $img.width());
								$img.height(2 * $img.height());
							});
						});
					}
					$("ul#nav").css("font-size", "1.3em").css("margin-bottom", "10px");
				}
			}
			$(".journaltitle").not(".nomodify").css("font-size", "1.6em");
			var $h1 = $("h1").not(".nomodify");
			if ($h1 != null) {
				var head_len = $h1.html().length;
				if (head_len < 50) {
					var head_size = "";
					if (head_len > margins) { head_size = "2.5em" }
					else if (head_len > 30) { head_size = "2.7em" }
					else { head_size = "3.0em" }
					$h1.css("font-size", head_size);
				}
			}
			$("h1").not(".nomargin").css("margin", "10px 0 20px");
			$(".journaltext").not(".nomodify").css("font-size", "2.2em").css("line-height", "1.2em");
			$(".picblock").eq(".setfont").css("font-size", "2.2em");
			$("#footer").not(".nomodify").css("font-size", "3em");
		}
		mobileDevice = true;
	}
	
	var $h1 = $("h1").not(".nomodify");
	if ($h1 != null) {
		var $h1 = $("h1")
		var head_len = $h1.html().length
		if (head_len >= 50) {
			var head_size = ""
			if (head_len > 80) { head_size = "1.2em" }
			else if (head_len > 65) { head_size = "1.5em" }
			else { head_size = "1.9em" }
			$h1.css("font-size", head_size)
		}
	}

	var prefixAWS = "http://dvk4w6qeylrn6.cloudfront.net";

	$(function(){
		function targetName(objectName) {
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
			
			return objectName;
		};

		if (document.location.href.includes("Users/mediaserver") && $(window).width()>(contentWidth+100) && $(".sideinfo").length==0) {
			var zoom = (Math.min(1600, $(window).width()) / (contentWidth + 100)) * 100;
			$('body').css("zoom", zoom+"%");
		}
		
		const pageScale = (window.outerWidth / window.innerWidth) * window.devicePixelRatio;
		const folder_scales = [1, 2, 3, 4, 6, 8, 12];
		
		function srcSetError() {
			const $img = $(this);
			let srcSet = $img.attr('srcset').split(', ');
			if (srcSet.length > 1) {
				srcSet.pop();
				$img.attr('srcset', srcSet.join(', '));
			}
		}

		const singleSrc = $("#picblock,td.sideinfo").length > 0;

		$("img").each(function() {
			var $img = $(this);
			
			if ($img.attr("srcset") == null && $img.attr("filename") != null){
				var filename = $img.attr("filename");
				var parts = filename.split('?')
				parts[0] = encodeURIComponent(parts[0]);
				var encodedName = parts.join('?')
				let width = this.width;
				
				$img.on('error', srcSetError);

				if (filename.indexOf("Placed Image")==0 || filename.indexOf("headers")==0) {
					if (filename.indexOf("headers") == 0) {
						encodedName = filename;
					}
					let sizes = 3;
					if ($img.attr("sizes") != null) {
						sizes = parseInt($img.attr("sizes"));
					}
					if (width == 0) {
						width = 800;
					}
					let srcSet = `${encodedName} ${width}w`;
					for (let i = 2; i <= sizes; i++) {
						srcSet += `, ${encodedName.replace('.', `@${folder_scales[i-1]}x.`)} ${width*i}w`;
					}
					$img.attr("srcset", srcSet);
					$img.attr("filename", null);
					$img.attr("src", null);
				}
				else {
					if ($img.attr("singlethumb") != null) {
						$img.attr("src", "thumbnails/" + encodedName);
					}
					else {
						if (width == 0) {
							width = 200;
						}
						let srcSet = `thumbnails/${encodedName} ${width}w, thumbnails@2x/${encodedName} ${width*2}w, thumbnails@3x/${encodedName} ${width*3}w`;
						if (pageScale > 1.5) {
							const picName = encodedName.replace("thumb", "picture");
							srcSet = `${srcSet}, pictures/${picName} 1024w`;
							if (pageScale > 2.5) {
								srcSet = `${srcSet}, pictures@2x/${picName} 2048w`;
							}
						}
						$img.attr("srcset", srcSet);
						$img.attr("src", null);
					}
				}
			}
			else if (singleSrc && $img.attr("srcset") == null) {
				const src = $img.attr('src');
				if (src.indexOf("Placed Image")==-1) {
					$img.on('error', srcSetError);
					const width = this.width;
					const src2 = src.replace("thumbnails", "pictures").replace("thumb", "picture");
					$img.attr('srcset', `${src} ${width}w, ${src2} 1024w`);
					$img.attr("src", null);
				}
			}
		});
		
		var thumbnailTimeout = 2 * 60;
		window.timeoutKey = null;
		window.thumbnailsPaused = false;
	    window.isActive = true;
		
		function pauseThumbnails() {
			if (!window.thumbnailsPaused) {
				$("video").each(function() {
					if ($(this).attr("src") != null) {
						this.pause();
					}
				});
				window.thumbnailsPaused = true;
			}
			window.timeoutKey = null;
		};

		function clearQueuedPause() {
			if (window.timeoutKey != null) {
				clearTimeout(window.timeoutKey);
				window.timeoutKey = null;
			}
		}
		
		function restartThumbnails() {
			if (window.thumbnailsPaused) {
				$("video").each(function() {
					if ($(this).attr("src") != null && this.paused) {
						this.play();
					}
				});
				window.thumbnailsPaused = false;
			}
		}
		
		function updateThumbnailTimeout() {
			clearQueuedPause();
			if (window.isActive) {
				restartThumbnails();
				window.timeoutKey = setTimeout(pauseThumbnails, thumbnailTimeout * 1000);
			}
		};
		
		$(window).focus(function() {
			if (!this.isActive) {
				this.isActive = true;
				updateThumbnailTimeout();
			}
		}).blur(function() {
			if (this.isActive) {
				this.isActive = false;
				clearQueuedPause();
				pauseThumbnails();
			}
		}).mousemove(function() {
			updateThumbnailTimeout();
		});

		function updateVisibility(vid) {
			var $img = vid.img;
			var $vidElem = vid.video;
			var visibleBounds = $img[0].getBoundingClientRect();
			var visible = visibleBounds.bottom > 0 && visibleBounds.top < window.innerHeight;
			var key = (visible) ? "yes" : "no";
						
			if (key != $vidElem.attr('shown')) {
				if (visible) {
					if (window.thumbnailsPaused) {
						$vidElem.attr("autoplay", (window.thumbnailsPaused) ? null : true);
					}
					$vidElem.attr('src', $vidElem.attr('path'));
					$vidElem.css('display', 'inline');
				}
				else {
					$vidElem.css('display', 'none');
					$vidElem.attr('src', null);
				}
				$vidElem.attr('shown', key);
			}
			
			return visible;
		};
				
		function updateAllVisibility() {
			var count = 0;
			
			window.scrollKey = null;
			
			videoElements.forEach(function(vid) {
				count += updateVisibility(vid);
			});
		}

		var pageNumberIndex = 0;
		var standardMovieIndex = 4;
		var HDMovieIndex = 5;
		var smallMovieIndex = 6;
		var thumbnailMovieIndex = 8;
		var fourKMovieIndex = 9;
			
		var $playImg;

		function addPlay(event) {
			if ($playImg.parent().length == 0) {
				var $obj = $(this);
				var $video = $obj.find("video");
				var vidWidth = $video.width();
				var vidLeft = parseInt($video.css("left"));
				
				$playImg.css('left', (vidLeft+((vidWidth-60) / 2))+"px");
				$playImg.css('top', (($video.attr('height')-60) / 2)+"px");
				$playImg.appendTo($(this));
			}
			return true;
		};
		
		function removePlay(event) {
			$playImg.detach();
			return true;
		};
		
		function addVideoThumbnail($img, movieInfo, rootPrefix, thumbPrefix) {
			var $aObj = $img.parent();
			var $dtObj = $aObj.parent();
			
			if (!mobileDevice && ($dtObj !== null) && ($dtObj.length>0) && (movieInfo.length > thumbnailMovieIndex) && (movieInfo[thumbnailMovieIndex].length>0)) {
				var $newVideo = $("<video style='display:none; position:absolute; left:0; top:0' muted loop autoplay></video>");
				
				$newVideo.attr("width", $img.attr("width"));
				$newVideo.attr("height", $img.attr("height"));
				$newVideo.attr("poster", $img.attr("src"));
				
				var offset = 0;
				var imgWidth = $img.attr("width");
				var thumbWidth = $dtObj.width();
				if (imgWidth != thumbWidth) {
					offset = Math.max(0, Math.floor((thumbWidth - imgWidth) / 2));
					$newVideo.css("left", offset);
				}

				var thumbName = movieInfo[thumbnailMovieIndex];
				
				if (thumbName.length < 3) {
					thumbName = movieInfo[standardMovieIndex].split(",")[2].replace("-HEVC", "");
					
					if (thumbName.search(/(.*? ?- ?)\d{3,4}p\d{2}\..{3}/g) >= 0) {
						thumbName = thumbName.replace(/(.*? ?- ?)\d{3,4}p\d{2}\..{3}/g, "$1Thumbnail.m4v");
					}
					else {
						thumbName = thumbName.replace(/(.*?)\..{3}/g, "$1-Thumbnail.m4v");
					}
				}
				
				thumbName = thumbPrefix + thumbName;
				thumbName = targetName(thumbName);
				
				$newVideo.attr("path", thumbName);
				$dtObj.css({ 'position': 'relative' });
				if (!$dtObj.hasClass("nomodify")) {
					$dtObj.css({ 'border-color': 'white', 'border-style': 'solid', 'border-width': '5px', 'margin': '-5px '});
				}
				$dtObj.attr("height", $img.attr("height"));
				$newVideo.appendTo($aObj);
				
				if ($playImg == null) {
					$playImg = $("<img src='"+rootPrefix+"play.png' width=60 height=60 style='position:absolute; left: 65px; top: 23px; border-width:0;'>");
				}
								
				$aObj.on("touchstart mouseenter", addPlay);
				$aObj.on("mouseleave touchmove click", removePlay);
				
				var package = { 'video': $newVideo, 'img' : $img };
				updateVisibility(package);
				videoElements.push(package);
			}
		};
	
		$.get( "movies.txt", function(data) {
			var movieRows = data.splitLines();
			var moviePages = {};
	
			for (var i=1; i<movieRows.length; i++) {
				var itemInfo = movieRows[i].split("\t");
				
				if (itemInfo.length>standardMovieIndex) {
					moviePages[itemInfo[pageNumberIndex]] = itemInfo;
				}
			}

			var assetRoot = $("body").attr("assetroot");
			if (assetRoot == null) {
				assetRoot = "../../FrontPageGraphics/";
			}
			
			$("img").each(function() {
				var $img = $(this);
				
				if ($img.attr("filename") != null) {
					var $hrefObj = $img.parent();
					var hrefPath = $hrefObj.attr("href");
					var pageNumber = findPageNumber(hrefPath);
					var movieInfo = moviePages[pageNumber];
					
					if (movieInfo != null) {
						var $captionObj = null;
						
						if (version == 3) {
							$captionObj = $hrefObj.parent().find("p.imagelabel");
						}
						else {
							$captionObj = $hrefObj.parent().parent().find("li");
						}
						
						if ($captionObj ==null || $captionObj.length==0) {
							$captionObj = $hrefObj.parent().parent().find("p.imagelabel");
						}
						
						if ($captionObj !== null && $captionObj.length>0) {
							var title = $captionObj.html().trim();
							var newHTML = '<a href="#href"><strong>#title</strong></a>';
							var hasHD = (movieInfo.length > HDMovieIndex) && (movieInfo[HDMovieIndex].length > 0);
							var has4K = (movieInfo.length > fourKMovieIndex) && (movieInfo[fourKMovieIndex].length > 0);
							var hdString = "";

							if ((document.location.search.length <= 1) && hasHD) {
								hdString = "<span style='text-decoration:underline;'><a href='#href?HD'>HD</a></span>";
							}
							if ((document.location.search.length <= 1) && has4K) {
								if (hdString.length > 0) {
									hdString = hdString + "&nbsp;&nbsp;";
								}
								hdString = hdString + "<span style='text-decoration:underline;'><a href='#href?4K'>4K</a></span>";
							}
							
							if (hdString.length > 0) {
								newHTML = '<div style="display:flex; justify-content:space-between;">' + newHTML +'<div style="flex-grow:1;"></div>' + hdString + '</div>';
							}
					
							newHTML = newHTML.split("#href").join(hrefPath);
							newHTML = newHTML.split("#title").join(title);
							$captionObj.html(newHTML);
						}
						addVideoThumbnail($img, movieInfo, assetRoot, "");
					}
				}
			});
						
			updateThumbnailTimeout();

			if ("ontouchstart" in document.documentElement) {
		 		$("a,#headerImg,li.pagnation,li.previous,li.next").css("touch-action", "manipulation");
			}
		});
		
		var $nav = $("ul#nav");
		if ($nav.children().length <= 2) {
			$nav.remove();
		}
	
		$(".previous").attr("title", "Previous (left arrow)");
		$(".next").attr("title", "Next (right arrow)");
		
		$("#footer > p,#footer > li").not("a").wrapInner('<a href="../../index.html"></a>');

		function handleNavClick() {
			window.event.preventDefault();
			var $a = $(this).find("a");
			if ($a.length > 0) {
				document.location.href = $a.attr("href");
			}
		}
		
		$("li.pagnation,li.previous,li.next").css("cursor", "pointer").click(handleNavClick);
		$("li.previous").not(".nomodify").css("height", "100%");
		$("li.next").not(".nomodify").css("height", "100%");
	
		$("body").css("display", "inline");
		
		var hashRef = document.location.hash.substring(1);
		
		if (hashRef.length > 0) {
			$(".imagecell, .imagediv").find("a[href='"+hashRef+"']").each(function() {
				window.scrollTo(0, this.getBoundingClientRect().top  - window.innerHeight/2);
			});
		}
			
		if (document.location.search.length > 1) {
			$("#nav > li > a,.imagecell > a").attr("href", function(i, href) {
				return href + document.location.search;
			});
		}

		$("#headerImg").mousedown(function(e) {
			var leftSide = e.offsetX < ($(this).width() * 0.2);
			var $numberElement = $(leftSide ? "#previous, .previous" : "#next,.next").find("a");
	
			if ($numberElement.length>0) {
				document.location.href = $numberElement.attr("href");
			}
		});
		
		if (version < 2 && $("a:contains('Next Page')").length == 0) {
			var $nextElement = $("#next,.next").find("a");
	
			if ($nextElement.length>0) {
				$nextLink = $('<div class="journaltext" style="width: ' + (contentWidth+10) + 'px;"><p align="right" class="copy"><a href="'+$nextElement.attr("href")+'">Next Page</a></p></div>');
				$nextLink.insertBefore($("#footer"));
			}
		}
		
		function findPageNumber(path) {
			var pageCount = ($nav != null && $nav.length>0) ? $nav.children().length - 2 : 1;
			var currentPageNumber = 1;
			
			if (path == null) {
				path = document.location.pathname;
			}
			
			var lastSegment = path.substring(path.lastIndexOf("/")+1, path.lastIndexOf("."));
			
			if (path.indexOf("indexlast")!=-1) {
				currentPageNumber = pageCount;
			}
			else {
				var digitIndex = lastSegment.search(/\d/);
				
				if (digitIndex >=0) {
					currentPageNumber = parseInt(lastSegment.substr(digitIndex), 10);
				}
			}
			
			return(currentPageNumber);
		}
	
		var $nav = $("#nav");
		var pageCount = ($nav != null && $nav.length>0) ? $nav.children().length - 2 : 0;
		var currentPageNumber = findPageNumber();
		
		window.scrollKey = null;
	
		function visibilityCheck() {
			updateThumbnailTimeout();
			if (window.scrollKey != null) {
		    	clearTimeout(window.scrollKey);
			}
		    window.scrollKey = setTimeout(updateAllVisibility, 100);
		}
		
		$(document).scroll(visibilityCheck);
		$(window).resize(visibilityCheck);
				
		$(document).keydown(function(event) {
			function scrolledToBottom() {
				return ($(window).scrollTop() + $(window).height() + 10 >= $(document).height());
			}
	
			var handled = true;
			var newPageNumber = currentPageNumber;
			var $nextPageLink = $("#nextpagelink");
			
			switch (event.which) {
				case 33:	/* page up */
				case 37:	/* left */
				case 38:	/* up */
					if (newPageNumber>1) {
						newPageNumber--;
					}
					else {
						newPageNumber = - 3;
					}
					break;
				case 34:	/* page down */
				case 39:	/* right */
				case 40: 	/* down */
					if (newPageNumber<pageCount) {
						newPageNumber++;
					}
					else {
						newPageNumber = -2;
					}
					break;
				case 73:	/* i */
					if (!event.altKey && !event.shiftKey && !event.ctrlKey) {
						newPageNumber = -1;
					} else {
						handled = false;
					}
					break;
				case 32:	/* spacebar */
					if (scrolledToBottom() && (newPageNumber < pageCount || $nextPageLink != undefined) && $("#video,#movie1,#movie2").length==0) {
						newPageNumber++;
					} 
					else if (scrolledToBottom() && pageCount <= 1 && $("#video,#movie1,#movie2").length==0) {
						$("html, body").animate({ scrollTop: 0 }, "slow");
					} 
					else {
						handled = false;
					}
					break;
				case 66:	/* stop-start, B */
				case 80:	/* p */
				case 9: 	/* tab */
					if (!event.altKey && !event.shiftKey && !event.ctrlKey) {
						var $photos = $(".imagecell > a, .imagediv > a, .imagediv > > a");
						
						if ($photos.length > 0) {
							document.location.href = $photos.attr('href');
						}
					}
					break;
				default:
					handled = false;
					break;
			}
		
			if (handled) {
				event.preventDefault();
				
				if (newPageNumber != currentPageNumber) {
					var newRef = "index";
					
					if (newPageNumber==pageCount && $nextPageLink != undefined && $nextPageLink.length>0) {
						newRef = $nextPageLink.attr("href");
					}
					else if (newPageNumber == -2 || newPageNumber > pageCount) {
						newRef = "";
						if ($nextPageLink != undefined && $nextPageLink.length>0) {
							newRef = $nextPageLink.attr("href");
						}
					}
					else if (newPageNumber == -3) {
						var $previousPageLink = $("#previouspagelink");
						newRef = "";
						if ($previousPageLink != undefined) {
							newRef = $previousPageLink.attr("href");
						}
					}
					else if (newPageNumber > 1) {
						newRef = newRef + newPageNumber + ".html";
					}
					else if (newPageNumber == -1) {
						newRef = "../../" + newRef + ".html";
					}
					else {
						newRef = newRef + ".html";
					}
					
					if (document.location.search.length > 1 && newPageNumber != -1) {
						newRef = newRef + document.location.search;
					}
					
					if (newRef != undefined && newRef.length > 0) {
						document.location.href = newRef;
					}
				}
			}
		});
	});
}
