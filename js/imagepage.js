var imagePageLoaded;

if (imagePageLoaded == null) {
	imagePageLoaded = true;

	var root = (typeof exports === 'undefined' ? window : exports);
	var mobileDevice = (screen.width < 700);
	
	var newTitle = document.title.split(" - ")[0].split("@1x")[0];
	if (/\d\d\d\d-\d\d-\d\d-/.test(newTitle)) {
		newTitle= newTitle.slice(11);
	}
	document.title = newTitle;

	$(function(){
		function removeSearch(string) {
			var lastPosition = string.lastIndexOf("?");
			if (lastPosition === -1) return string;
			else return string.substr(0, lastPosition);
		};

		function colorToGray(color) {
			var red = 0, green = 0, blue = 0;
			
			if (color != null && color.length > 3) {
			    if (color.substr(0, 1) === '#') {
			        red = parseInt(color.substr(1, 2), 16);
			        green = parseInt(color.substr(3, 2), 16);
			        blue = parseInt(color.substr(5, 2), 16);
			    }
			    else if (color.substr(0,4) === 'rgba') {
				    var digits = /(.*?)rgba\((\d+), (\d+), (\d+), (\d+)\)/.exec(color);
				    
				    if (parseInt(digits[5]) == 0) {
					    red = 255; green = 255; blue = 255;
				    }
				    else {
					    red = parseInt(digits[2]);
					    green = parseInt(digits[3]);
					    blue = parseInt(digits[4]);
				    }
			    }
			    else if (color.substr(0,3) === 'rgb') {
				    var digits = /(.*?)rgb\((\d+), (\d+), (\d+)\)/.exec(color);
				    
				    red = parseInt(digits[2]);
				    green = parseInt(digits[3]);
				    blue = parseInt(digits[4]);
			    }
			}
		    
		    return (red / 255.0) * 0.2989 + (green / 255.0) * 0.5870 + (blue / 255.0) * 0.1140;
		};
		
		function getBaseURL() {
		    return location.href.split("/").slice(0,-3).join("/") + "/";
		}

		function addDownloadLink(imageName) {
			if ($("body").hasClass("nodownload")) {
				return;
			}

			var iconSize = 32;
			var top = 3;
			var $current = $("div#current");
			var $colorElement = $current;
			
			if ($current.length == 0 || $colorElement.length==0) {
				$current = $("ul#nav");
				$colorElement = $("li.index");
				iconSize = 16;
				top = 1;
			}
			if ($current.length == 0 || $colorElement.length==0) {
				$current = $("ul#nav");
				$colorElement = $("li.pagenumber");
				iconSize = 32;
				top = 10;
			}
			
			if ($current.length && $colorElement.length) {
				var textGray = colorToGray($colorElement.css("color"));
				var invert = colorToGray($("body").css("backgroundColor")) < 0.3;
				var opacity = (invert) ? textGray : 1.0 - textGray;
				var baseURL = getBaseURL();
				var currentPath = window.location.href.replace(baseURL, "");
				
				currentPath = currentPath.substring(0, currentPath.lastIndexOf("/"))
				
				var iconPath = baseURL + "FrontPageGraphics/download.png";
				var phpPath = baseURL + "download/download.php";
				
				var $download = $('<a id="downlink" href="'+phpPath+'?file=' + imageName + '&path=' + currentPath + '"><img id="download" src="'+iconPath+'" width="'+iconSize+'" height="'+iconSize+'" style="position: relative; top:'+top+'px; padding-left:'+iconSize+'px; opacity: ' + opacity + '; background-color: transparent;" title="Download Full Image"></a>');
				
				if (invert) {
					$download.css("-webkit-filter", "invert(1)");
					$download.css("filter", "invert(1)");
				}
				
				$("#downlink").remove();
				$current.append($download);
				
				if (canFullscreenImage()) {
					$current.click(function() {
						fullscreenImage();
					});
					$current.css("cursor", "pointer");
				}
			}
		}
		
		const $img = imageObj();
		if ($img.length > 0) {
			$img[0].onload = function() {
				const curSrc = $img[0].currentSrc;
				if (curSrc != null) {
					const regex = /pictures@([^\/]*)\//;
					const match = curSrc.match(regex);
					if (match) {
						$("#metadata > strong").each(function(){
							const children = this.childNodes;
							if (children.length > 0) {
								const last = children[children.length - 1];
								if (last.nodeType === Node.TEXT_NODE) {
									const separator = " • ";
									let t = last.textContent;
									if (!t.endsWith(separator)) {
										t += separator;
									}
									last.textContent = t + `${match[1]}`;
								}
							}
						});
					}
				}
			}
		}

		function updateLinks() {
			if (document.location.search.length > 1) {
				$("a").attr("href", function(i, href) {
					hRef = removeSearch(href);
					var hashPosition = hRef.indexOf("#");
					
					if (hashPosition == -1) return hRef + document.location.search;
					else return hRef.substr(0, hashPosition) + document.location.search + hRef.substr(hashPosition);
				});
			}
			if ("ontouchstart" in document.documentElement) {
		 		$("a,img").css("touch-action", "manipulation");
			}
		};

		updateLinks();
		srcFilename = filenameForImage($("img"));
		if (srcFilename != null) {
			addDownloadLink(srcFilename);
		}
	
		$("#index,.index").find("a").each(function(){
			$obj = $(this);
			$obj.attr("href", $obj.attr("href")+"#"+document.location.pathname.split('/').pop());
		});
	
		var sideWidth = 0;
		
		function fullscreenActive() {
			return(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement);
		}
		
		function canFullscreen(element) {
			return(element.requestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen || element.msRequestFullscreen);
		}
		
		function launchFullscreen(element) {
			if(element.requestFullscreen) {
				element.requestFullscreen();
			} else if(element.mozRequestFullScreen) {
				element.mozRequestFullScreen();
			} else if(element.webkitRequestFullscreen) {
				element.webkitRequestFullscreen();
			} else if(element.msRequestFullscreen) {
				element.msRequestFullscreen();
			}
			setTimeout(updateImageDimensions, 500);
		}
	
		function exitFullscreen() {
			if (fullscreenActive()) {
				if(document.exitFullscreen) {
					document.exitFullscreen();
				} else if(document.mozCancelFullScreen) {
					document.mozCancelFullScreen();
				} else if(document.webkitExitFullscreen) {
					document.webkitExitFullscreen();
				}
			}
		}

		function toggleFullscreen(element) {
			if (fullscreenActive()) {
				exitFullscreen();
			} else {
				launchFullscreen(element);
			}
		}
		
		function imageObj() {
			var $img = $("#photo").find("img").not("#download");
			
			if ($img.length == 0) {
				$img = $("#content").find("img").not("#download");
			}
			
			return $img;
		}
		
		function fullscreenImage() {
			var $img = imageObj();
			
			if ($img.length > 0) {
				toggleFullscreen($img[0]);
			}
		}
		
		function canFullscreenImage() {
			var $img = imageObj();
			
			if ($img.length > 0) {
				return canFullscreen($img[0]);
			}
			else {
				return false;
			}
		}
		
		document.addEventListener("fullscreenchange", onFullScreenChange, false);
		document.addEventListener("webkitfullscreenchange", onFullScreenChange, false);
		document.addEventListener("mozfullscreenchange", onFullScreenChange, false);
		
		function onFullScreenChange() {
		  var fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;
		
		  if (fullscreenElement == null) {
			  $("img").not("#download").closest('div').attr("tabindex", "-1").focus().blur().removeAttr("tabindex");
		  }
		}
		
		function gotoNext() {
			var $numberElement = $("#next,.next").find("a");

			if ($numberElement != null && $numberElement.length>0) {
				switchToNewPage($numberElement, true);
			}
		}

		function filenameForImage($img) {
			var filename = $img.attr("filename");
			if (filename == null) {
				filename = $img.attr("src");
				if (filename == null && $img.length > 0) {
					filename = $img[0].currentSrc;
				}
				if (filename != null) {
					filename = filename.split("/").pop();
				}
			}
			return(filename);
		}
		
		if ($("video")[0] == null) {
			$("img").not("#download").click(gotoNext);
			$("#photo").click(gotoNext);
			
			if ($("#next,.next").find("a").length > 0) {
				$("img").not("#download").on("load", function() {
					var $obj = $(this);
					var filename = filenameForImage($obj);

					if (filename != null) {
						var digitIndex = filename.search(/\d/);
						
						if (digitIndex >=0) {
							var currentPageNumber = parseInt(filename.substr(digitIndex), 10);

							if (currentPageNumber > 0) {
								var pageSize = useableSize();
								var nextImage = new Image();
								nextImage.width = pageSize[0]
								nextImage.height = pageSize[1]
								filename = filename.replace("-"+currentPageNumber+".", "-"+(currentPageNumber+1)+".");
								nextImage.srcset = srcsetForFilename(filename, $obj.attr("nextsizes"));
							}
						}						
					}
				});
			}
		}
		
		function updateBorderRows(landscape) {
			if (mobileDevice) {
				var borderRows = $(".row");

				if (landscape) {
					borderRows.css("font-size", "1em");
					$("#previous>a").css("background-size", "auto").css("padding-left", "15px");
					$("#next>a").css("background-size", "auto").css("padding-right", "15px");
					$("#index>a").css("background-size", "auto").css("padding-left", "");
					$("#downlink>img").css("transform", "").css("top", 3);
				}
				else {
					borderRows.css("font-size", "2em");
					$("#previous>a").css("background-size", "20px").css("padding-left", "25px");
					$("#next>a").css("background-size", "20px").css("padding-right", "25px");
					$("#index>a").css("background-size", "30px").css("padding-left", "40px");
					$("#downlink>img").css("transform", "scale(2)").css("top", -10);
				}
			}
		}

		var folderScales = [1, 2, 3, 4, 6, 8, 12]

		function srcPathForScale(encodedName, scale) {
			if (scale == 1) {
				return("pictures\/" + encodedName);
			}
			else {
				return("pictures@" + scale + "x\/" + encodedName);
			}
		}

		function srcsetForFilename(filename, numSizes) {
			var parts = filename.split('?')
			parts[0] = encodeURIComponent(parts[0]);
			var encodedName = parts.join('?')
			var sizeCount = (numSizes == null) ? 3 : parseInt(numSizes);
			var baseWidth = 1024;
			var srcSetStr = srcPathForScale(encodedName, 1) + " " + baseWidth + "w";
			for (var i=2; i<=sizeCount; i++) {
				var scale = folderScales[i-1]
				srcSetStr += ", " + srcPathForScale(encodedName, scale) + " " + scale*baseWidth + "w";
			}
			return(srcSetStr)
		}

		function useableSize() {
			var windowWidth = $(window).width();
			var windowHeight = $(window).height();

			if ($("#matte").length>0 && (windowWidth > 4.0 / 3.0 * windowHeight)) {
				windowWidth = 4.0 / 3.0 * windowHeight;
			}

			var hMargin = 10 + sideWidth;
			var landscape = windowWidth > windowHeight;
			var vMargin = 88;
			var borderRows = $(".row");
			
			if (borderRows.length == 2) {
				updateBorderRows(landscape);
				vMargin = 0;
				borderRows.each(function(){
					vMargin += $(this).height();
				});
			}
			
			var $h2 = $("h2");
			
			if ($h2.length > 0 && $("#headerinfo1").length==0) {
				vMargin += $h2.height();
			}
			
			if (fullscreenActive()) {
				hMargin = 0;
				vMargin = 0;
			}
			
			windowWidth = Math.max(320, windowWidth - hMargin);
			windowHeight = Math.max(320, windowHeight - vMargin);

			return([windowWidth, windowHeight]);
		}
	
		function setupMatte() {
			var $matte = $("#matte");
			if ($matte.length == 0) {
				return;
			}
			
			var windowWidth = $(window).width();
			var windowHeight = $(window).height();

			var minWidth = windowWidth;
			if (windowWidth > 4.0 / 3.0 * windowHeight) {
				minWidth = Math.max(320, 4.0 / 3.0 * windowHeight);
			}

			var minPadding = 30;
			var minMargin = 30;
			var matteMargin = 30;

			if (minWidth > windowWidth) {
				matteMargin = 0;
				// console.log("minWidth > ");
			} else if ((minWidth + 2 * minPadding + 2 * minMargin < windowWidth) && (minWidth + 0.5 * (windowWidth - minWidth) > 16.0 / 9.0 * windowHeight)) {
				if (16.0 / 9.0 * windowHeight > minWidth + 2 * minPadding) {
					// console.log("16.9 ");
					matteMargin = 0.5 * (windowWidth - 16.0 / 9.0 * windowHeight);
				} else {
					// console.log("minPadding");
					matteMargin = 0.5 * (windowWidth - minWidth - 2 * minPadding);
				}
			} else {
				matteMargin = (windowWidth - minWidth) / 4.0;
				// console.log("splitting padding ");
			}


			$matte.attr("style", "margin: 0 " + matteMargin + "px");
		}

		function updateImageDimensions() {
			$("img").not("#download").each(function() {
				var $obj = $(this);
				var width = $obj.attr("originalWidth");
				var height = $obj.attr("originalHeight");
				
				if (width == null) {
					width = $obj.width();
					height = $obj.height();
					$obj.attr("originalWidth", width);
					$obj.attr("originalHeight", height);
				}
				
				var borderThickness = 0;
				var borderValue = $("body").attr("borderthick");
				if (borderValue != null) {
					borderThickness = parseInt(borderValue);
				}

				var size = useableSize()
				var windowWidth = size[0] - 2 * borderThickness;
				var windowHeight = size[1] - 2 * borderThickness;
				var newWidth = width;
				var newHeight = height;
				var aspectRatio = width / height;
				
				if (aspectRatio < windowWidth/windowHeight) {
					newWidth = Math.floor(windowHeight * aspectRatio);
					newHeight = windowHeight;
				}
				else {
					newHeight = Math.floor(windowWidth / aspectRatio);
					newWidth = windowWidth;
				}
				
				$obj.attr("width", newWidth);
				$obj.attr("height", newHeight);
				
				var vOffset = (windowHeight - newHeight) * 0.5;
				$obj.parent().css("margin-top", vOffset + "px");
				$obj.parent().css("margin-bottom", vOffset + "px");
					
				$(".detail").eq(0).css("width", ((windowWidth + 2 * borderThickness) + "px"));
				$(".row").eq(1).css("width", ((windowWidth + 2 * borderThickness) + "px"));

				setupMatte();

				if ($obj.attr("srcset") == null && $obj.attr("filename") != null) {
					$obj.attr("src", null);
					$obj.attr("srcset", srcsetForFilename($obj.attr("filename"), $obj.attr("sizes")));
				}
			});
		};
		
		function handleClick() {
			window.event.preventDefault();
			switchToNewPage($(this), true);
		}
			
		function updateItems() {
			$("#previous,li.previous").attr("title", "Previous (left arrow)");
			$("#previous,li.previous").find("a").click(handleClick);
			$("#next,.next").attr("title", "Next (spacebar or right arrow)");
			$("#next,.next").find("a").click(handleClick);
			$("#index,li.index").attr("title", "Goto Index (i)");
			$("#index,li.index").find("a").click(handleClick);
			$("strong:empty").remove();
			$("li").not(".pagenumber").each(function(){
				let $obj = $(this);
				
				if ($obj.text().length < 2) {
					$obj.remove()
				};
			});
			$("#metadata > strong").each(function(){
				let $obj = $(this);
				let t = $obj.text();
				let separator = " • ";
				let parts = t.split(separator);
				
				if (parts.length > 0) {
					first = parts.shift();
					$obj.text(separator + parts.join(separator));
					let $newSpan = $("<span>" + first + "</span>").css( { "cursor": "copy", "text-decoration": "underline", "text-decoration-style": "dashed", "position": "relative" } );
					let $popup = $("<span>Copied to clipboard</span>").css( { "display": "none", "width": "max-content", "background-color": "#555", "color": "#fff", "border-radius": "6px", "padding": "6px 10px", "position": "absolute", "z-index": "1", "bottom": "125%", "left": "50%" });
					$newSpan.append($popup);
					$obj.prepend($newSpan);
					$newSpan.on("click", function() {
						if (navigator.clipboard) {
							navigator.clipboard.writeText(first);
							$popup.show().delay(600).fadeOut(300);
						}
						else {
							let input = document.createElement('textarea');
							input.innerHTML = first;
							document.body.appendChild(input);
							input.select();
							let result = document.execCommand('copy');
							document.body.removeChild(input);
							$popup.show().delay(600).fadeOut(300);
						}
					});
				}
			});
		};
		
		var $sideBar = $("td.sideinfo");
		
		if ($sideBar.length == 1) {
			sideWidth = $sideBar.width() + 10;
		}
		
		if ($("h2").length > 0) {
			$("body").css("display", "inline");
		}
		
		$("#photo > img").css( { "display": "block", "margin-left": "auto", "margin-right": "auto" } );
		$("div.detail").css("padding-top", "0px");
		updateItems();
	
		$("#footer > p,#footer > li").not("a").wrapInner('<a href="../../index.html"></a>');
			
		if ($("td.sideinfo").length == 0 && $("ul#photoInfo").length == 0 && $("div#headerinfo1").length == 0) {
			$('<style type=\"text/css\">ul:not(#nav) li { list-style: none; display: inline; } ul:not(#nav) li:after { content: " -"; } ul:not(#nav) li:last-child:after { content: none; }</style>').appendTo( "head" );
		}
		
		if ($("#headerinfo1").length) {
			$("#header").insertAfter($("div#footer"));
		}

	   	$("body").css("display", "inline");
		
		updateImageDimensions();
	
	   	var imageSwitchInProgress = false;
	   	
		function moveElement($srcObj, $destObj, selector) {
			$destObj.find(selector).replaceWith($srcObj.find(selector));
		};

		function pushState(hRef) {
			history.pushState({ ref: hRef }, "", hRef);
		}
		
		if (window.history && history.pushState) {
			var currentRef = window.location.href.split("/").pop();
			history.replaceState( { ref: currentRef }, "", currentRef);
		}

		var targetRef = null;
		function setRef() {
			if (targetRef != null) {
				document.location.href = targetRef;
			}
		}

		var $waitElement = null;

		function removeWait() {
			if ($waitElement != null) {
				$waitElement.css("opacity", "1.0");
				$waitElement = null;
			}
		}
		
		function showWait($element) {
			removeWait();
			$waitElement = $element;
			$waitElement.css("opacity", "0.75");
		}
		
		function replaceAll(str, search, replace) {
			return str.split(search).join(replace)
		}

		function switchToRef(hRef, canDoLocal) {
			if (canDoLocal && window.history && history.pushState) {
				if (!imageSwitchInProgress) {
					var $newBody = $("<body></body>");
					
					imageSwitchInProgress = true;
					$newBody.load(hRef, function() {
						var $body = $("body");
						var $srcImg = $newBody.find("#photo").find("img");
						var $destImg = $body.find("#photo").find("img").not("#download");
						
						if ($srcImg.length == 0 && $destImg.length == 0) {
							var $srcImg = $newBody.find("#content").find("img");
							var $destImg = $body.find("#content").find("img").not("#download");
						}
						
						if ($srcImg.length && $destImg.length) {
							var srcFileName = $srcImg.attr("filename");
							var destFileName = $destImg.attr("filename");
							var curSrcFileName = $destImg[0].currentSrc
							var setFileName = true;
							
							if (srcFileName == null) {
								srcFileName = $srcImg.attr("src").split("/").pop();
								destFileName = $destImg.attr("src").split("/").pop();
								setFileName = false;
							}
							
							if (srcFileName != null && srcFileName.length > 0 && destFileName != null && destFileName.length > 0 && curSrcFileName != null && curSrcFileName.length>0) {
								var srcRef = $destImg.attr("src");
								var srcsetRef = $destImg.attr("srcset");
								
								if (srcRef != null && srcRef.length>0) {
									srcRef = replaceAll(srcRef, destFileName, srcFileName);
								}
								if (srcsetRef != null && srcsetRef.length > 0) {
									srcsetRef = srcsetForFilename(srcFileName, $srcImg.attr("sizes"))
								}
								
								var tempImage = new Image();
								tempImage.onload = function() {
									$destImg.attr("originalWidth", $srcImg.attr("width"));
									$destImg.attr("originalHeight", $srcImg.attr("height"));
									$destImg.attr("sizes", $srcImg.attr("sizes"))
									$destImg.attr("nextsizes", $srcImg.attr("nextsizes"))
									if (srcRef != null && srcRef.length>0) {
										$destImg.attr("src", srcRef);
									}
									if (srcsetRef != null && srcsetRef.length > 0) {
										$destImg.attr("srcset", srcsetRef);
									}
									if (setFileName) {
										$destImg.attr("filename", srcFileName);
									}
									removeWait();
									updateImageDimensions();
									imageSwitchInProgress = false;
									$("div.detail").css("padding-top", "0px");
								}
								var size = useableSize()
								tempImage.width = size[0];
								tempImage.height = size[1];
								if (srcRef != null && srcRef.length>0) {
									tempImage.src = replaceAll(curSrcFileName, destFileName, srcFileName);
								}
								if (srcsetRef != null && srcsetRef.length > 0) {
									tempImage.srcset = srcsetRef;
								}
								if (!tempImage.complete) {
									showWait($destImg.parent());
								}
							
								moveElement($newBody, $body, "#previous");
								moveElement($newBody, $body, "#next");
								moveElement($newBody, $body, "#current");
								$body.find('[id="metadata"]:gt(0)').remove();
								moveElement($newBody, $body, "#metadata");
								moveElement($newBody, $body, "#index");
								moveElement($newBody, $body, "p.index");
								moveElement($newBody, $body, "ul#nav");
								moveElement($newBody, $("head"), "title");
								var newTitle = document.title.split(" - ")[0].split("@1x")[0];
								if (/\d\d\d\d-\d\d-\d\d-/.test(newTitle)) {
									newTitle= newTitle.slice(11);
								}
								document.title = newTitle;

								addDownloadLink(srcFileName);
	
								$("#index,.index").find("a").each(function(){
									$obj = $(this);
									$obj.attr("href", $obj.attr("href")+"#"+hRef);
								});
								updateLinks();
								updateItems();
							}
							else {
								exitFullscreen();
								document.location.href = hRef;
							}
						}
						else {
							exitFullscreen();
							document.location.href = hRef;
						}
					});
				}
			}
			else {
				targetRef = hRef;
				if (fullscreenActive()) {
					exitFullscreen();
					setTimeout(setRef, 1000);
				}
				else {
					setRef();
				}
			}
		};

	   	function switchToNewPage($numberElement, canDoLocal) {
			if ($numberElement != null && $numberElement.length>0) {
				var hRef = $numberElement.attr("href");
				if (canDoLocal && hRef.includes("index")) {
					canDoLocal = false;
				}
				if (canDoLocal) {
					try {
						pushState(hRef);
					}
					catch {
						canDoLocal = false;
					}
				}
				switchToRef(hRef, canDoLocal);
			}
		};
	   	
		$(document).keydown(function(event) {
			var handled = true;
			var $numberElement = null;
			var canDoLocal = false;
			
			switch (event.which) {
				case 33:	/* page up */
				case 37:	/* left */
				case 38:	/* up */
					$numberElement = $("#previous,.previous").find("a");
					canDoLocal = true;
					break;
				case 32:	/* spacebar */
					if ($("video")[0] != null) {
						handled = false;
						break;
					}
					// fall into next case
				case 9: 	/* tab */
					if (event.which==9 && canFullscreenImage() && !fullscreenActive()) {
						fullscreenImage();
						break;
					}
					// fall into next case
				case 66:	/* stop-start, B */
				case 34:	/* page down */
				case 39:	/* right */
				case 40: 	/* down */
					$numberElement = $("#next,.next").find("a");
					
					if ($numberElement.length==0) {
						$numberElement = $("#index,.index").find("a");
					}
					else {
						canDoLocal = true;
					}
					break;
				case 38:	/* up */
				case 73:	/* i */
					if (!event.altKey && !event.shiftKey && !event.ctrlKey) {
						$numberElement = $("#index,.index").find("a");
					} else {
						handled = false;
					}
					break;
				case 70:	/* f - fullscreen */
					if (!event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
						fullscreenImage();
					}
					else {
						handled = false;
					}
					break;
				default:
					handled = false;
					break;
			}
		
			if (handled) {
				event.preventDefault();
			}
			
			switchToNewPage($numberElement, canDoLocal);
		});
		
		$(window).resize(function() {
			updateImageDimensions();
		});
		
		window.onpopstate = function(event) {
			if (event.state != null) {
				hRef = event.state["ref"];
				
				if (hRef != null) {
					switchToRef(hRef, true);
				}
			}
		};
	});
}
