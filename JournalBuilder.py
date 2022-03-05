#!python3

# pip install --upgrade pip
# pip install cryptography
# pip install pyheif
# pip install pillow_heif
# pip install exifread
# pip install Pillow
# pip install osxphotos

import sys, os, time, shutil, pathlib
import argparse
from datetime import datetime, timedelta, timezone
from PIL import Image
from pillow_heif import register_heif_opener
import exifread
import concurrent.futures
from rich.console import Console
from rich.progress import Progress, BarColumn, TimeElapsedColumn
from rich.theme import Theme
from rich.panel import Panel
import html  
import webbrowser

parser = argparse.ArgumentParser(description='Generate a web journal')

parser.add_argument("folder", metavar='dest_folder', help="Destination folder", type=str, nargs="?")

parser.add_argument("-g", "--guide", dest="documentation", help="Show user guide", action="store_true")
parser.add_argument("-c", "--clean", dest="clean", help="Remove all existing output files", action="store_true")
parser.add_argument("-t", "--timing", dest="timings", help="Print timing information", action="store_true")
parser.add_argument("-s", "--single", dest="single_thread", help="Run all tasks on main thread", action="store_true")
parser.add_argument("-nc", "--nocache", dest="no_cache", help="Prevent caching of images and links (for debugging)", action="store_true")
parser.add_argument("-o", "--open", dest="open_result", help="Open output journal in browser", action="store_true")

group = parser.add_argument_group("journal control")
group.add_argument("-j", dest="journal", help="Journal information file (default: 'journal.txt' in destination folder)", type=str, default="journal.txt")
group.add_argument("-i", dest="images_folder", help="Source image folder (default: 'images' in destination folder)", type=str, default="images")
group.add_argument("-jt", dest="journal_title", help="Journal title", type=str, default=None)
group.add_argument("-ts", dest="thumb_size", help="Thumbnail size (default: 190)", type=int, default=190)
group.add_argument("-is", dest="image_size", help="Base image size (default: 1024)", type=int, default=1024)
group.add_argument("-hh", dest="header_height", help="Header height (default: 250)", type=int, default=250)
group.add_argument("-ta", dest="tall_aspect", help="Tall aspect ratio threshold (default: 1.15)", type=float, default=1.15)
group.add_argument("-y", dest="year", help="copyright year (default: current year)", default=datetime.today().year)
group.add_argument("-r", "--reorder", dest="reorder_thumbs", help="Re-order thumbs to minimize page height", action="store_true")
group.add_argument("-q", dest="jpeg_quality", help="JPEG quality level (default: high)", type=str, choices=["low", "medium", "high", "very_high", "maximum"], default="high")
group = parser.add_argument_group("album settings")
group.add_argument("-db", dest="data_base", help="Path to Photos library (default: system library)", type=str, default=None)
group.add_argument("-a", dest="album_name", help="Source album name", type=str, default=None)
group.add_argument("-d", "--date", dest="date_sort", help="Show images in chronological order (default: album order)", action="store_true")
group.add_argument("-f", "--favorite", dest="favorites", help="Include only favorite images", action="store_true")

group = parser.add_argument_group("template creation")
group.add_argument("-mt", "--maketemplate", dest="make_template", help="Template start and end dates: YYYY-MM-DD,YYYY-MM-DD", type=str, default=None)

group = parser.add_argument_group("overwriting")
group.add_argument("-w", "--overwrite", dest="overwrite", help="Overwrite all existing output files", action="store_true")
group.add_argument("-wi", "--overimages", dest="overwrite_images", help="Overwrite existing output images", action="store_true")
group.add_argument("-wh", "--overheaders", dest="overwrite_headerimages", help="Overwrite existing header images", action="store_true")
group.add_argument("-wp", "--overpages", dest="overwrite_pages", help="Overwrite existing html pages", action="store_true")
group.add_argument("-wm", "--overmovies", dest="overwrite_movies", help="Overwrite existing movies.txt", action="store_true")
group.add_argument("-wa", "--overassets", dest="overwrite_assets", help="Overwrite existing assets folder", action="store_true")

group = parser.add_argument_group("debugging")
subgroup = group.add_mutually_exclusive_group()
subgroup.add_argument("-dc", "--datecaption", dest="dates_as_captions", help="Use dates as thumbnail captions", action="store_true")
subgroup.add_argument("-ac", "--aspectcaption", dest="aspect_as_captions", help="Use aspect ratios as thumbnail captions", action="store_true")

args = parser.parse_args()

script_path = os.path.abspath(os.path.dirname(sys.argv[0]))

theme = Theme({
			"progress.percentage": "white",
			"progress.remaining": "green",
			"progress.elapsed": "green",
			"bar.complete": "green",
			"bar.finished": "green",
			"bar.pulse": "green",
			"repr.ellipsis": "white",
			"repr.number": "white",
			"repr.path": "white",
			"repr.filename": "white"
			# "progress.data.speed": "white",
			# "progress.description": "none",
			# "progress.download": "white",
			# "progress.filesize": "white",
			# "progress.filesize.total": "white",
			# "progress.spinner": "white",
			})

console = Console(theme=theme)

error_color = "[bold red]"
error_item_color = "[bright_magenta]"
error_message_color = "[magenta]"

if args.documentation:
	with open(os.path.join(script_path, "journal.md"), "r") as file:
		console.print(file.read(), end="")
	quit()

overwrite_images = args.overwrite or args.overwrite_images
overwrite_headers = args.overwrite or args.overwrite_headerimages
overwrite_pages = args.overwrite or args.overwrite_pages
overwrite_movies = args.overwrite or args.overwrite_movies
overwrite_assets = args.overwrite or args.overwrite_assets

start_time = time.time()

destination_folder = None

previous_external_url = None
next_external_url = None

thumb_size = args.thumb_size
base_image_size = args.image_size
header_height = args.header_height
tall_aspect = args.tall_aspect

page_width = 0
nav_width = 0

page_names = []
page_headers = []
image_folders = None

