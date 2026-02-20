let indexPageLoaded;

if (indexPageLoaded == null) {
	indexPageLoaded = true;

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
		document.addEventListener("touchstart", function(event) {}, { passive: true });
		document.addEventListener("touchmove", function(event) {}, { passive: true });
		document.addEventListener("scroll", function(event) {}, { passive: true });
		window.addEventListener("resize", function(event) {}, { passive: true });
		document.addEventListener("mouseenter", function(event) {}, { passive: true });
		document.addEventListener("mouseleave", function(event) {}, { passive: true });
		
		String.prototype.splitLines = function() {
			return this.split(/\r\n|\r|\n/g);
		};
		
		var version_attr = document.body.getAttribute("version");
		var version = (version_attr !== null && version_attr.length > 0) ? parseInt(version_attr) : 1;
		
		if (version < 2) {
			var newTitle = document.title.split(" - ")[0].split("@1x")[0].split("• ").join("").split(" •").join("");
			if (/\d\d\d\d-\d\d-\d\d-/.test(newTitle)) {
				newTitle = newTitle.slice(11);
			}
			document.title = newTitle;
		}

		let screenWidth = screen.width;
		let contentWidth = 800;
		let mobileDevice = false;
		let panopage = false;
		let content = findID("content");
		let videoElements = [];
		let maxZoom = 120;
		let pageZoom = 100;
		let isLocal = false;

		let margins = (screenWidth < 700) ? 40 : 80;
		
		if (window.visualViewport != null) {
			if (window.visualViewport.width < 500) {
				screenWidth = 680;
			}
		}
		
		if (content) {
			contentWidth = content.offsetWidth;
		}
		if (contentWidth == 0) {
			const headerImg = document.querySelector("#headerImg > img");
			contentWidth = headerImg ? headerImg.offsetWidth : 0;
		}
		
		if ((screenWidth < contentWidth) && (findOne('head > meta[name="viewport"]') === null)) {
			const meta = document.createElement('meta');
			meta.name = "viewport";
			meta.content = `width=${contentWidth + margins}`;
			document.head.appendChild(meta);
		} else {
			if (document.location.href.includes("Users/mediaserver") && window.innerWidth > (contentWidth + 100) && find(".sideinfo").length === 0) {
				maxZoom = 150;
				isLocal = true;
			}

			updateZoom();

			window.addEventListener("resize", function() {
				updateZoom();
			});
		}
		
		function updateZoom() {
			if (contentWidth + margins > window.innerWidth) {
				var zoom = Math.max(50, (window.innerWidth / (contentWidth + margins)) * 100);
				document.body.style.zoom = zoom + "%";
			} else if (document.body.style.zoom) {
				var zoomText = document.body.style.zoom;
				var currentZoom = parseFloat(zoomText);

				if (!zoomText.endsWith("%")) {
					currentZoom *= 100.0;
				}

				var zoomScale = window.innerWidth / (contentWidth + margins);
				pageZoom = Math.min(maxZoom, currentZoom * zoomScale);

				document.body.style.zoom = pageZoom + "%";
			}
		}
			
		if (findID("content").getAttribute("panopage") !== null) {
			const rows = find("#picblock > tbody > tr");
			rows.forEach(row => {
				const cells = Array.from(row.children).slice(1);
				cells.forEach(cell => {
					const newRow = document.createElement("tr");
					newRow.appendChild(cell);
					row.parentNode.appendChild(newRow);
				});
			});

			const imageBlocks = find("#picblock .imageblock");
			imageBlocks.forEach(block => {
				block.style.width = `${4 * parseInt(block.style.width)}px`;

				const headerImg = findOne("div#headerImg > img");
				const headerWidth = headerImg ? headerImg.width : 0;

				const images = block.querySelectorAll("img");
				images.forEach(img => {
					const aspectRatio = img.naturalHeight / img.naturalWidth;
					img.style.width = `${headerWidth}px`;
					img.style.height = `auto`;
				});
			});

			panopage = true;
		}
		
		if (screenWidth < 700) {
			if (!panopage) {
				if (!findID("content").hasAttribute("norewrap")) {
					if (version >= 3) {
						const picblocks = find("div.picblock");
						
						if (picblocks.length > 0) {
							let sizeText = getComputedStyle(picblocks[0]).gridTemplateColumns;
							const commaIndex = sizeText.indexOf(",");
							if (commaIndex !== -1) {
								sizeText = sizeText.slice(commaIndex + 1);
							}
							
							const thumbsize = parseInt(sizeText);
							const newthumbsize = thumbsize * 2 + 15;

							picblocks.forEach(picblock => {
								picblock.style.gridTemplateColumns = `${newthumbsize}px ${newthumbsize}px`;
							
								find(".imagediv").forEach(imagediv => {
									imagediv.querySelectorAll("img").forEach(img => {
										imagediv.style.width = `${newthumbsize}px`;
										img.style.width = `${Math.floor((newthumbsize / thumbsize) * img.width)}px`;
										img.style.height = `${Math.floor((newthumbsize / thumbsize) * img.height)}px`;
									});
								});
							});
							const nav = findOne("ul#nav");
							if (nav) {
								nav.style.fontSize = "1.3em";
								nav.style.lineHeight = "2.0em";
								nav.style.marginBottom = "20px";
							}
						}
					} else {
						if (version === 2) {
							find("div.picrow").forEach(picrow => {
								const clone = picrow.cloneNode(false);
								const children = Array.from(picrow.children).slice(2);
								children.forEach(child => {
									clone.appendChild(child);
								});
								picrow.parentNode.insertBefore(clone, picrow.nextSibling);
							});
							
							find(".imagediv").forEach(imagediv => {
								imagediv.querySelectorAll("img").forEach(img => {
									imagediv.style.width = `${2 * imagediv.width}px`;
									img.style.width = `${2 * img.width}px`;
									img.style.height = `${2 * img.height}px`;
								});
							});
						} else {
							find("#picblock > tbody > tr").forEach(row => {
								const newRow = document.createElement("tr");
								const children = Array.from(row.children).slice(2);
								children.forEach(child => {
									newRow.appendChild(child);
								});
								row.parentNode.insertBefore(newRow, row.nextSibling);
							});
							
							find("#picblock .imageblock").forEach(imageblock => {
								imageblock.style.width = `${2 * parseInt(imageblock.style.width)}px`;
								imageblock.querySelectorAll("img").forEach(img => {
									img.style.width = `${2 * img.width}px`;
									img.style.height = `${2 * img.height}px`;
								});
							});
						}
						const nav = findOne("ul#nav");
						if (nav) {
							nav.style.fontSize = "1.3em";
							nav.style.marginBottom = "10px";
						}
					}
				}
				find(".journaltitle:not(.nomodify)").forEach(title => {
					title.style.fontSize = "1.6em";
				});
				const h1 = findOne("h1:not(.nomodify)");
				if (h1) {
					const headLen = h1.innerHTML.length;
					if (headLen < 50) {
						let headSize = "";
						if (headLen > margins) {
							headSize = "2.5em";
						} else if (headLen > 30) {
							headSize = "2.7em";
						} else {
							headSize = "3.0em";
						}
						h1.style.fontSize = headSize;
					}
				}
				find("h1:not(.nomargin)").forEach(h1 => {
					h1.style.margin = "10px 0 20px";
				});
				find(".journaltext:not(.nomodify)").forEach(text => {
					text.style.fontSize = "2.2em";
					text.style.lineHeight = "1.2em";
				});
				find(".picblock.setfont").forEach(picblock => {
					picblock.style.fontSize = "2.2em";
				});
				const footer = findOne("#footer:not(.nomodify)");
				if (footer) {
					footer.style.fontSize = "3em";
				}
			}
			mobileDevice = true;
		}
		
		var h1Elements = Array.from(find("h1:not(.nomodify)"));
		h1Elements.forEach(function(h1) {
			var headLen = h1.innerHTML.length;
			if (headLen >= 50) {
				var headSize = "";
				if (headLen > 80) {
					headSize = "1.2em";
				} else if (headLen > 65) {
					headSize = "1.5em";
				} else {
					headSize = "1.9em";
				}
				h1.style.fontSize = headSize;
			}
		});

		let prefixAWS = "http://dvk4w6qeylrn6.cloudfront.net";

		function targetName(objectName) {
			const href = document.location.href;
			const domains = ["rickandrandy.com", "randyandrick.com", "ubillos.com", "portlandave.com", "randyubillos.com", "rickfath.com"];
			const matched = domains.some(domain => href.includes(domain));
			
			if (matched) {
				var elements = document.location.pathname.split("/");
				
				elements[0] = prefixAWS;
				elements[elements.length - 1] = objectName;
				
				objectName = elements.join("/");
			}
			
			return objectName;
		}

		if (document.location.href.includes("Users/mediaserver") && window.innerWidth > (contentWidth + 100) && find(".sideinfo").length === 0) {
			var zoom = (Math.min(1600, window.innerWidth) / (contentWidth + 100)) * 100;
			document.body.style.zoom = zoom + "%";
		}
		
		const pageScale = (window.outerWidth / window.innerWidth) * window.devicePixelRatio * pageZoom / 100.0;
		const folder_scales = [1, 2, 3, 4, 6, 8, 12];
		
		function srcSetError(event) {
			const img = event.target;
			let srcSet = img.getAttribute('srcset').split(', ');
			if (srcSet.length > 1) {
				srcSet.pop();
				img.setAttribute('srcset', srcSet.join(', '));
			}
		}

		const singleSrc = findOne("#picblock") || findOne("td.sideinfo");

		find("img").forEach(function(img) {
			if (!img.hasAttribute("srcset") && img.hasAttribute("filename") && img.getAttribute("filename") !== "") {
				let filename = img.getAttribute("filename");
				let parts = filename.split('?');
				parts[0] = encodeURIComponent(parts[0]);
				let encodedName = parts.join('?');
				let width = img.width;

				img.addEventListener('error', srcSetError);

				if (filename.startsWith("Placed Image") || filename.startsWith("headers")) {
					if (filename.startsWith("headers")) {
						encodedName = filename;
					}
					let sizes = 3;
					if (img.hasAttribute("sizes")) {
						sizes = parseInt(img.getAttribute("sizes"));
					}
					if (width === 0) {
						width = 800;
					}
					let srcSet = `${encodedName} ${width}w`;
					for (let i = 2; i <= sizes; i++) {
						let scale = folder_scales[i - 1];
						srcSet += `, ${encodedName.replace('.', `@${scale}x.`)} ${width * scale}w`;
					}
					img.setAttribute("srcset", srcSet);
					img.removeAttribute("filename");
					img.removeAttribute("src");
				} else {
					if (img.hasAttribute("singlethumb")) {
						img.setAttribute("src", "thumbnails/" + encodedName);
					} else {
						if (width === 0) {
							width = 200;
						}
						let srcSet = `thumbnails/${encodedName} ${width}w, thumbnails@2x/${encodedName} ${width * 2}w, thumbnails@3x/${encodedName} ${width * 3}w`;

						if (pageScale >= 3) {
							const picName = encodedName.replace("thumb", "picture");
							srcSet = `${srcSet}, pictures/${picName} 1024w`;
							if (pageScale >= 6) {
								srcSet = `${srcSet}, pictures@2x/${picName} 2048w`;
							}
						}
						img.setAttribute("srcset", srcSet);
						img.removeAttribute("src");
					}
				}
			} else if (singleSrc && !img.hasAttribute("srcset")) {
				const src = img.getAttribute('src');
				if (!src.startsWith("Placed Image")) {
					img.addEventListener('error', srcSetError);
					const width = img.width;
					const src2 = src.replace("thumbnails", "pictures").replace("thumb", "picture");
					img.setAttribute('srcset', `${src} ${width}w, ${src2} 1024w`);
					img.removeAttribute("src");
				}
			}
		});
		
		let thumbnailTimeout = 2 * 60;
		window.timeoutKey = null;
		window.thumbnailsPaused = false;
	    window.isActive = true;
		
		function pauseThumbnails() {
			if (!window.thumbnailsPaused) {
				find("video").forEach(video => {
					if (video.getAttribute("isthumbnail") && video.getAttribute("src") !== null) {
						video.pause();
					}
				});
				window.thumbnailsPaused = true;
			}
			window.timeoutKey = null;
		}

		function clearQueuedPause() {
			if (window.timeoutKey !== null) {
				clearTimeout(window.timeoutKey);
				window.timeoutKey = null;
			}
		}
		
		function restartThumbnails() {
			if (window.thumbnailsPaused) {
				find("video").forEach(video => {
					if (video.getAttribute("isthumbnail") && video.getAttribute("src") !== null && video.paused) {
						video.play();
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
		
		window.addEventListener("focus", function() {
			if (!window.isActive) {
				window.isActive = true;
				updateThumbnailTimeout();
			}
		});

		window.addEventListener("blur", function() {
			if (window.isActive) {
				window.isActive = false;
				clearQueuedPause();
				pauseThumbnails();
			}
		});

		window.addEventListener("mousemove", function() {
			updateThumbnailTimeout();
		});

		function updateVisibility(vid) {
			var img = vid.img;
			var videoElem = vid.video;
			var visibleBounds = img.getBoundingClientRect();
			var visible = visibleBounds.bottom > 0 && visibleBounds.top < window.innerHeight;
			var key = visible ? "yes" : "no";

			if (key !== videoElem.getAttribute('shown')) {
				if (visible) {
					if (window.thumbnailsPaused) {
						videoElem.setAttribute("autoplay", window.thumbnailsPaused ? null : true);
					}
					videoElem.setAttribute('src', videoElem.getAttribute('path'));
					videoElem.style.display = 'inline';
				} else {
					videoElem.style.display = 'none';
					videoElem.removeAttribute('src');
				}
				videoElem.setAttribute('shown', key);
			}

			return visible;
		}

		function updateAllVisibility() {
			var count = 0;

			window.scrollKey = null;

			videoElements.forEach(function(vid) {
				count += updateVisibility(vid);
			});
		}

		const pageNumberIndex = 0;
		const standardMovieIndex = 4;
		const HDMovieIndex = 5;
		const smallMovieIndex = 6;
		const thumbnailMovieIndex = 8;
		const fourKMovieIndex = 9;
			
		let playImg;

		function addPlay(event) {
			if (!playImg.parentElement) {
				const obj = event.currentTarget;
				const video = obj.querySelector("video");
				const vidWidth = video.offsetWidth;
				const vidLeft = parseInt(window.getComputedStyle(video).left, 10);

				playImg.style.left = `${vidLeft + ((vidWidth - 60) / 2)}px`;
				playImg.style.top = `${(video.offsetHeight - 60) / 2}px`;
				obj.appendChild(playImg);
			}
			return true;
		}

		function removePlay(event) {
			if (playImg && playImg.parentElement) {
				playImg.parentElement.removeChild(playImg);
			}
			return true;
		}

		function addVideoThumbnail(img, movieInfo, rootPrefix, thumbPrefix) {
			const aObj = img.parentElement;
			const dtObj = aObj.parentElement;

			if (!mobileDevice && dtObj && movieInfo.length > thumbnailMovieIndex && movieInfo[thumbnailMovieIndex].length > 0) {
				const newVideo = document.createElement("video");
				newVideo.style.display = "none";
				newVideo.style.position = "absolute";
				newVideo.style.left = "0";
				newVideo.style.top = "0";
				newVideo.muted = true;
				newVideo.loop = true;
				newVideo.autoplay = true;
				newVideo.setAttribute("isthumbnail", "true");

				newVideo.width = img.width;
				newVideo.height = img.height;
				newVideo.poster = img.src;

				let offset = 0;
				const imgWidth = img.width;
				const thumbWidth = dtObj.offsetWidth;
				if (imgWidth !== thumbWidth) {
					offset = Math.max(0, Math.floor((thumbWidth - imgWidth) / 2));
					newVideo.style.left = `${offset}px`;
				}

				let thumbName = movieInfo[thumbnailMovieIndex];
				if (thumbName.length < 3) {
					thumbName = movieInfo[standardMovieIndex].split(",")[2].replace("-HEVC", "");

					if (thumbName.search(/(.*? ?- ?)\d{3,4}p\d{2}\..{3}/g) >= 0) {
						thumbName = thumbName.replace(/(.*? ?- ?)\d{3,4}p\d{2}\..{3}/g, "$1Thumbnail.m4v");
					} else {
						thumbName = thumbName.replace(/(.*?)\..{3}/g, "$1-Thumbnail.m4v");
					}
				}

				thumbName = thumbPrefix + thumbName;
				thumbName = targetName(thumbName);

				newVideo.setAttribute("path", thumbName);
				dtObj.style.position = "relative";
				if (!dtObj.classList.contains("nomodify")) {
					dtObj.style.borderColor = "white";
					dtObj.style.borderStyle = "solid";
					dtObj.style.borderWidth = "5px";
					dtObj.style.margin = "-5px";
				}
				dtObj.setAttribute("height", img.height);
				aObj.appendChild(newVideo);

				if (!playImg) {
					playImg = document.createElement("img");
					playImg.src = `${rootPrefix}play.png`;
					playImg.width = 60;
					playImg.height = 60;
					playImg.style.position = "absolute";
					playImg.style.left = "65px";
					playImg.style.top = "23px";
					playImg.style.borderWidth = "0";
				}

				aObj.addEventListener("touchstart", addPlay);
				aObj.addEventListener("mouseenter", addPlay);
				aObj.addEventListener("mouseleave", removePlay);
				aObj.addEventListener("touchmove", removePlay);
				aObj.addEventListener("click", removePlay);

				const package = { video: newVideo, img: img };
				updateVisibility(package);
				videoElements.push(package);
			}
		}
	
		fetch("movies.txt")
			.then(response => response.text())
			.then(data => {
				const movieRows = data.splitLines();
				const moviePages = {};

				for (let i = 1; i < movieRows.length; i++) {
					const itemInfo = movieRows[i].split("\t");

					if (itemInfo.length > standardMovieIndex) {
						moviePages[itemInfo[pageNumberIndex]] = itemInfo;
					}
				}

				let assetRoot = document.body.getAttribute("assetroot");
				if (!assetRoot) {
					assetRoot = "../../FrontPageGraphics/";
				}

				find("img").forEach(img => {
					if (img.hasAttribute("filename")) {
						const hrefObj = img.parentElement;
						const hrefPath = hrefObj.getAttribute("href");
						const pageNumber = findPageNumber(hrefPath);
						const movieInfo = moviePages[pageNumber];

						if (movieInfo) {
							let captionObj = null;

							if (version === 3) {
								captionObj = hrefObj.parentElement.querySelector("p.imagelabel");
							} else {
								captionObj = hrefObj.parentElement.parentElement.querySelector("li");
							}

							if (!captionObj) {
								captionObj = hrefObj.parentElement.parentElement.querySelector("p.imagelabel");
							}

							if (captionObj) {
								const title = captionObj.innerHTML.trim();
								let newHTML = `<a href="${hrefPath}"><strong>${title}</strong></a>`;
								const hasHD = movieInfo.length > HDMovieIndex && movieInfo[HDMovieIndex].length > 0;
								const has4K = movieInfo.length > fourKMovieIndex && movieInfo[fourKMovieIndex].length > 0;
								let hdString = "";

								if (document.location.search.length <= 1 && hasHD) {
									hdString = `<span style="text-decoration:underline;"><a href="${hrefPath}?HD">HD</a></span>`;
								}
								if (document.location.search.length <= 1 && has4K) {
									if (hdString.length > 0) {
										hdString += "&nbsp;&nbsp;";
									}
									hdString += `<span style="text-decoration:underline;"><a href="${hrefPath}?4K">4K</a></span>`;
								}

								if (hdString.length > 0) {
									newHTML = `<div style="display:flex; justify-content:space-between;">${newHTML}<div style="flex-grow:1;"></div>${hdString}</div>`;
								}

								captionObj.innerHTML = newHTML;
							}
							addVideoThumbnail(img, movieInfo, assetRoot, "");
						}
					}
				});

				updateThumbnailTimeout();

				if ("ontouchstart" in document.documentElement) {
					find("a, #headerImg, li.pagnation, li.previous, li.next").forEach(el => {
						el.style.touchAction = "manipulation";
					});
				}
			});
		
		const nav = findOne("ul#nav");
		if (nav && nav.children.length <= 2) {
			nav.remove();
		}

		find(".previous").forEach(el => el.setAttribute("title", "Previous (left arrow)"));
		find(".next").forEach(el => el.setAttribute("title", "Next (right arrow)"));

		find("#footer > p, #footer > li").forEach(el => {
			if (!el.querySelector("a")) {
				const link = document.createElement("a");
				link.href = "../../index.html";
				link.innerHTML = el.innerHTML;
				el.innerHTML = "";
				el.appendChild(link);
			}
		});

		function handleNavClick(event) {
			event.preventDefault();
			const link = this.querySelector("a");
			if (link) {
				window.location.href = link.getAttribute("href");
			}
		}

		find("li.pagnation, li.previous, li.next").forEach(el => {
			el.style.cursor = "pointer";
			el.addEventListener("click", handleNavClick);
		});

		find("li.previous:not(.nomodify), li.next:not(.nomodify)").forEach(el => {
			el.style.height = "100%";
		});

		document.body.style.display = "inline";

		const hashRef = document.location.hash.substring(1);
		if (hashRef.length > 0) {
			find(`.imagecell a[href='${hashRef}'], .imagediv a[href='${hashRef}']`).forEach(el => {
				window.scrollTo(0, el.getBoundingClientRect().top - window.innerHeight / 2);
			});
		}

		if (document.location.search.length > 1) {
			find("#nav > li > a, .imagecell > a").forEach(el => {
				el.href += document.location.search;
			});
		}

		const headerImg = findOne("#headerImg");
		if (headerImg) {
			const imgElement = headerImg.querySelector("img");
			const picIndex = imgElement ? imgElement.getAttribute("picnum") : null;
			
			if (picIndex) {
				headerImg.style.width = imgElement.style.width;
				headerImg.style.height = imgElement.style.height;
				headerImg.style.overflow = "hidden";
				headerImg.style.position = "relative";
				
				const popup = document.createElement("span");
				popup.textContent = "Copied file and offset to clipboard";
				popup.className = "copy-msg";
				headerImg.appendChild(popup);

				function copyToClipboard(e) {
					const fileData = fileDisplay.getAttribute("copy-data");
					const offsetData = offsetDisplay.getAttribute("copy-data");
					if (fileData && offsetData) {
						navigator.clipboard.writeText(`${fileData},${offsetData}`);
					}
					popup.style.display = "block";
					setTimeout(() => { popup.style.display = "none"; }, 700);
					e.stopPropagation();
				}
				
				const fileDisplay = document.createElement("div");
				fileDisplay.className = "header-info";
				fileDisplay.style.left = "10px";
				headerImg.appendChild(fileDisplay);
				fileDisplay.addEventListener("click", copyToClipboard);
				
				function updateFileDisplay(index, filename) {
					if (fileDisplay) {
						imgElement.src = `pictures/picture-${index}.jpg`;
						fileDisplay.textContent = `file: "${filename}"`;
						fileDisplay.setAttribute("copy-data", filename);
					}
				}
					
				const offsetDisplay = document.createElement("div");
				offsetDisplay.className = "header-info";
				offsetDisplay.style.right = "10px";
				headerImg.appendChild(offsetDisplay);
				offsetDisplay.addEventListener("click", copyToClipboard);
				
				function updateOffsetDisplay() {
					const offset = parseInt(imgElement.getAttribute("hoffset"), 10) || 50;
					offsetDisplay.textContent = `offset: ${offset}%`;
					offsetDisplay.setAttribute("copy-data", offset);
				}
			
				updateOffsetDisplay();
				
				imgElement.removeAttribute("height");
				imgElement.style.height = "";

				imgElement.onload = function() {
					const hoffset = parseInt(imgElement.getAttribute("hoffset"), 10) || 50;
					imgElement.style.marginTop = `-${Math.round((imgElement.height - headerImg.offsetHeight) * hoffset / 100)}px`;
				};

				imgElement.removeAttribute("srcset");
				imgElement.removeAttribute("sizes");
				updateFileDisplay(picIndex, imgElement.getAttribute("picname") || "");

				let isDragging = false;
				let startY = 0;
				let startMarginTop = 0;
				
				headerImg.addEventListener("mousedown", function(e) {
					isDragging = true;
					startY = e.clientY;
					startMarginTop = parseInt(imgElement.style.marginTop) || 0;
					e.preventDefault();
				});
				
				document.addEventListener("mousemove", function(e) {
					if (isDragging) {
						const deltaY = e.clientY - startY;
						const newMarginTop = startMarginTop + deltaY;
						const maxOffset = -(imgElement.height - headerImg.offsetHeight);
						const clampedMarginTop = Math.max(maxOffset, Math.min(0, newMarginTop));
						
						imgElement.style.marginTop = `${clampedMarginTop}px`;
						imgElement.setAttribute("hoffset", Math.round((-clampedMarginTop / (imgElement.height - headerImg.offsetHeight)) * 100));
						updateOffsetDisplay();
						e.preventDefault();
					}
				});
				
				document.addEventListener("mouseup", function(e) {
					isDragging = false;
				});
				
				find(".imagewrapper").forEach(wrapper => {
					const img = wrapper.querySelector("img");
					img.addEventListener("mousedown", function(e) {
						if (e.shiftKey) {
							e.preventDefault();
							e.stopPropagation();
							const filename = this.getAttribute("filename");
							const match = filename.match(/thumb-(\d+)/);
							if (match && match[1]) {
								updateFileDisplay(match[1], img.getAttribute("picname") || "");
							}
						}
					});
					
					wrapper.addEventListener("click", function(e) {
						if (e.shiftKey) {
							e.preventDefault();
							e.stopPropagation();
						}
					});
				});
			} else {
				headerImg.addEventListener("mousedown", function (e) {
					const leftSide = e.offsetX < (this.offsetWidth * 0.2);
					const target = findOne(leftSide ? "#previous a, .previous a" : "#next > a, .next a");
					if (target) {
						window.location.href = target.getAttribute("href");
					}
				});
			}
		}
		if (version < 2 && !Array.from(document.querySelectorAll("a")).some(a => a.textContent.includes("Next Page"))) {
			const nextElement = findOne("#next a, .next a");
			if (nextElement) {
				const nextLink = document.createElement("div");
				nextLink.className = "journaltext";
				nextLink.style.width = (contentWidth + 10) + "px";
				nextLink.innerHTML = `<p align="right" class="copy"><a href="${nextElement.getAttribute("href")}">Next Page</a></p>`;
				const footer = findOne("#footer");
				if (footer) {
					footer.parentNode.insertBefore(nextLink, footer);
				}
			}
		}
		
		function findPageNumber(path) {
			const nav = findOne("#nav");
			const pageCount = (nav && nav.children.length > 0) ? nav.children.length - 2 : 1;
			let currentPageNumber = 1;

			if (!path) {
				path = document.location.pathname;
			}

			const lastSegment = path.substring(path.lastIndexOf("/") + 1, path.lastIndexOf("."));

			if (path.includes("indexlast")) {
				currentPageNumber = pageCount;
			} else {
				const digitIndex = lastSegment.search(/\d/);

				if (digitIndex >= 0) {
					currentPageNumber = parseInt(lastSegment.substr(digitIndex), 10);
				}
			}

			return currentPageNumber;
		}

		const nav2 = findOne("#nav");
		const pageCount = (nav2 && nav2.children.length > 0) ? nav2.children.length - 2 : 0;
		const currentPageNumber = findPageNumber();

		window.scrollKey = null;

		function visibilityCheck() {
			updateThumbnailTimeout();
			if (window.scrollKey !== null) {
				clearTimeout(window.scrollKey);
			}
			window.scrollKey = setTimeout(updateAllVisibility, 100);
		}

		document.addEventListener("scroll", visibilityCheck);
		window.addEventListener("resize", visibilityCheck);
				
		document.addEventListener("keydown", function(event) {
			function scrolledToBottom() {
				return (window.scrollY + window.innerHeight + 10 >= document.documentElement.scrollHeight);
			}

			let handled = true;
			let newPageNumber = currentPageNumber;
			const nextPageLink = findID("nextpagelink");

			switch (event.key) {
				case "PageUp": /* page up */
				case "ArrowLeft": /* left */
				case "ArrowUp": /* up */
					if (newPageNumber > 1) {
						newPageNumber--;
					} else {
						newPageNumber = -3;
					}
					break;
				case "PageDown": /* page down */
				case "ArrowRight": /* right */
				case "ArrowDown": /* down */
					if (newPageNumber < pageCount) {
						newPageNumber++;
					} else {
						newPageNumber = -2;
					}
					break;
				case "i": /* i */
					if (!event.altKey && !event.shiftKey && !event.ctrlKey) {
						newPageNumber = -1;
					} else {
						handled = false;
					}
					break;
				case " ": /* spacebar */
					if (scrolledToBottom() && (newPageNumber < pageCount || nextPageLink) && !findOne("#video,#movie1,#movie2")) {
						newPageNumber++;
					} else if (scrolledToBottom() && pageCount <= 1 && !findOne("#video,#movie1,#movie2")) {
						window.scrollTo({ top: 0, behavior: "smooth" });
					} else {
						handled = false;
					}
					break;
				case "b": /* stop-start, B */
				case "p": /* p */
				case "Tab": /* tab */
					if (!event.altKey && !event.shiftKey && !event.ctrlKey) {
						const photos = findOne(".imagecell > a, .imagediv > a, .imagediv > * > a");
						if (photos) {
							window.location.href = photos.getAttribute('href');
						}
					}
					break;
				default:
					handled = false;
					break;
			}

			if (handled) {
				event.preventDefault();

				if (newPageNumber !== currentPageNumber) {
					let newRef = "index";

					if (newPageNumber === pageCount && nextPageLink) {
						newRef = nextPageLink.getAttribute("href");
					} else if (newPageNumber === -2 || newPageNumber > pageCount) {
						newRef = nextPageLink ? nextPageLink.getAttribute("href") : "";
					} else if (newPageNumber === -3) {
						const previousPageLink = findID("previouspagelink");
						newRef = previousPageLink ? previousPageLink.getAttribute("href") : "";
					} else if (newPageNumber > 1) {
						newRef = `${newRef}${newPageNumber}.html`;
					} else if (newPageNumber === -1) {
						newRef = `../../${newRef}.html`;
					} else {
						newRef = `${newRef}.html`;
					}

					if (document.location.search.length > 1 && newPageNumber !== -1) {
						newRef += document.location.search;
					}

					if (newRef) {
						window.location.href = newRef;
					}
				}
			}
		});
	});
}
