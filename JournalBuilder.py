#!/usr/bin/env python3.9

# pip3 install pillow-simd
# pip3 install pyheif
# pip3 install exifread
# pip3 install osxphotos

import sys, os, time, shutil, pathlib
import argparse
from datetime import datetime
from PIL import Image
import pyheif
import exifread
import concurrent.futures
import html  
import webbrowser

parser = argparse.ArgumentParser(description='Generate a web journal')

parser.add_argument("folder", help="Destination folder", nargs=1)
parser.add_argument("-c", dest="clean", help="Remove all existing output files", action="store_true")
parser.add_argument("-t", dest="timings", help="Print timing information", action="store_true")
parser.add_argument("-s", dest="single_thread", help="Run all tasks on the main thread", action="store_true")
parser.add_argument("-?", dest="documentation", help="Show user manual", action="store_true")
parser.add_argument("-nc", dest="no_cache", help="Prevent caching of images and links (for debugging)", action="store_true")
parser.add_argument("-o", dest="open_result", help="Open the output journal in browser", action="store_true")

group = parser.add_argument_group("album settings")
group.add_argument("-j", dest="journal", help="journal information file (defaults to 'journal.txt' in destination folder)", type=str, nargs=1)
group.add_argument("-a", dest="album_name", help="Get images from Photos album", type=str, nargs=1)
group.add_argument("-i", dest="images_folder", help="Source image folder (defaults to 'images' in destination folder)", type=str, nargs=1)
group.add_argument("-d", dest="date_sort", help="Show images in chronological order (Photos album only), default is album order", action="store_true")
group.add_argument("-f", dest="favorites", help="Show only favorite images (Photos album only)", action="store_true")

group = parser.add_argument_group("journal control")
group.add_argument("-jt", dest="journal_title", help="Journal title", type=str, nargs=1)
group.add_argument("-ts", dest="thumb_size", help="Thumbnail size", type=int, nargs=1, default=[190])
group.add_argument("-is", dest="image_size", help="Base image size", type=int, nargs=1, default=[1024])
group.add_argument("-r", dest="reorder_thumbs", help="Re-order thumbs to minimize page height", action="store_true")
group.add_argument("-hh", dest="header_height", help="Header height", type=int, nargs=1, default=[225])
group.add_argument("-q", dest="jpeg_quality", help="Set output JPEG quality level ", type=str, choices=["low", "medium", "high", "very_high", "maximum"], default="high")

group = parser.add_argument_group("overwriting")
group.add_argument("-w", dest="overwrite", help="Overwrite all existing output files", action="store_true")
group.add_argument("-wi", dest="overwrite_images", help="Overwrite existing output images", action="store_true")
group.add_argument("-wh", dest="overwrite_headerimages", help="Overwrite existing header images", action="store_true")
group.add_argument("-wp", dest="overwrite_pages", help="Overwrite existing html pages", action="store_true")
group.add_argument("-wm", dest="overwrite_movies", help="Overwrite existing movies.txt", action="store_true")
group.add_argument("-wa", dest="overwrite_assets", help="Overwrite existing assets folder", action="store_true")

args = parser.parse_args()

script_path = os.path.abspath(os.path.dirname(sys.argv[0]))

if args.documentation:
	with open(os.path.join(script_path, "journal.md"), "r") as file:
		for line in file.readlines():
			print(line, end="")
	quit()

if args.folder:
	destination_folder = args.folder[0]
	if not os.path.isdir(destination_folder):
		parser.error("Destination folder not found")
else:
	parser.error("A destination folder path is required")

overwrite_images = args.overwrite or args.overwrite_images
overwrite_headers = args.overwrite or args.overwrite_headerimages
overwrite_pages = args.overwrite or args.overwrite_pages
overwrite_movies = args.overwrite or args.overwrite_movies
overwrite_assets = args.overwrite or args.overwrite_assets

single_thread = args.single_thread

start_time = time.time()

previous_external_url = None
next_external_url = None

thumb_size = args.thumb_size[0]
base_image_size = args.image_size[0]
header_height = args.header_height[0]

from_photos = True if args.album_name else False

if from_photos:
	import osxphotos

thumb_folder_root = "thumbnails"
thumb_name_root = "thumb-"
picture_folder_root = "pictures"
picture_name_root = "picture-"
header_name_root = "Placed Image"
index_root = "index"
detail_root = "large-"

jpeg_quality = {"low":"web_low", "medium":"web_medium", "high":"web_high", "very_high":"web_very_high", "maximum":"web_maximum"}

def path_is_heif(file_path):
	return pathlib.Path(file_path).suffix.lower() in ['.heif',  '.heic']

def size_of_image_file(file_ref, orientation=0):
	image_size = None
	try:
		is_heif = False

		if isinstance(file_ref, str):
			path = file_ref
		else:
			path = file_ref.name

		if path_is_heif(path):
			heif_file = pyheif.read(file_ref)
			image = Image.frombytes(heif_file.mode, heif_file.size, heif_file.data, "raw", heif_file.mode, heif_file.stride,)
			is_heif = True
		else:
			image = Image.open(file_ref)

		if image:
			image_size = image.size

			if not is_heif:
				if orientation == 6 or orientation == 8:
					image_size = (image_size[1], image_size[0])
	except:
		pass

	return image_size

def scaled_size(input_size, max_size):
	width, height = input_size
	max_size = min(max_size, max(width, height))
	
	if width > height:
		height = round(max_size / width * height)
		width = max_size
	else:
		width = round(max_size / height * width)
		height = max_size
	
	return (width, height)
	