thumb_folder_root = "thumbnails"
thumb_name_root = "thumb-"
picture_folder_root = "pictures"
picture_name_root = "picture-"
header_name_root = "Placed Image"
index_root = "index"
detail_root = "large-"

jpeg_quality = {"low":"web_low", "medium":"web_medium", "high":"web_high", "very_high":"web_very_high", "maximum":"web_maximum"}

date_format = "%Y-%m-%d %H:%M:%S"
date_formats = [date_format, "%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y:%m:%d"]

register_heif_opener()

def print_now(str):
	console.print(str, end="")

def open_image_file(file_ref):
	image = None
	is_heif = False

	if isinstance(file_ref, str):
		file_obj = open(file_ref, "rb", buffering=100000000)
		path = file_ref
	else:
		file_obj = file_ref
		path = file_ref.name

	try:
		image = Image.open(file_obj)
		is_heif = pathlib.Path(path).suffix.lower() in ['.heif', '.heic']
	except:
		pass

	return image, is_heif

def size_of_image_file(file_ref, orientation=0):
	image_size = None

	if isinstance(file_ref, str):
		path = file_ref
	else:
		path = file_ref.name

	try:
		image = Image.open(path)
		image_size = image.size

		if not pathlib.Path(path).suffix.lower() in ['.heif', '.heic']:
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
	
def save_versions(image_ref, ref_index, version_data, header_info):
	def save_image(image, path):
		with open(path, "wb", buffering=10000000) as file:
			image.save(file, "JPEG", quality=args.jpeg_quality)

	def save_scaled(image, size, path):
		start_time = time.time()
		scaled_image = image.resize(size, resample=Image.LANCZOS)
		scaled_time = time.time()
		save_image(scaled_image, path)
		saved_time = time.time()
		return (scaled_image, saved_time-scaled_time, scaled_time-start_time)

	def save_scaled_header(image, size, offset, path):
		src_slice_height = int(image.size[0] * size[1] / size[0])
		src_top = int((image.size[1]-src_slice_height) * offset / 100)
		start_time = time.time()
		cropped_image = image.resize(size, box=(0, src_top, image.size[0], src_top+src_slice_height), resample=Image.LANCZOS)
		scaled_time = time.time()
		save_image(cropped_image, path)
		saved_time = time.time()
		return (saved_time-scaled_time, scaled_time-start_time)

	def load_image(image, orientation):
		rotates = { 3:180, 6:270, 8:90 }
		if orientation in rotates:
			image = image.rotate(rotates[orientation], expand=True)
		else:
			image.load()
		return image

	do_timing = version_data["timings"]
	result = 0
	error_msg = ""
	timing_data = None
	new_keys = None

	if do_timing:
		timing_data = {}
		start_time = time.time()

	image, is_heif = open_image_file(image_ref["file_path"])

	if do_timing:
		timing_data["open_time"] = time.time() - start_time

	if image:
		is_loaded = False
		image_size = image.size
		orientation = 0

		if is_heif and "current_size" in image_ref and image_size != image_ref["current_size"]:
			is_heif = False

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
		if do_timing:
			new_keys["timing_data"] = timing_data

		large_images = [None, None, None]

		for folder_name, name_root, size, index in version_data["image_folders"]:
			output_path = os.path.join(version_data["destination_folder"], folder_name, picture_url(name_root, image_ref["picture_num"], False))

			if version_data["overwrite_images"] or not os.path.isfile(output_path):
				try:
					if large_images[index]:
						source_image = large_images[index]
					else :
						if not is_loaded:
							if do_timing:
								start_time = time.time()
							image = load_image(image, orientation)
							if do_timing:
								timing_data["load_time"] = time.time() - start_time
								timing_data["save_time"] = 0.0
								timing_data["scale_time"] = 0.0
							is_loaded = True
						source_image = image
					new_size = scaled_size(image_size, size)
					scaled_image, scale_time, save_time = save_scaled(source_image, new_size, output_path)
					if do_timing:
						timing_data["save_time"] += save_time
						timing_data["scale_time"] += scale_time
					large_images[index] = scaled_image
					result = result + 1 if result>=0 else result
				except OSError as e:
					result = -1
					error_msg = "Error saving: " + output_path + ", " + str(e)

			if result >= 0 and header_info:
				header_size = (version_data["page_width"], version_data["header_height"])
				for scale, suffix in [ (1, ""), (2, "@2x"), (3, "@3x")]:
					output_path = os.path.join(version_data["destination_folder"], header_image_url(header_info[2], suffix=suffix, for_html=False))
					if version_data["overwrite_headers"] or not os.path.isfile(output_path):
						try:
							if not is_loaded:
								if do_timing:
									start_time = time.time()
								image = load_image(image, orientation)
								if do_timing:
									timing_data["load_time"] = time.time() - start_time
								is_loaded = True
							scale_time, save_time = save_scaled_header(image, (header_size[0] * scale, header_size[1] * scale), header_info[1], output_path)
							if do_timing:
								if not "header_save_time" in timing_data:
									timing_data["header_save_time"] = 0
									timing_data["header_scale_time"] = 0
								timing_data["header_save_time"] += save_time
								timing_data["header_scale_time"] += scale_time
							result = result + 1 if result >= 0 else result
						except OSError as e:
							result = -1
							error_msg = "Error saving: " + output_path + ", " + str(e)
	else:
		result = -1
		error_msg = "Cannot open: " + image_ref["file_path"]

	return(result, error_msg, new_keys, ref_index)

def replace_key(lines, src_key, replacement_key):
	for index, line in enumerate(lines):
		if src_key in line:
			lines[index] = line.replace(src_key, replacement_key)
			
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

def remove_tags(lines, *args):
	for tag in args:
		remove_tag(lines, tag)
			
