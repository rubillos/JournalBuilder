var imagePageLoaded;

if (imagePageLoaded == null) {
	imagePageLoaded = true;

	function findID(id) {
		return document.getElementById(id);
	}
	
	function find(selector) {
		return document.querySelectorAll(selector);
	}
	
	function findOne(selector) {
		return document.querySelector(selector);
	}
	
	function setClick(element, func) {
		if (element) {
			element.onclick = func;
		}
	}

	var root = (typeof exports === 'undefined' ? window : exports);
	var mobileDevice = (screen.width < 700);
	
	var newTitle = document.title.split(" - ")[0].split("@1x")[0];
	if (/\d\d\d\d-\d\d-\d\d-/.test(newTitle)) {
		newTitle= newTitle.slice(11);
	}
	document.title = newTitle;

	document.addEventListener("DOMContentLoaded", function() {
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
			if (document.body.classList.contains("nodownload")) {
				return;
			}

			let iconSize = 32;
			let top = 3;
			let current = findOne("div#current");
			let colorElement = current;

			if (!current || !colorElement) {
				current = findOne("ul#nav");
				colorElement = findOne("li.index");
				iconSize = 16;
				top = 1;
			}
			if (!current || !colorElement) {
				current = findOne("ul#nav");
				colorElement = findOne("li.pagenumber");
				iconSize = 32;
				top = 10;
			}

			if (current && colorElement) {
				const textGray = colorToGray(getComputedStyle(colorElement).color);
				const invert = colorToGray(getComputedStyle(document.body).backgroundColor) < 0.3;
				const opacity = invert ? textGray : 1.0 - textGray;
				const baseURL = getBaseURL();
				let currentPath = window.location.href.replace(baseURL, "");

				currentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));

				const iconPath = `${baseURL}FrontPageGraphics/download.png`;
				const phpPath = `${baseURL}download/download.php`;

				let download = document.createElement("a");
				download.id = "downlink";
				download.href = `${phpPath}?file=${imageName}&path=${currentPath}`;
				download.title = "Download Full Image";

				const img = document.createElement("img");
				img.id = "download";
				img.src = iconPath;
				img.width = iconSize;
				img.height = iconSize;
				img.style.position = "relative";
				img.style.top = `${top}px`;
				img.style.paddingLeft = `${iconSize}px`;
				img.style.opacity = opacity;
				img.style.backgroundColor = "transparent";

				if (invert) {
					img.style.filter = "invert(1)";
				}

				download.appendChild(img);

				const existingDownload = findOne("#downlink");
				if (existingDownload) {
					existingDownload.onclick = null;
					existingDownload.remove();
				}

				current.appendChild(download);
				download = null;

				if (canFullscreenImage()) {
					setClick(current, fullscreenImage);
					current.style.cursor = "pointer";
				}
			}
		}
		
		const img = imageObj();
		if (img) {
			img.onload = function() {
				const curSrc = img.currentSrc;
				if (curSrc != null) {
					const regex = /pictures@([^\/]*)\//;
					const match = curSrc.match(regex);
					if (match) {
						const metadataElements = find("#metadata > strong, #metadata > li > strong");
						if (metadataElements.length > 0) {
							const lastElement = metadataElements[metadataElements.length - 1];
							const children = lastElement.childNodes;
							if (children.length > 0) {
								const lastChild = children[children.length - 1];
								if (lastChild.nodeType === Node.TEXT_NODE) {
									const separator = " • ";
									let textContent = lastChild.textContent;
									if (!textContent.endsWith(separator)) {
										textContent += separator;
									}
									lastChild.textContent = textContent + `${match[1]}`;
								}
							}
						}
					}
				}
			};
		}

		function updateLinks() {
			if (document.location.search.length > 1) {
				find("a").forEach(anchor => {
					let href = anchor.getAttribute("href");
					let hRef = removeSearch(href);
					let hashPosition = hRef.indexOf("#");

					if (hashPosition === -1) {
						anchor.setAttribute("href", hRef + document.location.search);
					} else {
						anchor.setAttribute("href", hRef.substr(0, hashPosition) + document.location.search + hRef.substr(hashPosition));
					}
				});
			}
			if ("ontouchstart" in document.documentElement) {
				find("a, img").forEach(element => {
					element.style.touchAction = "manipulation";
				});
			}
		}

		updateLinks();
		const srcFilename = filenameForImage(findOne("img"));
		if (srcFilename != null) {
			addDownloadLink(srcFilename);
		}

		find("#index a,.index a").forEach(anchor => {
			const href = anchor.getAttribute("href");
			anchor.setAttribute("href", `${href}#${document.location.pathname.split('/').pop()}`);
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
			let img = findOne("#photo > img:not(#download)");
			
			if (!img) {
				img = findOne("#content > img:not(#download)");
			}
			
			return img;
		}
		
		function fullscreenImage() {
			const img = imageObj();
			
			if (img) {
				toggleFullscreen(img);
			}
		}
		
		function canFullscreenImage() {
			const img = imageObj();
			
			if (img) {
				return canFullscreen(img);
			} else {
				return false;
			}
		}
		
		document.addEventListener("fullscreenchange", onFullScreenChange, false);
		document.addEventListener("webkitfullscreenchange", onFullScreenChange, false);
		document.addEventListener("mozfullscreenchange", onFullScreenChange, false);
		
		function onFullScreenChange() {
			const fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;

			if (fullscreenElement == null) {
				find("img:not(#download)").forEach(img => {
					const parentDiv = img.closest('div');
					if (parentDiv) {
						parentDiv.setAttribute("tabindex", "-1");
						parentDiv.focus();
						parentDiv.blur();
						parentDiv.removeAttribute("tabindex");
					}
				});
			}
		}

		function gotoNext(e) {
			const nextLink = findOne("#next a, .next a");

			if (nextLink) {
				e.preventDefault();
				switchToNewPage(nextLink, true);
			}
		}

		function filenameForImage(img) {
			let filename = img.getAttribute("filename");
			if (!filename) {
				filename = img.getAttribute("src");
				if (!filename && img.currentSrc) {
					filename = img.currentSrc;
				}
				if (filename) {
					filename = filename.split("/").pop();
				}
			}
			return filename;
		}
		
		if (!findOne("video")) {
			find("img:not(#download)").forEach(img => {
				setClick(img, gotoNext);
			});
			const photo = findOne("#photo");
			if (photo) {
				setClick(photo, gotoNext);
			}

			const nextLink = findOne("#next a, .next a");
			if (nextLink) {
				find("img:not(#download)").forEach(img => {
					img.onload = function () {
						const filename = filenameForImage(img);

						if (filename) {
							const digitIndex = filename.search(/\d/);

							if (digitIndex >= 0) {
								const currentPageNumber = parseInt(filename.substr(digitIndex), 10);

								if (currentPageNumber > 0) {
									const pageSize = useableSize();
									const nextImage = new Image();
									nextImage.width = pageSize[0];
									nextImage.height = pageSize[1];
									const nextFilename = filename.replace(
										`-${currentPageNumber}.`,
										`-${currentPageNumber + 1}.`
									);
									nextImage.srcset = srcsetForFilename(nextFilename, img.getAttribute("nextsizes"));
								}
							}
						}
					};
				});
			}
		}
		
		function updateBorderRows(landscape) {
			if (mobileDevice) {
				const borderRows = find(".row");

				borderRows.forEach(row => {
					row.style.fontSize = landscape ? "1em" : "2em";
				});

				const previousLink = findOne("#previous a");
				const nextLink = findOne("#next a");
				const indexLink = findOne("#index a");
				const downloadImg = findOne("#downlink > img");

				if (landscape) {
					if (previousLink) {
						previousLink.style.backgroundSize = "auto";
						previousLink.style.paddingLeft = "15px";
					}
					if (nextLink) {
						nextLink.style.backgroundSize = "auto";
						nextLink.style.paddingRight = "15px";
					}
					if (indexLink) {
						indexLink.style.backgroundSize = "auto";
						indexLink.style.paddingLeft = "";
					}
					if (downloadImg) {
						downloadImg.style.transform = "";
						downloadImg.style.top = "3px";
					}
				} else {
					if (previousLink) {
						previousLink.style.backgroundSize = "20px";
						previousLink.style.paddingLeft = "25px";
					}
					if (nextLink) {
						nextLink.style.backgroundSize = "20px";
						nextLink.style.paddingRight = "25px";
					}
					if (indexLink) {
						indexLink.style.backgroundSize = "30px";
						indexLink.style.paddingLeft = "40px";
					}
					if (downloadImg) {
						downloadImg.style.transform = "scale(2)";
						downloadImg.style.top = "-10px";
					}
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
			let windowWidth = window.innerWidth;
			let windowHeight = window.innerHeight;

			const matte = findOne("#matte");
			if (matte && (windowWidth > 4.0 / 3.0 * windowHeight)) {
				windowWidth = 4.0 / 3.0 * windowHeight;
			}

			let hMargin = 10 + sideWidth;
			const landscape = windowWidth > windowHeight;
			let vMargin = 88;
			const borderRows = find(".row");

			if (borderRows.length === 2) {
				updateBorderRows(landscape);
				vMargin = 0;
				borderRows.forEach(row => {
					vMargin += row.offsetHeight;
				});
			}

			const h2 = findOne("h2");
			if (h2 && !findOne("#headerinfo1")) {
				vMargin += h2.offsetHeight;
			}

			if (fullscreenActive()) {
				hMargin = 0;
				vMargin = 0;
			}

			windowWidth = Math.max(320, windowWidth - hMargin);
			windowHeight = Math.max(320, windowHeight - vMargin);

			return [windowWidth, windowHeight];
		}
	
		function setupMatte() {
			const matte = findID("matte");
			if (!matte) {
				return;
			}

			const windowWidth = window.innerWidth;
			const windowHeight = window.innerHeight;

			let minWidth = windowWidth;
			if (windowWidth > 4.0 / 3.0 * windowHeight) {
				minWidth = Math.max(320, 4.0 / 3.0 * windowHeight);
			}

			const minPadding = 30;
			const minMargin = 30;
			let matteMargin = 30;

			if (minWidth > windowWidth) {
				matteMargin = 0;
			} else if (
				minWidth + 2 * minPadding + 2 * minMargin < windowWidth &&
				minWidth + 0.5 * (windowWidth - minWidth) > 16.0 / 9.0 * windowHeight
			) {
				if (16.0 / 9.0 * windowHeight > minWidth + 2 * minPadding) {
					matteMargin = 0.5 * (windowWidth - 16.0 / 9.0 * windowHeight);
				} else {
					matteMargin = 0.5 * (windowWidth - minWidth - 2 * minPadding);
				}
			} else {
				matteMargin = (windowWidth - minWidth) / 4.0;
			}

			matte.style.margin = `0 ${matteMargin}px`;
		}

		function updateImageDimensions() {
			find("img:not(#download)").forEach(img => {
				let width = img.getAttribute("originalWidth");
				let height = img.getAttribute("originalHeight");

				if (!width) {
					width = img.width;
					height = img.height;
					img.setAttribute("originalWidth", width);
					img.setAttribute("originalHeight", height);
				}

				let borderThickness = 0;
				const borderValue = document.body.getAttribute("borderthick");
				if (borderValue) {
					borderThickness = parseInt(borderValue, 10);
				}

				const size = useableSize();
				const windowWidth = size[0] - 2 * borderThickness;
				const windowHeight = size[1] - 2 * borderThickness;
				let newWidth = width;
				let newHeight = height;
				const aspectRatio = width / height;

				if (aspectRatio < windowWidth / windowHeight) {
					newWidth = Math.floor(windowHeight * aspectRatio);
					newHeight = windowHeight;
				} else {
					newHeight = Math.floor(windowWidth / aspectRatio);
					newWidth = windowWidth;
				}

				img.setAttribute("width", newWidth);
				img.setAttribute("height", newHeight);

				const vOffset = (windowHeight - newHeight) * 0.5;
				const parent = img.parentElement;
				if (parent) {
					parent.style.marginTop = `${vOffset}px`;
					parent.style.marginBottom = `${vOffset}px`;
				}

				const detail = findOne(".detail");
				if (detail) {
					detail.style.width = `${windowWidth + 2 * borderThickness}px`;
				}
				const rows = find(".row");
				if (rows.length >= 2) {
					rows[1].style.width = `${windowWidth + 2 * borderThickness}px`;
				}

				setupMatte();

				if (!img.getAttribute("srcset") && img.getAttribute("filename")) {
					img.setAttribute("src", "");
					img.setAttribute("srcset", srcsetForFilename(img.getAttribute("filename"), img.getAttribute("sizes")));
				}
			});
		};
		
		function handleClick(e) {
			e.preventDefault();
			switchToNewPage(this, true);
		}
			
		function updateItems() {
			find("#previous,li.previous").forEach(el => {
				el.setAttribute("title", "Previous (left arrow)");
				setClick(el.querySelector("a"), handleClick);
			});

			find("#next,.next").forEach(el => {
				el.setAttribute("title", "Next (spacebar or right arrow)");
				setClick(el.querySelector("a"), handleClick);
			});

			find("#index,li.index").forEach(el => {
				el.setAttribute("title", "Goto Index (i)");
				setClick(el.querySelector("a"), handleClick);
			});

			find("strong:empty").forEach(el => el.remove());

			find("li:not(.pagenumber)").forEach(el => {
				if (el.textContent.trim().length < 2) {
					el.remove();
				}
			});

			find("#metadata > strong").forEach(el => {
				let text = el.textContent;
				let separator = " • ";
				let parts = text.split(separator);

				if (parts.length > 0) {
					let first = parts.shift();
					el.textContent = separator + parts.join(separator);

					let newSpan = document.createElement("span");
					newSpan.textContent = first;
					newSpan.style.cursor = "copy";
					newSpan.style.textDecoration = "underline";
					newSpan.style.textDecorationStyle = "dashed";
					newSpan.style.position = "relative";

					let popup = document.createElement("span");
					popup.textContent = "Copied to clipboard";
					popup.style.display = "none";
					popup.style.width = "max-content";
					popup.style.backgroundColor = "#555";
					popup.style.color = "#fff";
					popup.style.borderRadius = "6px";
					popup.style.padding = "6px 10px";
					popup.style.position = "absolute";
					popup.style.zIndex = "1";
					popup.style.bottom = "125%";
					popup.style.left = "50%";

					newSpan.appendChild(popup);
					el.prepend(newSpan);

					setClick(newSpan, function () {
						if (navigator.clipboard) {
							navigator.clipboard.writeText(first);
						} else {
							let input = document.createElement("textarea");
							input.value = first;
							document.body.appendChild(input);
							input.select();
							document.execCommand("copy");
							document.body.removeChild(input);
						}
						popup.style.display = "block";
						setTimeout(() => {
							popup.style.display = "none";
						}, 900);
					});
				}
			});
		}
		
		const sideBar = findOne("td.sideinfo");
		
		if (sideBar) {
			sideWidth = sideBar.offsetWidth + 10;
		}
		
		if (findOne("h2")) {
			document.body.style.display = "inline";
		}
		
		const photoImg = findOne("#photo > img");
		if (photoImg) {
			photoImg.style.display = "block";
			photoImg.style.marginLeft = "auto";
			photoImg.style.marginRight = "auto";
		}
		
		const detail = findOne("div.detail");
		if (detail) {
			detail.style.paddingTop = "0px";
		}
		
		updateItems();
	
		find("#footer > p, #footer > li").forEach(el => {
			if (!el.querySelector("a")) {
				const link = document.createElement("a");
				link.href = "../../index.html";
				link.innerHTML = el.innerHTML;
				el.innerHTML = "";
				el.appendChild(link);
			}
		});
			
		if (!findOne("td.sideinfo") && 
			!findOne("ul#photoInfo") && 
			!findOne("div#headerinfo1")) {
			const style = document.createElement("style");
			style.type = "text/css";
			style.textContent = `
				ul:not(#nav) li { list-style: none; display: inline; }
				ul:not(#nav) li:after { content: " -"; }
				ul:not(#nav) li:last-child:after { content: none; }
			`;
			document.head.appendChild(style);
		}
		
		const headerInfo = findOne("#headerinfo1");
		if (headerInfo) {
			const header = findOne("#header");
			const footer = findOne("div#footer");
			if (header && footer) {
				footer.insertAdjacentElement("afterend", header);
			}
		}

		document.body.style.display = "inline";
		updateImageDimensions();
	
	   	var imageSwitchInProgress = false;
	   	
		function moveElement(srcObj, destObj, selector) {
			const srcElement = srcObj.querySelector(selector);
			const destElement = destObj.querySelector(selector);
			if (srcElement && destElement) {
				destElement.replaceWith(srcElement);
			}
		};

		let lastPushedState = null;

		function pushState(hRef) {
			if (hRef !== lastPushedState) {
				history.pushState({ ref: hRef }, "", hRef);
				lastPushedState = hRef;
			}
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

		let waitElement = null;

		function removeWait() {
			if (waitElement != null) {
				waitElement.style.opacity = "1.0";
				waitElement = null;
			}
		}

		function showWait(element) {
			removeWait();
			waitElement = element;
			waitElement.style.opacity = "0.75";
		}

		function replaceAll(str, search, replace) {
			if (search === "") return str;
			return str.split(search).join(replace);
		}

		let waitTimer = null;

		function cancelWaitTimer() {
			if (waitTimer != null) {
				clearTimeout(waitTimer);
				waitTimer = null;
			}
		}

		async function switchToRef(hRef, canDoLocal) {
			if (imageSwitchInProgress) {
				console.warn("Image switch already in progress, ignoring request.");
				return;
			}
		
			imageSwitchInProgress = true;
		
			try {
				if (canDoLocal && window.history && history.pushState) {
					const newBody = document.createElement("body");
					const response = await fetch(hRef);
					const html = await response.text();
					newBody.innerHTML = html;

					const body = document.body;
					let srcImg = newBody.querySelector("#photo img");
					let destImg = body.querySelector("#photo img:not(#download)");

					if (!srcImg && !destImg) {
						srcImg = newBody.querySelector("#content img");
						destImg = body.querySelector("#content img:not(#download)");
					}

					if (srcImg && destImg) {
						let srcFileName = srcImg.getAttribute("filename");
						let destFileName = destImg.getAttribute("filename");
						const curSrcFileName = destImg.currentSrc;
						let setFileName = true;

						if (!srcFileName) {
							srcFileName = srcImg.getAttribute("src").split("/").pop();
							destFileName = destImg.getAttribute("src").split("/").pop();
							setFileName = false;
						}

						if (srcFileName && destFileName && curSrcFileName) {
							let srcRef = destImg.getAttribute("src");
							let srcsetRef = destImg.getAttribute("srcset");

							if (srcRef) {
								srcRef = replaceAll(srcRef, destFileName, srcFileName);
							}
							if (srcsetRef) {
								srcsetRef = srcsetForFilename(srcFileName, srcImg.getAttribute("sizes"));
							}

							const tempImage = new Image();
							tempImage.onload = function () {
								destImg.setAttribute("originalWidth", srcImg.getAttribute("width"));
								destImg.setAttribute("originalHeight", srcImg.getAttribute("height"));
								destImg.setAttribute("sizes", srcImg.getAttribute("sizes"));
								destImg.setAttribute("nextsizes", srcImg.getAttribute("nextsizes"));
								if (srcRef) {
									destImg.setAttribute("src", srcRef);
								}
								if (srcsetRef) {
									destImg.setAttribute("srcset", srcsetRef);
								}
								if (setFileName) {
									destImg.setAttribute("filename", srcFileName);
								}
								cancelWaitTimer();
								removeWait();
								updateImageDimensions();
								imageSwitchInProgress = false;
								const detail = findOne("div.detail");
								if (detail) {
									detail.style.paddingTop = "0px";
								}
							};
							const size = useableSize();
							tempImage.width = size[0];
							tempImage.height = size[1];
							if (srcRef) {
								tempImage.src = replaceAll(curSrcFileName, destFileName, srcFileName);
							}
							if (srcsetRef) {
								tempImage.srcset = srcsetRef;
							}

							if (!tempImage.complete) {
								waitTimer = setTimeout(() => {
									if (!tempImage.complete) {
										showWait(destImg.parentElement);
									}
									waitTimer = null;
								}, 20);
							}

							moveElement(newBody, body, "#previous");
							moveElement(newBody, body, "#next");
							moveElement(newBody, body, "#current");
							body.querySelectorAll('[id="metadata"]:not(:first-child)').forEach(el => el.remove());
							moveElement(newBody, body, "#metadata");
							moveElement(newBody, body, "#index");
							moveElement(newBody, body, "p.index");
							moveElement(newBody, body, "ul#nav");
							moveElement(newBody, document.head, "title");
							let newTitle = document.title.split(" - ")[0].split("@1x")[0];
							if (/\d\d\d\d-\d\d-\d\d-/.test(newTitle)) {
								newTitle = newTitle.slice(11);
							}
							document.title = newTitle;

							addDownloadLink(srcFileName);

							find("#index a,.index a").forEach(anchor => {
								anchor.setAttribute("href", `${anchor.getAttribute("href")}#${hRef}`);
							});
							updateLinks();
							updateItems();
						} else {
							exitFullscreen();
							document.location.href = hRef;
						}
					} else {
						exitFullscreen();
						document.location.href = hRef;
					}
				} else {
					targetRef = hRef;
					if (fullscreenActive()) {
						exitFullscreen();
						setTimeout(setRef, 1000);
					} else {
						setRef();
					}
				}
			} catch (error) {
				console.error("Error switching to ref:", error);
				document.location.href = hRef; // Fallback to full page reload
			} finally {
				imageSwitchInProgress = false;
			}
		}

		function switchToNewPage(numberElement, canDoLocal) {
			if (numberElement) {
				const hRef = numberElement.getAttribute("href");
				if (canDoLocal && hRef.includes("index")) {
					canDoLocal = false;
				}
				if (canDoLocal) {
					try {
						pushState(hRef);
					} catch {
						canDoLocal = false;
					}
				}
				switchToRef(hRef, canDoLocal);
			}
		}
	   	
		document.addEventListener("keydown", function(event) {
			let handled = true;
			let numberElement = null;
			let canDoLocal = false;

			switch (event.key) {
				case "PageUp": /* page up */
				case "ArrowLeft": /* left */
				case "ArrowUp": /* up */
					numberElement = findOne("#previous a, .previous a");
					canDoLocal = true;
					break;
				case " ": /* spacebar */
					if (findOne("video") != null) {
						handled = false;
						break;
					}
					// fall into next case
				case "Tab": /* tab */
					if (event.key === "Tab" && canFullscreenImage() && !fullscreenActive()) {
						fullscreenImage();
						break;
					}
					// fall into next case
				case "b": /* stop-start, B */
				case "PageDown": /* page down */
				case "ArrowRight": /* right */
				case "ArrowDown": /* down */
					numberElement = findOne("#next a, .next a");

					if (!numberElement) {
						numberElement = findOne("#index a, .index a");
					} else {
						canDoLocal = true;
					}
					break;
				case "i": /* i */
					if (!event.altKey && !event.shiftKey && !event.ctrlKey) {
						numberElement = findOne("#index a, .index a");
					} else {
						handled = false;
					}
					break;
				case "f": /* f - fullscreen */
					if (!event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
						fullscreenImage();
					} else {
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

			switchToNewPage(numberElement, canDoLocal);
		});

		window.addEventListener("resize", function() {
			updateImageDimensions();
		});

		window.onpopstate = function(event) {
			if (event.state != null) {
				const hRef = event.state["ref"];

				if (hRef != null) {
					if (!imageSwitchInProgress) {
						switchToRef(hRef, true);
					} else {
						console.warn("Image switch in progress, ignoring popstate.");
					}
				}
			}
		};
	});
}