def save_versions(image_refs, ref_index, image_folders, page_headers, page_width):

	def save_scaled(image, size, path):
		scaled_image = image.resize(size, resample=Image.LANCZOS)
		scaled_image.save(path, "JPEG", quality=args.jpeg_quality)

	def save_scaled_header(image, dest_size, offset, path):
		src_slice_height = int(image.size[0] * dest_size[1] / dest_size[0])
		src_top = int((image.size[1]-src_slice_height) * offset / 100)
		cropped_image = image.resize(dest_size, box=(0, src_top, image.size[0], src_top+src_slice_height), resample=Image.LANCZOS)
		cropped_image.save(path, "JPEG", quality=args.jpeg_quality)

	def load_image(image, orientation):
		if orientation == 3:
			image = image.rotate(180, expand=True)
		elif orientation == 6:
			image = image.rotate(270, expand=True)
		elif orientation == 8:
			image = image.rotate(90, expand=True)
		else:
			image.load()
		return image

	start_time = time.time()
	result = 0
	error_msg = ""
	new_keys = None
	image_ref = image_refs[ref_index]
	file_path = image_ref["file_path"]
	try:
		image = None
		is_heif = False

		if path_is_heif(file_path):
			heif_file = pyheif.read(file_path)
			image = Image.frombytes(heif_file.mode, heif_file.size, heif_file.data, "raw", heif_file.mode, heif_file.stride,)
			is_heif = True
		else:
			image = Image.open(file_path)

		if image:
			is_loaded = False
			image_size = image.size
			orientation = 0

			if not is_heif:
				orientation = image_ref["orientation"]
				if orientation == 6 or orientation == 8:
					image_size = (image_size[1], image_size[0])

			width, height = scaled_size(image_size, 1024)

			new_keys = {}
			new_keys["width@1x"] = width
			new_keys["height@1x"] = height
			new_keys["thumb_name"] = "thumb-" + image_ref["picture_num"] + ".jpg"
			new_keys["picture_name"] = "picture-" + image_ref["picture_num"] + ".jpg"
			new_keys["image_size"] = image_size

			for folder_name, name_root, size in image_folders:
				output_path = os.path.join(destination_folder, folder_name, picture_url(name_root, image_ref["picture_num"], False))

				if overwrite_images or not os.path.isfile(output_path):
					try:
						if not is_loaded:
							image = load_image(image, orientation)
							is_loaded = True
						new_size = scaled_size(image_size, size)
						save_scaled(image, new_size, output_path)
						result = result + 1 if result>=0 else result
					except OSError as e:
						result = -1
						error_msg = "Error saving: " + output_path + ", " + str(e)

				file_name = image_ref["file_name"]
				header_info = None
				if len(page_headers) > 0:
					header_info = next((head_item for head_item in page_headers if head_item[0] and head_item[0]["file_name"] == file_name), None)

				if header_info and header_info[0]:
					header_size = (page_width, header_height)
					scales = [1, 2, 3]
					suffixes = ["", "@2x", "@3x"]
					for i in range(3):
						output_path = os.path.join(destination_folder, header_image_url(header_info[2], suffix=suffixes[i], for_html=False))
						if overwrite_headers or not os.path.isfile(output_path):
							try:
								if not is_loaded:
									image = load_image(image, orientation)
									is_loaded = True
								save_scaled_header(image, (header_size[0] * scales[i], header_size[1] * scales[i]), header_info[1], output_path)
								result = result + 1 if result >= 0 else result
							except OSError as e:
								result = -1
								error_msg = "Error saving: " + output_path + ", " + str(e)
		else:
			result = -1
			error_msg = "Cannot open: " + file_path
	except OSError as e:
		result = -1
		error_msg = "Error generating images: " + str(e)

	return(result, error_msg, new_keys, ref_index, time.time()-start_time)

def replace_keys(lines, src_key, replace_key):
	for index, line in enumerate(lines):
		if src_key in line:
			lines[index] = line.replace(src_key, replace_key)
			
def remove_tag(lines, tag):
	for index, line in enumerate(lines):
		tag_index = line.find(tag)
		if tag_index >= 0:
			line_len = len(line)
			tag_end_index = tag_index + len(tag)
			while tag_index>0 and line[tag_index-1]==" ":
				tag_index -= 1
			if tag_end_index<line_len-1 and line[tag_end_index]=="=":
				tag_end_index += 1
				if tag_end_index<line_len-2 and line[tag_end_index]=='"':
					tag_end_index += 1
					while tag_end_index<line_len and line[tag_end_index]!='"':
						tag_end_index += 1
					tag_end_index += 1
			lines[index] = line[:tag_index] + line[tag_end_index:]
			
def remove_lines_with_key(lines, key):
	index = 0
	while index < len(lines):
		if key in lines[index]:
			del lines[index]
		else:
			index += 1
	
def format_shutter(speed):
	if speed <= 0.5:
		return "1/{:d}s".format(int(1.0 /speed))
	else:
		return str(speed) + "s"
		
def get_next_line(src):
	tag = None
	subtag = ""
	text = ""
	line = src.pop(0).strip()
	while len(src) > 0 and len(line) == 0:
		line = src.pop(0).strip()
	if line.startswith("["):
		tag_end = line.find("]", 1)
		if tag_end > 1:
			tag_parts = line[1:tag_end].split("=")
			tag = tag_parts[0]
			subtag = tag_parts[1] if len(tag_parts) > 1 else ""
			text = line[tag_end+1:]
	elif len(line)>0:
		tag = "Text"
		text = line
		while text.endswith("<br>") and len(src)>0 and not src[0].startswith("["):
			text = text + '\n' + src.pop(0).strip()
		
	return (tag, subtag, text)

date_format = "%Y:%m:%d %H:%M:%S"
date_formats = [date_format, "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"]
	