def remove_lines_with_key(lines, key):
	index = 0
	while index < len(lines):
		if key in lines[index]:
			del lines[index]
		else:
			index += 1
	
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
			tag = tag_parts[0].lower()
			subtag = tag_parts[1] if len(tag_parts) > 1 else ""
			text = line[tag_end+1:]
	elif len(line)>0:
		tag = "text"
		text = line
		while text.endswith("<br>") and len(src)>0 and not src[0].startswith("["):
			text = text + '\n' + src.pop(0).strip()
	
	return (tag, subtag, text)

def date_from_string(date_string):
	if len(date_string)>0:
		for format in date_formats:			
			try:
				date_time = datetime.strptime(date_string, format)
				if "%H" not in format:
					date_time = date_time.replace(hour=1, minute=1)
				date_time = date_time.replace(tzinfo=timezone(timedelta(days=-1, seconds=61200)))
				return date_time
			except:
				pass	
		console.print(error_color + "Failed to parse date " + error_item_color +  date_string)
	return None

def extract_section(lines, starttext, endtext=None):
	def index_of_substring(list, substr, start=0):
		for index, item in enumerate(list[start:], start):
			if substr in item:
				return index
		return -1

	start_index = index_of_substring(lines, starttext)
	if start_index == -1:
		return (-1, None)
	if endtext:
		end_index = index_of_substring(lines, endtext, start_index+1)
		if end_index == -1:
			return (-1, None)
		items = []
		for i in range(start_index, end_index+1):
			items.append(lines.pop(start_index))
		return (start_index, items)
	else:
		return (start_index, lines.pop(start_index))

def pluralize(str, count, pad=False):
	if count == 1:
		return str+" " if pad else str
	else:
		return str+"s"

def extract_up_to(text, substr):
	src_text = text
	if text.startswith('"'):
		text = text[1:]
		substr = '"' + substr
	index = text.find(substr)
	if index >= 0:
		return text[:index], text[index+len(substr):]
	else:
		return None, src_text

def cache_suffix(for_html=True):
	if for_html and args.no_cache:
		return "?{:d}".format(int((time.time() * 10000) % 10000))
	else:
		return ""

def index_url(index_num, for_html=True):
	if index_num <= 0:
		return previous_external_url if previous_external_url else None
	elif index_num == 1:
		return "{}.html{}".format(index_root, cache_suffix(for_html))
	elif index_num >= len(page_names)+1:
		return next_external_url if next_external_url else None
	else:
		return "{}{}.html{}".format(index_root, index_num, cache_suffix(for_html))

def detail_url(picture_number):
	return("{}{}.html".format(detail_root, picture_number))
	
def header_image_url(page_num, for_html=True, suffix=""):
	return "{} - {:d}{}.jpg{}".format(header_name_root, page_num, suffix, cache_suffix(for_html))

def picture_url(name_root, page_num, for_html=True):
	return "{}{}.jpg{}".format(name_root, page_num, cache_suffix(for_html))

def make_nav_bar(nav_lines, page_index):
	page_count = len(page_names)
	selected_index, selected_line = extract_section(nav_lines, 'rkid="off"')
	un_selected_index, un_selected_line = extract_section(nav_lines, 'rkid="on"')

	next_url = index_url(page_index+1)
	prev_url = index_url(page_index-1)
	
	for i in range(0, page_count):
		if i+1 == page_index:
			nav_item = selected_line
		else:
			nav_item = un_selected_line.replace("_IndexPageURL_", index_url(i+1))
		nav_item = nav_item.replace("_PageName_", page_names[i])
		nav_lines.insert(selected_index, nav_item)
		selected_index += 1

	if prev_url:
		replace_key(nav_lines, "_PreviousPageURL_", prev_url)
		remove_lines_with_key(nav_lines, "leaveonfirst")
	else:
		remove_lines_with_key(nav_lines, "removeonfirst")
		
	if next_url:
		replace_key(nav_lines, "_NextPageURL_", next_url)
		remove_lines_with_key(nav_lines, "leaveonlast")
	else:
		remove_lines_with_key(nav_lines, "removeonlast")

	remove_tags(nav_lines, "removeonfirst", "leaveonfirst", "removeonlast", "leaveonlast")
	return nav_lines
	
def insert_array_into_array(src, dest, index):
	for item in src:
		dest.insert(index, item)
		index += 1
	return index

def make_photo_block(photo_lines, image_refs):
	image_index, image_lines = extract_section(photo_lines, "imagediv", "endimagediv")

	for image_ref in image_refs:
		new_image_lines = image_lines.copy()
		new_size = scaled_size(image_ref["image_size"], thumb_size)
		
		picture_num = image_ref["picture_num"]
		replace_key(new_image_lines, "_DetailPageURL_", detail_url(picture_num))
		replace_key(new_image_lines, "_ThumbURL_", picture_url(thumb_name_root, picture_num))

		replace_key(new_image_lines, "_ThumbWidth_", str(new_size[0]))
		replace_key(new_image_lines, "_ThumbHeight_", str(new_size[1]))
		
		caption = None
		if args.dates_as_captions:
			caption = html.escape(image_ref["date_string"])
		elif args.aspect_as_captions:
			if "block_index" in image_ref:
				caption = "{:1.2f}, #{}".format(image_ref["aspect"], image_ref["block_index"])
			else:
				caption = "{:1.2f}".format(image_ref["aspect"])
			caption = "{}, {}".format("Tall" if image_ref["tall"] else "Wide", caption)
		elif "caption" in image_ref:
			caption = html.escape(image_ref["caption"])

		if caption:
			replace_key(new_image_lines, "_metavalue_", caption)
		else:
			remove_lines_with_key(new_image_lines, "_metavalue_")			
		
		image_index = insert_array_into_array(new_image_lines, photo_lines, image_index)

	return photo_lines

def add_images_before_date(refs, before_date, dest_list, index_page_num):
	if len(refs):
		if before_date:
			new_refs = []
			while len(refs) > 0 and refs[0]["date"] < before_date:
				ref = refs.pop(0)
				new_refs.append(ref)
		else:
			new_refs = refs.copy()
			refs.clear()

		if len(new_refs) > 0:
			for ref in new_refs:
				ref["index_page_num"] = index_page_num
			dest_list.append({"Photos": new_refs})

def rearrange(pages):
	def find_item(tall, line_index, start_offset=0):
		start_index = line_index * 4
		for index in range(start_index+start_offset, min(len(photos), start_index+4)):
			if photos[index]["tall"] == tall:
				return index
		return -1

	def find_wide_tall(first, second, line_index):
		return find_item(first, line_index), find_item(second, line_index+1)

	def insert_photos(index, *args):
		for photo in args:
			photos.insert(index, photo)
			index += 1

	def consolidate(src_index, dest_index):
		dest_photo = photos.pop(dest_index)
		src_photo = photos.pop(src_index)
		insert_photos(src_index // 4 * 4 + 3, dest_photo, src_photo)

	def move_photo(src_index, dest_index):
		src_photo = photos.pop(src_index)
		if dest_index % 4 == 0:
			next_index = find_item(not src_photo["tall"], dest_index // 4)
			insert_photos(dest_index-1, photos.pop(next_index), src_photo)
		else:
			insert_photos(dest_index-1, src_photo)

	def double_move(src_index, dest_index):
		src_line_index = src_index // 4
		src_index2 = find_item(True, src_line_index, src_index % 4+1)
		dest_index2 = find_item(False, src_line_index+1, dest_index % 4+1)
		dest2 = photos.pop(dest_index2)
		dest1 = photos.pop(dest_index)
		src2 = photos.pop(src_index2)
		src1 = photos.pop(src_index)
		insert_photos(src_line_index*4+2, dest1, dest2, src1, src2)

	for page in pages:
		for entry in page["Entries"]:
			if "Photos" in entry:
				photos = entry["Photos"]
				line_count = (len(photos)+3) // 4

				tall_counts = []
				tall_count = 0
				for index, photo in enumerate(photos):
					photo["block_index"] = index
					tall_count += photo["tall"]
					if index%4 == 3 or index == len(photos)-1:
						tall_counts.append(tall_count)
						tall_count = 0

				moves = { 	(1,3):(consolidate, True, False, -1, 1), (3,1):(consolidate, False, True, 1, -1),
							(1,1): (move_photo, True, True, -1, 1), (3,3): (move_photo, False, False, 1, -1),
							(2,2):(double_move, True, False, -2, 2) }
				for line_index in range(0, line_count-1):
					counts = (tall_counts[line_index], tall_counts[line_index+1])
					if counts in moves:
						func, src_find, dest_find, src_change, dest_change = moves[counts]
						src_index, dest_index = find_wide_tall(src_find, dest_find, line_index)
						func(src_index, dest_index)
						tall_counts[line_index] += src_change
						tall_counts[line_index+1] += dest_change

				slides = { 	"0101":(1, 2), "0110":(0, 2), "1001":(3, 1), "1010":(2, 1),
							"0100":(1, 0), "1011":(1, 0), "0010":(2, 3), "1101":(2, 3), 
							"011":(0, 2), "100":(0, 2), "010":(1, 2), "101":(1, 2) }
				for line_index in range(line_count):
					key = ""
					index = line_index * 4
					for i in range(index, min(len(photos), index+4)):
						key += "1" if photos[i]["tall"] else "0"
					if key in slides:
						src_offset, dest_offset = slides[key]
						photos.insert(index+dest_offset, photos.pop(index+src_offset))

				for index, photo in enumerate(photos):
					if index != photo["block_index"]:
						photo["block_index"] = "<b>{}*</b>".format(photo["block_index"])

def scan_header(journal, date_overrides):
	global previous_external_url
	global next_external_url
	global thumb_size
	global base_image_size
	global header_height
	global tall_aspect

	while len(journal) > 0:
		tag, subtag, text = get_next_line(journal)
		if tag == "date":
			date_overrides[subtag] = text
		elif tag == "value":
			if len(subtag) > 0 and len(text) > 0:
				if subtag == "thumb_size":
					thumb_size = int(text)
				elif subtag == "header_height":
					header_height = int(text)
				elif subtag == "image_size":
					base_image_size = int(text)
				elif subtag == "tall_aspect":
					tall_aspect = float(text)
		elif tag == "previous":
			previous_external_url = text
		elif tag == "next":
			next_external_url = text
		elif not args.album_name and tag == "album":
			args.album_name = text
			args.favorites = True
			args.open_result = True
			args.clean = True
			args.reorder_thumbs = True
		elif tag == "year":
			args.year = int(text)
		elif tag == "test":
			args.no_cache = True

def main():
	global console
	global page_width
	global nav_width
	global image_folders
	global destination_folder

	if args.folder:
		destination_folder = args.folder
		if not os.path.isdir(destination_folder):
			parser.error("Destination directory not found")
	else:
		destination_folder = os.getcwd()

	unplaced_image_refs = []

	# read journal file
	journal_file_path = args.journal
	if not "/" in journal_file_path:
		journal_file_path = os.path.join(destination_folder, journal_file_path)
	if os.path.isfile(journal_file_path):
		with open(journal_file_path, "r") as file:
			journal_src = file.readlines()
	elif not args.folder:
		parser.error("journal.txt not found in current directory")
	else:
		journal_src = []
		
	# scan journal header
	date_overrides = {}
	scan_header(journal_src.copy(), date_overrides)
	
	# read the file list, get the file info
	file_scan_start = photo_list_start = time.time()
	file_paths = []

	if args.album_name:
		print_now("Opening Photos database...")
		import osxphotos
		photosdb = osxphotos.PhotosDB(dbfile=args.data_base)
		console.print(" done.")
		album_info = next((info for info in photosdb.album_info if info.title == args.album_name), None)
		if album_info:
			for photo in album_info.photos:
				if photo.isphoto and not photo.hidden and (not args.favorites or photo.favorite):
					photo_path = photo.path_edited if photo.path_edited else photo.path
					if photo_path:
						file_paths.append((photo.original_filename, photo_path, photo.title, photo.date, photo.width, photo.height, 0 if photo.path_edited else photo.orientation))
					else:
						console.print(error_color + "Warning: File missing for " + error_item_color + photo.filename)
		else:
			parser.error("Photos album not found: " + args.album_name)
	else:
		images_folder_path = args.images_folder
		if not "/" in images_folder_path:
			images_folder_path = os.path.join(destination_folder, images_folder_path)
		if os.path.isdir(images_folder_path):
			for file_name in os.listdir(images_folder_path):
				file_path = os.path.join(images_folder_path, file_name)
				if not file_name.startswith('.') and os.path.isfile(file_path):
					file_paths.append((file_name, file_path, None, None, None, None, None))
			
	if len(file_paths) == 0:
		parser.error("No source photos found! Please specify an album name (-a) or an image folder (-i).")

	photo_list_time = time.time() - photo_list_start
		
	print_now("Retrieving photo metadata...")
	for file_name, file_path, title, photo_date, photo_width, photo_height, photo_orientation in file_paths:
		with open(file_path, "rb") as image_file:
			tags = exifread.process_file(image_file, details=False)
			keys = tags.keys()
			image_ref = {}

			image_ref["file_name"] = file_name
			image_ref["file_path"] = file_path
			
			if file_name in date_overrides:
				photo_date = date_from_string(date_overrides[file_name])
			if not photo_date and 'Image DateTime' in tags:
				photo_date = date_from_string(tags['Image DateTime'].values)
			if not photo_date:
				photo_date = datetime.fromtimestamp(os.path.getmtime(file_path))
				console.print(error_color + "Warning: Using os date for " + error_item_color + file_name + " - " + error_message_color + photo_date)

			image_ref["date"] = photo_date
			image_ref["date_string"] = photo_date.strftime(date_format)

			if photo_orientation:
				image_ref["orientation"] = photo_orientation
			else:
				image_ref["orientation"] = tags['Image Orientation'].values[0] if 'Image Orientation' in keys else 0

			if args.reorder_thumbs or args.aspect_as_captions:
				if photo_width and photo_height:
					image_size = (photo_width, photo_height)
				else:
					image_size = size_of_image_file(image_file, image_ref["orientation"])
				if image_size:
					aspect_ratio = float(image_size[0]) / float(image_size[1])
				else:
					aspect_ratio = 1.0
				image_ref["aspect"] = aspect_ratio
				image_ref["tall"] = aspect_ratio < tall_aspect

			if photo_width and photo_height:
				image_ref["current_size"] = (photo_width, photo_height)

			if not title and 'Image ImageDescription' in keys:
				title = tags['Image ImageDescription'].values

			if title and (title != "default") and not ("DCIM\\" in title):
				image_ref["caption"] = title
			
			exif_data = [file_name, image_ref["date_string"]]
			
			def format_shutter(speed):
				if speed <= 0.5:
					return "1/{:d}s".format(int(1.0 / speed))
				else:
					return "{:d}s".format(speed)

			def format_ev(bias):
				if abs(bias) <= 0.1:
					return "0ev"
				else:
					return "{:+.1f}ev".format(bias)

			if 'EXIF ExposureTime' in keys:
				exif_data.append(format_shutter(float(tags['EXIF ExposureTime'].values[0])))
			if 'EXIF FNumber' in keys:
				exif_data.append("ƒ{:.1f}".format(float(tags['EXIF FNumber'].values[0])))
			if 'EXIF ExposureBiasValue' in keys:
				exif_data.append(format_ev(float(tags['EXIF ExposureBiasValue'].values[0])))
			if 'EXIF ISOSpeedRatings' in keys:
				exif_data.append("ISO {:d}".format(tags['EXIF ISOSpeedRatings'].values[0]))
			if 'EXIF FocalLengthIn35mmFilm' in keys:
				exif_data.append("{:d}mm".format(tags['EXIF FocalLengthIn35mmFilm'].values[0]))
			if 'Image Model' in keys:
				exif_data.append(tags['Image Model'].values)
				
			image_ref["exif"] = " &bull; ".join(exif_data)
			unplaced_image_refs.append(image_ref)
	console.print(" done.")

	file_scan_time = time.time() - file_scan_start

	# sort based on date
	if not args.album_name or args.date_sort:
		unplaced_image_refs.sort(key=lambda image_ref: image_ref["date"])

	# generate journal structure
	all_image_refs = unplaced_image_refs.copy()
	pages = []
	journal_title = ""
	entries = None
	last_entries = None
	movie_refs = []
	index_page_num = 0

	journal_scan_start = time.time()

	while len(journal_src) > 0:
		tag, subtag, text = get_next_line(journal_src)
		
		if tag == "site":
			journal_title = text
		elif tag == "page" or tag == "epilog":
			index_page_num += 1
			last_entries = entries
			entries = []
			if tag == "epilog":
				text = "Epilog"
				add_images_before_date(unplaced_image_refs, None, last_entries if last_entries is not None else entries, index_page_num-1)
			page = { "Entries": entries }
			tag_parts = subtag.split(",")
			header_ref = None
			header_offset = 50
			if len(tag_parts) >= 1:
				try:
					header_ref = next((image_ref for image_ref in all_image_refs if image_ref["file_name"] == tag_parts[0]), None)
					if len(tag_parts) >= 2:
						header_offset = int(tag_parts[1])
				except:
					pass
			
				if not header_ref:
					console.print(error_color + "Warning: Header image not found for page: " + error_item_color + text + " - " + tag_parts[0])

			page_headers.append((header_ref, header_offset, index_page_num))
			page_names.append(text)
			pages.append(page)
		elif tag == "caption":
			caption_ref = next((image_ref for image_ref in all_image_refs if image_ref["file_name"] == subtag), None)
			if caption_ref:
				caption_ref["caption"] = text
			else:
				console.print(error_color + "Warning: Image for caption not found: " + error_item_color + subtag)
		elif entries is not None:
			if tag == "heading":
				entry = { "Heading": text }
				date = date_from_string(subtag)
				if date:
					entry["Date"] = date
					use_last = last_entries is not None and len(entries) == 0
					add_images_before_date(unplaced_image_refs, date, last_entries if use_last else entries, index_page_num-1 if use_last else index_page_num)
				entries.append(entry)
			elif tag == "timestamp":
				date = date_from_string(subtag)
				if date:
					use_last = last_entries is not None and len(entries) == 0
					add_images_before_date(unplaced_image_refs, date, last_entries if use_last else entries, index_page_num-1 if use_last else index_page_num)
			elif tag == "text":
				entries.append({ "Text": text})
			elif tag == "image":
				tag_parts = subtag.split(",")
				if len(tag_parts)>=1:
					entry = { "Image": tag_parts[0] }
					if len(tag_parts) >= 2:
						entry["width"] = int(tag_parts[1])
					entries.append(entry)
			elif tag == "movie":
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
					console.print(error_color + "Warning: Invalid movie info: " + error_item_color + text)
	
	if len(pages) == 0 and args.album_name:
		index_page_num = 1
		name = args.journal_title if args.journal_title else args.album_name
		journal_title = name
		entries = []
		page = { "Entries": entries }
		pages.append(page)
		page_headers.append((None, 0, index_page_num))
		page_names.append(name)

	if entries is not None:
		add_images_before_date(unplaced_image_refs, None, entries, index_page_num)
	
	# merge movie entries
	for page_index, page in enumerate(pages):
		first_photos = None
		entries = page["Entries"]
		index = 0
		while index < len(entries):
			entry = entries[index]
			if "Movie" in entry:
				movie_list = [ entry["Movie"] ]
				if not first_photos:
					first_photos = movie_list
				entries[index] = { "Photos": movie_list }
				while index < len(entries)-1 and "Movie" in entries[index+1]:
					next_movie = entries.pop(index+1)
					movie_list.append(next_movie["Movie"])
			elif not first_photos and "Photos" in entry:
				first_photos = entry["Photos"]
			index += 1
		
		if first_photos and len(first_photos)>0:
			header_ref, header_offset, page_num = page_headers[page_index]
			if not header_ref:
				page_headers[page_index] = (first_photos[0], header_offset, page_num)
	
	# re-order thumbnails slightly to minimize page height
	if args.reorder_thumbs:
		rearrange(pages)

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
					(picture_folder_root, picture_name_root, base_image_size, 0),
					(picture_folder_root + "@2x", picture_name_root, base_image_size*2, 1),
					(picture_folder_root + "@3x", picture_name_root, base_image_size*3, 2),
					(thumb_folder_root, thumb_name_root, thumb_size, 0),
					(thumb_folder_root + "@2x", thumb_name_root, thumb_size*2, 1),
					(thumb_folder_root + "@3x", thumb_name_root, thumb_size*3, 2) ]
						
	image_columns = 4
	column_gap = 15
	page_width = thumb_size * image_columns + column_gap * (image_columns - 1)
	nav_inset = 15
	nav_width = page_width - 2 * nav_inset

	# clean existing output files
	if args.clean:
		print_now("Cleaning destination folder...")
		folders_removed = 0
		files_removed = 0
		for name in os.listdir(destination_folder):
			path= os.path.join(destination_folder, name)
			if name.startswith(thumb_folder_root) or name.startswith(picture_folder_root) or name=="assets":
				shutil.rmtree(path)
				folders_removed += 1
			elif name.startswith(thumb_name_root) or name.startswith(picture_name_root) or name.startswith(header_name_root) or name.startswith(index_root) or name.startswith(detail_root) or name=="movies.txt":
				os.remove(path)
				files_removed += 1
		if files_removed>0 or folders_removed>0:
			console.print("  removed {:d} {} and {:d} {}.".format(folders_removed, pluralize("folder", folders_removed), files_removed, pluralize("file", files_removed)))
		else:
			console.print("  done.")

	#copy assets folder
	dest_assets_path = os.path.join(destination_folder, "assets")
	if overwrite_assets and os.path.isdir(dest_assets_path):
		shutil.rmtree(dest_assets_path)
	if not os.path.isdir(dest_assets_path):
		print_now("Copying assets folder...")
		src_assets_path = os.path.join(script_path, "assets")
		try:
			shutil.copytree(src_assets_path, dest_assets_path)
			console.print("  done.")
		except OSError as e:
			console.print(error_color + "Error copying: " + error_item_color + dest_assets_path, " , " + error_message_color + e)

	#save movies.txt
	movie_file_path = os.path.join(destination_folder, "movies.txt")
	if not os.path.isfile(movie_file_path):
		for index, movie_ref in enumerate(movie_refs):
			movie_refs[index] = "{}\t0\t1.0\t{}\n".format(movie_ref["picture_num"], movie_ref["movie_text"])
		movie_refs.insert(0, "{:d},1\n".format(len(final_image_refs)))
		console.print("Creating movies.txt")
		try:
			with open(movie_file_path, "w") as file:
				file.writelines(movie_refs)
		except OSError as e:
			console.print(error_color + "Error saving: " + error_item_color + movie_file_path, " , " + error_message_color + e)

	image_timing = None
	image_process_start = time.time()

	image_count = len(final_image_refs)
	if image_count>0:
		# create image folders
		create_start = False
		for folder_name, name_root, size, index in image_folders:
			dest_path = os.path.join(destination_folder, folder_name)
			if not os.path.isdir(dest_path):
				if not create_start:
					print_now("Creating folders")
					create_start = True
				print_now(".")
				os.mkdir(dest_path)
		if create_start:
			console.print("  done.")
		
		# resize images
		version_data = {
			"page_width" : page_width,
			"header_height" : header_height,
			"destination_folder" : destination_folder,
			"image_folders" : image_folders,
			"overwrite_images" : overwrite_images,
			"overwrite_headers" : overwrite_headers,
			"timings" : args.timings
		}

		image_keys = ["file_path", "file_name", "current_size", "orientation", "picture_num"]

		if args.timings:
			image_timing = {
				"open_time" : 0.0,
				"load_time" : 0.0,
				"save_time" : 0.0,
				"scale_time" : 0.0,
				"header_save_time" : 0.0,
				"header_scale_time" : 0.0
			}

		def accumulate_timing(new_keys, timing):
			if args.timings and "timing_data" in new_keys:
				data = new_keys["timing_data"]
				for key in data.keys():
					timing[key] += data[key]
				new_keys.pop("timing_data")

		with Progress("[progress.description]{task.description}", BarColumn(), "[progress.percentage]{task.percentage:>3.0f}%", TimeElapsedColumn(), console=console) as progress:
			task = progress.add_task("Creating {:d} {}".format(image_count, pluralize("image", image_count)), total=image_count, start=True)

			futures = []
			for ref_index, image_ref in enumerate(final_image_refs):
				compact_ref = { key: image_ref[key] for key in image_keys if key in image_ref }

				file_name = image_ref["file_name"]
				header_info = None
				if len(page_headers) > 0:
					header_info = next((header for header in page_headers if header[0] and header[0]["file_name"] == file_name), None)

				if args.single_thread:
					result, error_msg, new_keys, index = save_versions(compact_ref, ref_index, version_data, header_info)
					if new_keys:
						if args.timings:
							accumulate_timing(new_keys, image_timing)
						image_ref |= new_keys
					if result < 0:
						console.print(error_color + "Image Save Error: " + error_message_color + error_msg)
					
					progress.update(task, advance=1)
				else:
					futures.append(executor.submit(save_versions, compact_ref, ref_index, version_data, header_info))

			if len(futures)>0:
				for future in concurrent.futures.as_completed(futures, timeout=None):
					if future.exception():
						console.print(error_color + "Image scaling exception: " + error_message_color + future.exception())
					result, error_msg, new_keys, ref_index = future.result()
					if new_keys:
						if args.timings:
							accumulate_timing(new_keys, image_timing)
						final_image_refs[ref_index] |= new_keys
					if result < 0:
						console.print(error_color + "Image Save Error: " + error_message_color + error_msg)
					progress.update(task, advance=1)

	image_process_time = time.time() - image_process_start
	html_generate_start = time.time()
	
	copyright_html = html.escape("©" + str(args.year) + " RickAndRandy.com")

	# save detail html files
	page_count = len(pages)
	detail_count = len(final_image_refs)
	if detail_count>0:
		with Progress("[progress.description]{task.description}", BarColumn(), "[progress.percentage]{task.percentage:>3.0f}%", console=console) as progress:
			task = progress.add_task("Creating {:d} detail {}".format(detail_count, pluralize("page", detail_count)), total=detail_count, start=True)
			with open(os.path.join(script_path, "detail.html"), "r") as file:
				detail_lines = file.readlines()
			with open(os.path.join(script_path, "movie.html"), "r") as file:
				movie_lines = file.readlines()

			print_now("[{}]{}".format(" "*detail_count, "\b"*(detail_count+1)))
			
			for detail_number, image_ref in enumerate(final_image_refs, 1):
				detail_path = os.path.join(destination_folder, detail_url(image_ref["picture_num"]))
				did_save = False
				if overwrite_pages or not os.path.isfile(detail_path):
					if "is_movie" in image_ref:
						new_detail_lines = movie_lines.copy()
					else:
						new_detail_lines = detail_lines.copy()
						
					page_title = journal_title + " - " + (image_ref["caption"] if "caption" in image_ref else image_ref["file_name"])
					
					replace_key(new_detail_lines, "_PageTitle_", html.escape(page_title))
					if "picture_name" in image_ref:
						replace_key(new_detail_lines, "_ImageURL_", image_ref["picture_name"])
					replace_key(new_detail_lines, "_ImageWidth_", str(image_ref["width@1x"]))
					replace_key(new_detail_lines, "_ImageHeight_", str(image_ref["height@1x"]))
				
					replace_key(new_detail_lines, "_IndexPageURL_", index_url(image_ref["index_page_num"], for_html=False))
					
					replace_key(new_detail_lines, "_PageNumber_", str(detail_number))
					replace_key(new_detail_lines, "_PreviousPageNumber_", str(detail_number-1))
					replace_key(new_detail_lines, "_NextPageNumber_", str(detail_number+ 1))
					
					replace_key(new_detail_lines, "_CurrentPageURL_", detail_url(detail_number))
					replace_key(new_detail_lines, "_PreviousPageURL_", detail_url(detail_number-1))
					replace_key(new_detail_lines, "_NextPageURL_", detail_url(detail_number+1))
				
					exif_text = image_ref["exif"]
					if "caption" in image_ref:
						exif_text += "<br>{}".format(image_ref["caption"])
					replace_key(new_detail_lines, "_EXIF_", exif_text)
				
					replace_key(new_detail_lines, "_Copyright_", copyright_html)
					
					if detail_number == 1:
						remove_lines_with_key(new_detail_lines, "removeonfirst")
					if detail_number == detail_count:
						remove_lines_with_key(new_detail_lines, "removeonlast")
					
					remove_tags(new_detail_lines, "rkid", "removeonfirst", "removeonlast")
				
					try:
						with open(detail_path, "w") as detail_file:
							detail_file.writelines(new_detail_lines)
							progress.update(task, advance=1)
							did_save = True
							
					except OSError as e:
						console.print(error_color + "Error saving: " + error_item_color + detail_path, " , " + error_message_color + e)
	
	# write the index html pages
	if page_count>0:
		with open(os.path.join(script_path, "index.html"), "r") as file:
			index_lines = file.readlines()
			
		replace_key(index_lines, "_PageWidth_", str(page_width))
		replace_key(index_lines, "_NavWidth_", str(nav_width))
		replace_key(index_lines, "_ThumbSize_", str(thumb_size))
		replace_key(index_lines, "_HeaderHeight_", str(header_height))
			
		nav_index, nav_lines = extract_section(index_lines, "nav", "endnav")
		photo_index, photo_lines = extract_section(index_lines, "picblock", "endpicblock")
		title_index, title_line = extract_section(index_lines, "title1item")
		title_index2, title_line2 = extract_section(index_lines, "title2item")
		text_index, text_line = extract_section(index_lines, "journaltext")
		image_index, image_line = extract_section(index_lines, "imageitem")
		
		with Progress("[progress.description]{task.description}", BarColumn(), "[progress.percentage]{task.percentage:>3.0f}%", console=console) as progress:
			task = progress.add_task("Creating {:d} index {}".format(page_count, pluralize("page", page_count)), total=page_count)

			for page_index, page in enumerate(pages, 1):
				new_index_lines = index_lines.copy()
				
				page_title = journal_title
				if page_count > 1:
					page_title = page_title + " - " + page_names[page_index-1]
				
				replace_key(new_index_lines, "_PageTitle_", html.escape(page_title))
				replace_key(new_index_lines, "_SiteHeading_", html.escape(journal_title))
				
				if page_count == 1:
					extract_section(new_index_lines, "prevnext", "endprevnext")
				else:
					remove_tags(new_index_lines, "prevnext", "endprevnext")

					next_url = index_url(page_index+1)
					prev_url = index_url(page_index-1)

					if prev_url:
						replace_key(new_index_lines, "_PreviousPageURL_", prev_url)
					else:
						remove_lines_with_key(new_index_lines, "_PreviousPageURL_")

					if next_url:
						replace_key(new_index_lines, "_NextPageURL_", next_url)
					else:
						remove_lines_with_key(new_index_lines, "_NextPageURL_")

				replace_key(new_index_lines, "_Copyright_", copyright_html)
			
				new_lines = []		
				for entry in page["Entries"]:
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
						new_image_line = new_image_line.replace("_Height_", str(dest_width * height // width))
						new_lines.append(new_image_line)
					elif "Photos" in entry:
						new_lines.extend(make_photo_block(photo_lines.copy(), entry["Photos"]))
						
				insert_array_into_array(new_lines, new_index_lines, text_index)
					
				if page_count > 1:
					insert_array_into_array(make_nav_bar(nav_lines.copy(), page_index), new_index_lines, nav_index)
			
				if page_headers[page_index-1][0]:
					replace_key(new_index_lines, "_HeaderImageURL_", header_image_url(page_index))
				else:
					remove_lines_with_key(new_index_lines, "_HeaderImageURL_")
			
				remove_tags(new_index_lines, "rkid", "removeonfirst", "removeonlast")
			
				did_save = False
				output_path = os.path.join(destination_folder, index_url(page_index, for_html=False))
				if overwrite_pages or not os.path.isfile(output_path):
					try:
						with open(output_path, "w") as file:
							file.writelines(new_index_lines)
							progress.update(task, advance=1)
							did_save = True
			
					except OSError as e:
						console.print(error_color + "Error saving: " + error_item_color + output_path, " , " + error_message_color + e)
					
				page_index += 1
	
	html_generate_time = time.time() - html_generate_start
	total_time = time.time() - start_time
	
	if args.timings:
		console.print()
		console.print("Timing Summary")
		format_str = "  {:<18} {:6.3f}s"
		console.print(format_str.format("File scanning:", file_scan_time))
		if photo_list_time >= 0.0005: console.print(format_str.format("Enumerate files:", photo_list_time))	
		if journal_scan_time >= 0.0005: console.print(format_str.format("Journal scanning: ", journal_scan_time))
		if image_process_time >= 0.0005: console.print(format_str.format("Image Processing:", image_process_time))
		if image_timing:
			display_names = { 
				"load_time" : "  Image load time:",
				"open_time" : "  Image open time:",
				"save_time" : "  Image save time:",
				"scale_time" : "  Image scaling time:",
				"header_save_time" : "  Header save time",
				"header_scale_time" : "  Header scale time"
			}
			for key in image_timing.keys():
				cur_time = image_timing[key]
				if cur_time >= 0.0005:
					console.print(format_str.format(display_names[key], cur_time))
		if html_generate_time >= 0.0005: console.print(format_str.format("HTML Generation:", html_generate_time))
		console.print(format_str.format("Total Time:", total_time))

	if args.no_cache:
		console.print(Panel.fit("[dark_orange]WARNING: Image caching is disabled in output files!"))

	if args.open_result:
		dest_url = "file://" + os.path.join(destination_folder, index_url(1, for_html=False))
		webbrowser.open(dest_url)

if __name__ == '__main__':
	if not args.single_thread:
		# executor = concurrent.futures.ThreadPoolExecutor()
		executor = concurrent.futures.ProcessPoolExecutor()

	if args.make_template:
		start_date = None
		end_date = None
		dates = args.make_template.split(",")

		if len(dates) == 2:
			start_date = date_from_string(dates[0])
			end_date = date_from_string(dates[1])
		
		if start_date and end_date:
			day_delta = timedelta(hours = 24)

			print("[Site]JournalName")
			print("[Album]AlbumName")
			print("[Year]"+args.year)
			print("[Value=thumb_size]220")
			print("[Value=header_height]280")
			print()
			print("[Page=HeaderImage.ext,offset]PageName")
			print()
			print("[Heading]Movies")
			print("[Movie=ThumbImage.ext]Caption,XXX.m4v,(540,30H),(1080,30H),(360,30H),(2160,30H)")
			print()
			while start_date <= end_date:
				print(start_date.strftime("[Heading=%Y-%m-%d]%A - %B %-d, %Y	Location"))
				print()
				start_date = start_date + day_delta
			print()
			print("[Epilog=HeaderImage.ext,offset]")
		else:
			parser.error("Template creation requires start date and end date: YYYY-MM-DD,YYYY-MM-DD")
	else:
		console.print(Panel("[green]Begin JournalBuilder"))
		main()