def date_from_string(date_string):
	if len(date_string)>0:
		for format in date_formats:			
			try:
				date_time = datetime.strptime(date_string, format)
				if "%H" not in format:
					date_time = date_time.replace(hour=1, minute=1)
				return date_time
			except:
				pass	
		print("Failed to parse date", date_string)
	return None

def add_images_before_date(refs, before_date, dest_list, index_page_num):
	if len(refs):
		if before_date:
			new_refs = []
			while len(refs) > 0 and refs[0]["image_date"] < before_date:
				ref = refs.pop(0)
				new_refs.append(ref)
		else:
			new_refs = refs.copy()
			refs.clear()
			
		if len(new_refs) > 0:
			for ref in new_refs:
				ref["index_page_num"] = index_page_num
			dest_list.append({ "Photos": new_refs })

def index_of_substring(list, substr, start=0):
	for index, item in enumerate(list[start:], start):
		if substr in item:
			return index
	return -1

def extract_section(lines, starttext, endtext=None):
	start_index = index_of_substring(lines, starttext)
	if start_index == -1:
		return (0, None)
	if endtext:
		end_index = index_of_substring(lines, endtext, start_index+1)
		if end_index == -1:
			return (0, None)
		items = []
		for i in range(start_index, end_index+1):
			items.append(lines.pop(start_index))
		return (start_index, items)
	else:
		return (start_index, lines.pop(start_index))

def cache_suffix(for_html=True):
	if for_html and args.no_cache:
		return "?{:d}".format(int((time.time() * 10000) % 10000))
	else:
		return ""

def index_url(index_num, for_html=True, num_indexes=100000):
	if index_num == 0:
		return previous_external_url if previous_external_url else None
	elif index_num == 1:
		return "{}.html{}".format(index_root, cache_suffix(for_html))
	elif index_num == num_indexes+1:
		return next_external_url if next_external_url else None
	else:
		return "{}{}.html{}".format(index_root, index_num, cache_suffix(for_html))

def detail_url(picture_number):
	return("{}{}.html".format(detail_root, picture_number))
	
def header_image_url(page_num, for_html=True, suffix=""):
	return "{} - {:d}{}.jpg{}".format(header_name_root, page_num, suffix, cache_suffix(for_html))

def picture_url(name_root, page_num, for_html=True):
	return "{}{}.jpg{}".format(name_root, page_num, cache_suffix(for_html))

def make_nav_bar(nav_lines, page_index, page_names):
	nav_count = len(page_names)
	selected_index, selected_line = extract_section(nav_lines, 'rkid="off"')
	un_selected_index, un_selected_line = extract_section(nav_lines, 'rkid="on"')

	next_url = index_url(page_index+1, num_indexes=nav_count)
	prev_url = index_url(page_index-1, num_indexes=nav_count)
	
	for i in range(0, nav_count):
		if i+1 == page_index:
			nav_item = selected_line
		else:
			nav_item = un_selected_line.replace("_IndexPageURL_", index_url(i+1, num_indexes=nav_count))
		nav_item = nav_item.replace("_PageName_", page_names[i])
		nav_lines.insert(selected_index, nav_item)
		selected_index += 1

	if prev_url:
		replace_keys(nav_lines, "_PreviousPageURL_", prev_url)
		remove_lines_with_key(nav_lines, "leaveonfirstpage")
	else:
		if page_index == 1:
			remove_lines_with_key(nav_lines, "removeonfirstpage")
		else:
			remove_lines_with_key(nav_lines, "leaveonfirstpage")
		
	if next_url:
		replace_keys(nav_lines, "_NextPageURL_", next_url)
		remove_lines_with_key(nav_lines, "leaveonlastpage")
	else:
		if page_index == nav_count:
			remove_lines_with_key(nav_lines, "removeonlastpage")
		else:
			remove_lines_with_key(nav_lines, "leaveonlastpage")

	remove_tag(nav_lines, "removeonfirstpage")
	remove_tag(nav_lines, "leaveonfirstpage")
	remove_tag(nav_lines, "removeonlastpage")
	remove_tag(nav_lines, "leaveonlastpage")
	return nav_lines
	
def make_photo_block(photo_lines, image_refs, thumb_size):

	def insert_array_into_array(src, dest, index):
		for item in src:
			dest.insert(index, item)
			index += 1
		return index

	row_index, row_lines = extract_section(photo_lines, "picrow", "endpicrow")
	image_index, image_lines = extract_section(row_lines, "imagediv", "endimagediv")
	
	row_count = 0
	current_row_lines = row_lines.copy()
	current_image_index = image_index
	for image_ref in image_refs:
		if row_count == 4:
			row_index = insert_array_into_array(current_row_lines, photo_lines, row_index)
			current_row_lines = row_lines.copy()
			current_image_index = image_index
			row_count = 0
		
		new_image_lines = image_lines.copy()
		new_size = scaled_size(image_ref["image_size"], thumb_size)
		
		replace_keys(new_image_lines, "_DetailPageURL_", detail_url(image_ref["picture_num"]))
		replace_keys(new_image_lines, "_ThumbURL_", picture_url(thumb_name_root, image_ref["picture_num"]))
		replace_keys(new_image_lines, "_ThumbWidth_", str(new_size[0]))
		replace_keys(new_image_lines, "_ThumbHeight_", str(new_size[1]))
		
		if "caption" in image_ref:
			replace_keys(new_image_lines, "_metavalue_", html.escape(image_ref["caption"]))
		else:
			remove_lines_with_key(new_image_lines, "_metavalue_")			
		
		current_image_index = insert_array_into_array(new_image_lines, current_row_lines, current_image_index)
		row_count += 1
		
	if row_count > 0:
		insert_array_into_array(current_row_lines, photo_lines, row_index)		

	return photo_lines

def pluralize(str, count, pad=False):
	if count==1:
		return str+" " if pad else str
	else:
		return str+"s"

def extract_up_to(text, substr):
	src_text = text
	if text.startswith('"'):
		text = text[1:]
		substr = '"' + substr
	index = text.find(substr)
	if index>=0:
		return text[:index], text[index+len(substr):]
	else:
		return None, src_text

def main():
	global previous_external_url
	global next_external_url
	global thumb_size
	global base_image_size
	global header_height

	unplaced_image_refs = []

	# read journal file
	journal_file_path = args.journal if args.journal else "journal.txt"
	if not "/" in journal_file_path:
		journal_file_path = os.path.join(destination_folder, journal_file_path)
	if os.path.isfile(journal_file_path):
		with open(journal_file_path, "r") as file:
			journal_src = file.readlines()
	else:
		journal_src = []
		
	# scan for date overrides
	date_overrides = {}
	journal_copy = journal_src.copy()
	while len(journal_copy)>0:
		tag, subtag, text = get_next_line(journal_copy)
		if tag == "Date":
			date_overrides[subtag] = text
		elif tag == "Value":
			if len(subtag)>0 and len(text)>0:
				if subtag == "thumb_size":
					thumb_size = int(text)
				elif subtag == "header_height":
					header_height = int(text)
				elif subtag == "image_size":
					base_image_size = int(text)
		elif tag == "Previous":
			previous_external_url = text
		elif tag == "Next":
			next_external_url = text
	
	# read the file list, get the file info
	file_scan_start = photo_list_start = time.time()
	file_paths = []

	if from_photos:
		print("Opening system Photos database...", end="", flush=True)
		photosdb = osxphotos.PhotosDB()
		print(" done.")
		album_info = next((info for info in photosdb.album_info if info.title == args.album_name[0]), None)
		if album_info:
			for photo in album_info.photos:
				if photo.isphoto and not photo.hidden and (not args.favorites or photo.favorite):
					photo_path = photo.path_edited if photo.path_edited else photo.path
					if photo_path:
						file_paths.append((photo.original_filename, photo_path, photo.title, photo.date))
					else:
						print("Warning: File missing for", photo.filename)
		else:
			parser.error("Photos album not found: " + args.album_name[0])
	else:
		images_folder_path = args.images_folder if args.images_folder else "images"
		if not "/" in images_folder_path:
			images_folder_path = os.path.join(destination_folder, images_folder_path)
		if os.path.isdir(images_folder_path):
			for file_name in os.listdir(images_folder_path):
				file_paths.append((file_name, os.path.join(images_folder_path, file_name), None, None))
			
	if len(file_paths) == 0:
		parser.error("No source photos found! Please specify an album name (-a) or an image folder (-i).")

	photo_list_time = time.time() - photo_list_start
		
	for file_name, file_path, title, photo_date in file_paths:
		if not file_name.startswith('.') and os.path.isfile(file_path):
			with open(file_path, "rb") as image_file:
				tags = exifread.process_file(image_file, details=False)
				keys = tags.keys()
				image_ref = {}
	
				image_ref["file_name"] = file_name
				image_ref["file_path"] = file_path
				
				if file_name in date_overrides:
					image_date = date_overrides[file_name]
				elif photo_date:
					image_date = photo_date.strftime(date_format)
				else:
					if 'Image DateTime' in tags:
						image_date = tags['Image DateTime'].values
					else:
						file_time = os.path.getmtime(file_path)
						image_date = time.strftime(date_format, time.localtime(file_time))
						print("Warning: Using os date for", file_name, image_date)
				
				image_ref["datetime"] = image_date
				image_ref["image_date"] = date_from_string(image_date)
				image_ref["orientation"] = tags['Image Orientation'].values[0] if 'Image Orientation' in keys else 0

				if "EXIF ExifImageWidth" in tags and "EXIF ExifImageLength" in tags:
					image_ref["aspect"] = (float(tags["EXIF ExifImageWidth"].values[0]) / float(tags["EXIF ExifImageLength"].values[0]))
				elif args.reorder_thumbs:
					image_size = size_of_image_file(image_file, image_ref["orientation"])
					if image_size:
						image_ref["aspect"] = float(image_size[0] / image_size[1])
					else:
						image_ref["aspect"] = 1.0
				else:
					image_ref["aspect"] = 1.0

				if title:
					image_ref["caption"] = title
				elif 'Image ImageDescription' in keys:
					image_ref["caption"] = tags['Image ImageDescription'].values
				
				exif_data = [ file_name, image_date ]
				
				if 'EXIF ExposureTime' in keys:
					exif_data.append(format_shutter(float(tags['EXIF ExposureTime'].values[0])))
				if 'EXIF FNumber' in keys:
					exif_data.append("ƒ{:.1f}".format(float(tags['EXIF FNumber'].values[0])))
				if 'EXIF ExposureBiasValue' in keys:
					exif_data.append("{:.1f}ev".format(float(tags['EXIF ExposureBiasValue'].values[0])))
				if 'EXIF ISOSpeedRatings' in keys:
					exif_data.append("ISO {:d}".format(tags['EXIF ISOSpeedRatings'].values[0]))
				if 'EXIF FocalLengthIn35mmFilm' in keys:
					exif_data.append("{:d}mm".format(tags['EXIF FocalLengthIn35mmFilm'].values[0]))
				if 'Image Model' in keys and 'Image Make' in keys:
					exif_data.append(tags['Image Make'].values + " " + tags['Image Model'].values)
					
				image_ref["exif"] = " &bull; ".join(exif_data)
				unplaced_image_refs.append(image_ref)

	file_scan_time = time.time() - file_scan_start

	# sort based on date
	if not from_photos or args.date_sort:
		unplaced_image_refs.sort(key=lambda image_ref: image_ref['image_date'])

	# generate journal structure
	all_image_refs = unplaced_image_refs.copy()
	pages = []
	page_names = []
	page_headers = []
	journal = { "Pages": pages }
	entries = None
	last_entries = None
	movie_refs = []
	index_page_num = 0

	journal_scan_start = time.time()

	while len(journal_src) > 0:
		tag, subtag, text = get_next_line(journal_src)
		
		if tag == "Site":
			journal["Title"] = text
		elif tag == "Page" or tag == "Epilog":
			index_page_num += 1
			last_entries = entries
			entries = []
			if tag == "Epilog":
				text = "Epilog"
				add_images_before_date(unplaced_image_refs, None, last_entries if last_entries is not None else entries, index_page_num-1)
			page = { "Entries": entries }
			tag_parts = subtag.split(",")
			header_ref = None
			header_offset = 50
			if len(tag_parts) >= 1:
				try:
					header_ref = next((image_ref for image_ref in all_image_refs if image_ref["file_name"] == tag_parts[0]), None)
					if header_ref:
						if len(tag_parts) >= 2:
							header_offset = int(tag_parts[1])
					else:
						print("Warning: Header image not found:", tag_parts[0])
				except:
					print("Warning: Header image not found:", tag_parts[0])
					
			page_headers.append((header_ref, header_offset, index_page_num))
			pages.append(page)
			page_names.append(text)
		elif entries is not None:
			if tag == "Heading":
				entry = { "Heading": text }
				date = date_from_string(subtag)
				if date:
					entry["Date"] = date
					add_images_before_date(unplaced_image_refs, date, last_entries if last_entries is not None and len(entries) == 0 else entries, index_page_num)
				entries.append(entry)
			elif tag == "Timestamp":
				date = date_from_string(subtag)
				if date:
					add_images_before_date(unplaced_image_refs, date, last_entries if last_entries is not None and len(entries) == 0 else entries, index_page_num)
			elif tag == "Text":
				entries.append({ "Text": text})
			elif tag == "Image":
				tag_parts = subtag.split(",")
				if len(tag_parts)>=1:
					entry = { "Image": tag_parts[0] }
					if len(tag_parts) >= 2:
						entry["width"] = int(tag_parts[1])
					entries.append(entry)
			elif tag == "Movie":
				caption, text = extract_up_to(text, ",")
				movie_base, text = extract_up_to(text, ",")
				heights = {}
				while len(text) and text.startswith("("):
					height_info, text = extract_up_to(text[1:], ")")
					if len(height_info)>1:
						height_parts = height_info.split(",")
						if len(height_parts)==2:
							heights[int(height_parts[0])] = height_parts[1]
					if text.startswith(","):
						text = text[1:]

				if caption and movie_base and len(heights) >= 1:
					if len(subtag) > 0:
						pic_name = subtag
						if not "." in pic_name:
							pic_name = pic_name + ".jpg"
					else:
						pic_name = caption + ".jpg"
					movie_ref = next((image_ref for image_ref in all_image_refs if image_ref["file_name"] == pic_name), None)

					if movie_ref:
						movie_ref["is_movie"] = True

						movie_fields = [''] * 10
						valid_sizes = [(960, 540, 4), (640, 480, 4), (1280, 720, 5), (1920, 1080, 5), (3840, 2160, 9), (640, 360, 6)]
						for width, height, index in valid_sizes:
							if height in heights:
								movie_fields[index] = "{:d},{:d},{}".format(width, height, heights[height])

						movie_fields[3] = caption
						movie_fields[8] = "*"
						std_parts = movie_fields[4].split(",")
						std_parts[2] = std_parts[2].replace("H", "-HEVC")
						ext_index = movie_base.find(".")
						movie_fields[4] = "{},{},{}-{}p{}{}".format(std_parts[0], std_parts[1], movie_base[:ext_index], std_parts[1], std_parts[2], movie_base[ext_index:])

						movie_ref["movie_text"] = "\t".join(movie_fields[3:])
						movie_ref["caption"] = caption
						movie_ref["index_page_num"] = index_page_num
						entries.append({ "Movie": movie_ref })
						movie_refs.append(movie_ref)
						unplaced_image_refs.remove(movie_ref)
				else:
					print("Warning: Invalid movie info:", text)
			elif tag == "Caption":
				caption_ref = next((image_ref for image_ref in all_image_refs if image_ref["file_name"] == subtag), None)
				if caption_ref:
					caption_ref["caption"] = text
				else:
					print("Warning: Image for caption not found:", subtag)
	
	if len(pages) == 0 and args.album_name:
		name = args.journal_title[0] if args.journal_title else args.album_name[0]
		journal["Title"] = name
		entries = []
		page = { "Entries": entries }
		page_headers.append((None, 0, index_page_num))
		pages.append(page)
		page_names.append(name)
		index_page_num = 1

	if entries is not None:
		add_images_before_date(unplaced_image_refs, None, entries, index_page_num)
	
	# merge movie entries
	for page in pages:
		entries = page["Entries"]
		index = 0
		while index < len(entries):
			entry = entries[index]
			if "Movie" in entry:
				movie_list = [ entry["Movie"] ]
				entries[index] = { "Photos": movie_list }
				while index < len(entries)-1 and "Movie" in entries[index+1]:
					next_movie = entries.pop(index+1)
					movie_list.append(next_movie["Movie"])
			index += 1
	
	# re-order thumbnails slightly to minimize page height
	if args.reorder_thumbs:
		for page in pages:
			for entry in page["Entries"]:
				if "Photos" in entry:
					photos = entry["Photos"]
					if len(photos)>4:
						line_tall_count = []
						line_count = int((len(photos)+3) / 4)

						def find_wide_tall(first, second, line_index):
							def find_item(tall, line_index):
								start_index = line_index * 4
								for index in range(start_index, min(len(photos), start_index+4)):
									if photos[index]["tall"] == tall:
										return index
								return -1

							return find_item(first, line_index), find_item(second, line_index+1)

						def swap_photos(src_index, dest_index):
							src_photo = photos[src_index]
							dest_photo = photos[dest_index]
							photos[dest_index] = src_photo
							photos.pop(src_index)
							photos.insert((src_index % 4) * 4 + 3, dest_photo)

						def move_photo(src_index, dest_index):
							src_photo = photos.pop(src_index)
							dest_index = dest_index+1 if dest_index % 4 == 0 else dest_index
							photos.insert(dest_index, src_photo)

						tall_count = 0
						row_count = 0
						for index, photo in enumerate(photos):
							tall = photo["aspect"]<1.15 if "aspect" in photo else False
							photo["tall"] = tall
							tall_count += 1 if tall else 0
							row_count += 1
							if row_count == 4 or index == len(photos)-1:
								line_tall_count.append(tall_count)
								tall_count = 0
								row_count = 0

						reorder_info = { (1,3):swap_photos, (3,1):swap_photos, (1,1):move_photo, (3,3):move_photo }
						for index in range(0, line_count-1):
							counts = (line_tall_count[index], line_tall_count[index+1])
							if counts in reorder_info:
								func = reorder_info[counts]
								src_index, dest_index = find_wide_tall(counts[0]==1, counts[1]==1, index)
								func(src_index, dest_index)
								line_tall_count[index] += -1 if counts[0]==1 else 1
								line_tall_count[index+1] += -1 if counts[1] == 1 else 1

						pair_moves = { "0101":(1, 2), "0110":(0, 2), "1001":(3, 1), "1010":(2, 1), "011":(0, 2) }
						for index in range(line_count):
							if line_tall_count[index] == 2:
								key = ""
								line_index = index * 4
								for i in range(line_index, min(len(photos), line_index+4)):
									key += "1" if photos[i]["tall"] else "0"
								if key in pair_moves:
									src_index, dest_index = pair_moves[key]
									photos.insert(line_index+dest_index, photos.pop(line_index+src_index))

	#build the image list
	final_image_refs = []
	for page in pages:
		for entry in page["Entries"]:
			if "Photos" in entry:
				final_image_refs.extend(entry["Photos"])
	
	# set the target image numbers
	for image_index, image_ref in enumerate(final_image_refs, 1):
		image_ref["picture_num"] = str(image_index)
	
	# start output phase
	journal_scan_time = time.time() - journal_scan_start
	
	image_folders = [
					(thumb_folder_root, thumb_name_root, thumb_size),
					(thumb_folder_root + "@2x", thumb_name_root, thumb_size*2),
					(thumb_folder_root + "@3x", thumb_name_root, thumb_size*3),
					(picture_folder_root, picture_name_root, base_image_size),
					(picture_folder_root + "@2x", picture_name_root, base_image_size*2),
					(picture_folder_root + "@3x", picture_name_root, base_image_size*3) ]
					
	page_width = thumb_size*4 + 45
	page_width_extra = page_width + 15
	nav_width = page_width - 30
	
	# clean existing output files
	if args.clean:
		print("Cleaning destination folder", end="", flush=True)
		folders_removed = 0
		files_removed = 0
		for name in os.listdir(destination_folder):
			path= os.path.join(destination_folder, name)
			if name.startswith(thumb_folder_root) or name.startswith(picture_folder_root) or name=="assets":
				print(".", end="", flush=True)
				shutil.rmtree(path)
				folders_removed += 1
			elif name.startswith(thumb_name_root) or name.startswith(picture_name_root) or name.startswith(header_name_root) or name.startswith(index_root) or name.startswith(detail_root) or name=="movies.txt":
				print(".", end="", flush=True)
				os.remove(path)
				files_removed += 1
		print()
		if files_removed>0 or folders_removed>0:
			print("  (Removed {:d} {} and {:d} {})".format(folders_removed, pluralize("folder", folders_removed), files_removed, pluralize("file", files_removed)))

	#copy assets folder
	dest_assets_path = os.path.join(destination_folder, "assets")
	if overwrite_assets and os.path.isdir(dest_assets_path):
		shutil.rmtree(dest_assets_path)
	if not os.path.isdir(dest_assets_path):
		print("Copying assets folder")
		src_assets_path = os.path.join(script_path, "assets")
		try:
			shutil.copytree(src_assets_path, dest_assets_path)
		except OSError as e:
			print("\nError copying:", dest_assets_path, ",", e)

	#save movies.txt
	movie_file_path = os.path.join(destination_folder, "movies.txt")
	if not os.path.isfile(movie_file_path):
		for index, movie_ref in enumerate(movie_refs):
			movie_refs[index] = "{}\t0\t1.0\t{}".format(movie_ref["picture_num"], movie_ref["movie_text"])
		movie_refs.insert(0, "{:d},1\n".format(len(final_image_refs)))
		print("Creating movies.txt")
		try:
			with open(movie_file_path, "w") as file:
				file.writelines(movie_refs)
		except OSError as e:
			print("\nError saving:", movie_file_path, ",", e)

	image_process_start = time.time()
	image_save_time = 0

	image_count = len(final_image_refs)
	if image_count>0:
		# create image folders
		create_start = False
		for folder_name, name_root, size in image_folders:
			dest_path = os.path.join(destination_folder, folder_name)
			if not os.path.isdir(dest_path):
				if not create_start:
					print("Creating folders", end="", flush=True)
					create_start = True
				print(".", end="", flush=True)
				os.mkdir(dest_path)
		if create_start:
			print()
		
		# resize images
		print("{:<28}".format("Creating {:d} {}".format(image_count, pluralize("image", image_count))), end="", flush=True)
		print("[{}]{}".format(" "*image_count, "\b"*(image_count+1)), end="", flush=True)
		
		futures = []
		for ref_index in range(len(final_image_refs)):
			if single_thread:
				result = save_versions(final_image_refs, ref_index, image_folders, page_headers, page_width)
				final_image_refs[result[3]] |= result[2]
				image_save_time += result[4]
				if result[0] < 0:
					print()
					print("Image Save Error:", result[1])
				elif result[0] == 0:
					print("x", end="", flush=True)
				else:
					print(".", end="", flush=True)
			else:
				future = executor.submit(save_versions, final_image_refs, ref_index, image_folders, page_headers, page_width)
				futures.append(future)

		if len(futures)>0:
			for future in concurrent.futures.as_completed(futures, timeout=None):
				if future.exception():
					print()
					print("Image scaling exception: ", future.exception())
				result = future.result()
				if result[0] >= 0:
					final_image_refs[result[3]] |= result[2]
					image_save_time += result[4]
				if result[0] < 0:
					print()
					print("Image Save Error:", result[1])
				elif result[0] == 0:
					print("x", end="", flush=True)
				else:
					print(".", end="", flush=True)
		else:
			print("x", end="", flush=True)
		
		print()

	image_process_time = time.time() - image_process_start
	html_generate_start = time.time()
	
	copyright_html = html.escape("©" + str(datetime.today().year) + " RickAndRandy.com")

	# save picture html files
	page_count = len(pages)
	detail_count = len(final_image_refs)
	if detail_count>0:
		print("{:<28}".format("Creating {:d} detail {}".format(detail_count, pluralize("page", detail_count))), end="", flush=True)

		with open(os.path.join(script_path, "detail.html"), "r") as file:
			detail_lines = file.readlines()
		with open(os.path.join(script_path, "movie.html"), "r") as file:
			movie_lines = file.readlines()

		print("[{}]{}".format(" "*detail_count, "\b"*(detail_count+1)), end="", flush=True)
		
		for page_number, image_ref in enumerate(final_image_refs, 1):
			detail_name = detail_url(image_ref["picture_num"])
			detail_path = os.path.join(destination_folder, detail_name)
			
			if "is_movie" in image_ref:
				new_detail_lines = movie_lines.copy()
			else:
				new_detail_lines = detail_lines.copy()
				
			page_title = journal["Title"] + " - " + (image_ref["caption"] if "caption" in image_ref else image_ref["file_name"])
			
			replace_keys(new_detail_lines, "_PageTitle_", html.escape(page_title))
			replace_keys(new_detail_lines, "_ImageURL_", image_ref["picture_name"])
			replace_keys(new_detail_lines, "_ImageWidth_", str(image_ref["width@1x"]))
			replace_keys(new_detail_lines, "_ImageHeight_", str(image_ref["height@1x"]))
		
			replace_keys(new_detail_lines, "_IndexPageURL_", index_url(image_ref["index_page_num"], num_indexes=page_count))
			
			replace_keys(new_detail_lines, "_PageNumber_", str(page_number))
			replace_keys(new_detail_lines, "_PreviousPageNumber_", str(page_number-1))
			replace_keys(new_detail_lines, "_NextPageNumber_", str(page_number+ 1))
			
			replace_keys(new_detail_lines, "_CurrentPageURL_", detail_url(page_number))
			replace_keys(new_detail_lines, "_PreviousPageURL_", detail_url(page_number-1))
			replace_keys(new_detail_lines, "_NextPageURL_", detail_url(page_number+1))
		
			replace_keys(new_detail_lines, "_EXIF_", image_ref["exif"])
		
			replace_keys(new_detail_lines, "_Copyright_", copyright_html)
			
			if page_number == 1:
				remove_lines_with_key(new_detail_lines, "removeonfirstpage")
			if page_number == detail_count:
				remove_lines_with_key(new_detail_lines, "removeonlastpage")
			
			remove_tag(new_detail_lines, "rkid")
			remove_tag(new_detail_lines, "removeonfirstpage")
			remove_tag(new_detail_lines, "removeonlastpage")
		
			did_save = False
			if overwrite_pages or not os.path.isfile(detail_path):
				try:
					with open(detail_path, "w") as detail_file:
						detail_file.writelines(new_detail_lines)
						print(".", end="", flush=True)
						did_save = True
						
				except OSError as e:
					print()
					print("\nError saving: ", detail_path, ",", e)
		
			if not did_save:
				print("x", end="", flush=True)
		
		print()
	
	page_count = len(pages)
	if page_count>0:
		# write the index pages
		with open(os.path.join(script_path, "index.html"), "r") as file:
			index_lines = file.readlines()
			
		replace_keys(index_lines, "_PageWidth_", str(page_width))
		replace_keys(index_lines, "_PageWidthExtra_", str(page_width_extra))
		replace_keys(index_lines, "_NavWidth_", str(nav_width))
		replace_keys(index_lines, "_ThumbSize_", str(thumb_size))
		replace_keys(index_lines, "_HeaderHeight_", str(header_height))
			
		nav_index, nav_lines = extract_section(index_lines, "nav", "endnav")
		photo_index, photo_lines = extract_section(index_lines, "picblock", "endpicblock")
		title_index, title_line = extract_section(index_lines, "title1item")
		title_index2, title_line2 = extract_section(index_lines, "title2item")
		text_index, text_line = extract_section(index_lines, "journaltext")
		image_index, image_line = extract_section(index_lines, "imageitem")
		
		print("{:<28}".format("Creating {:d} index {}".format(page_count, pluralize("page", page_count)),25), end="", flush=True)
		print("[{}]{}".format(" "*page_count, "\b"*(page_count+1)), end="", flush=True)
		
		for page_index, page in enumerate(pages, 1):
			new_index_lines = index_lines.copy()
			
			next_url = index_url(page_index+1, num_indexes=page_count)
			prev_url = index_url(page_index-1, num_indexes=page_count)
			
			page_title = journal["Title"]
			if page_count > 1:
				page_title = page_title + " - " + page_names[page_index-1]
			
			replace_keys(new_index_lines, "_PageTitle_", html.escape(page_title))
			replace_keys(new_index_lines, "_SiteHeading_", html.escape(journal["Title"]))
			
			if prev_url:
				replace_keys(new_index_lines, "_PreviousPageURL_", prev_url)
			elif page_index == 1:
				remove_lines_with_key(new_index_lines, "removeonfirstpage")
				
			if next_url:
				replace_keys(new_index_lines, "_NextPageURL_", next_url)
			elif page_index == page_count:
				remove_lines_with_key(new_index_lines, "removeonlastpage")

			if page_count == 1:
				remove_lines_with_key(new_index_lines, "prevnext")
			else:
				remove_tag(new_index_lines, "prevnext")

			replace_keys(new_index_lines, "_Copyright_", copyright_html)
		
			entries = page["Entries"]
			new_lines = []
		
			for entry in entries:
				if "Heading" in entry:
					heading_parts = entry["Heading"].split("\t")
					if len(heading_parts)>0:
						new_title_line = title_line if len(heading_parts)==1 else title_line2
						new_title_line = new_title_line.replace("_Text_", heading_parts[0])
						if len(heading_parts)>1:
							new_title_line = new_title_line.replace("_Text2_", heading_parts[1])
						new_lines.append(new_title_line)
				elif "Text" in entry:
					new_lines.append(text_line.replace("_Text_", entry["Text"]))
				elif "Image" in entry:
					image_filename = entry["Image"]
					width, height=size_of_image_file(os.path.join(destination_folder, image_filename))
					new_image_line = image_line.replace("_ImageURL_", image_filename)
					dest_width = entry["width"] if "width" in entry else page_width
					new_image_line = new_image_line.replace("_Width_", str(dest_width))
					new_image_line = new_image_line.replace("_Height_", str(dest_width * height / width))
					new_lines.append(new_image_line)
				elif "Photos" in entry:
					new_lines.extend(make_photo_block(photo_lines.copy(), entry["Photos"], thumb_size))
					
			dest_index = text_index
			for line in new_lines:
				new_index_lines.insert(dest_index, line)
				dest_index += 1
				
			if page_count > 1:
				new_nav_lines = make_nav_bar(nav_lines.copy(), page_index, page_names)
				dest_index = nav_index
				for line in new_nav_lines:
					new_index_lines.insert(dest_index, line)
					dest_index += 1
		
			if page_headers[page_index-1][0]:
				replace_keys(new_index_lines, "_HeaderImageURL_", header_image_url(page_index))
			else:
				remove_lines_with_key(new_index_lines, "_HeaderImageURL_")
		
			remove_tag(new_index_lines, "rkid")
			remove_tag(new_index_lines, "removeonfirstpage")
			remove_tag(new_index_lines, "removeonlastpage")
		
			did_save = False
			output_path = os.path.join(destination_folder, index_url(page_index, num_indexes=page_count, for_html=False))
			if overwrite_pages or not os.path.isfile(output_path):
				try:
					with open(output_path, "w") as file:
						file.writelines(new_index_lines)
						print(".", end="", flush=True)
						did_save = True
		
				except OSError as e:
					print()
					print("\nError saving: ", output_path, ",", e)
					
			if not did_save:
				print("x", end="", flush=True)
				
			page_index += 1
		
		print()
	
	html_generate_time = time.time() - html_generate_start
	total_time = time.time() - start_time
	
	if args.timings:
		print()
		print("Timing Summary")
		format_str = "  {:<18} {:6.3f}s"
		print(format_str.format("File scanning:", file_scan_time))
		if photo_list_time >= 0.0005: print(format_str.format("Enumerate files:", photo_list_time))	
		if journal_scan_time >= 0.0005: print(format_str.format("Journal scanning: ", journal_scan_time))
		if image_process_time >= 0.0005: print(format_str.format("Image Processing:", image_process_time))
		# if image_save_time >= 0.0005: print(format_str.format("Image saving:", image_save_time))
		if html_generate_time >= 0.0005: print(format_str.format("HTML Generation:", html_generate_time))
		print(format_str.format("Total Time:", total_time))

	if args.no_cache:
		print()
		print("***                                                     ***")
		print("*** WARNING: Image caching is disabled in output files! ***")
		print("***                                                     ***")
		print()

	if args.open_result:
		dest_url = "file://" + os.path.join(destination_folder, index_url(1, 10, False))
		print("Opening:", dest_url)
		webbrowser.open(dest_url)

if __name__ == '__main__':
	if not single_thread:
		executor = concurrent.futures.ThreadPoolExecutor()
	
	print("-- Building Journal --")
	main()
	print("-- Journal Building Complete --")
