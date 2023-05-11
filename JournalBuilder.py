#!python

# pip install --upgrade pip
# pip install cryptography
# pip install pillow_heif
# pip install rich
# pip install exifread
# pip install Pillow
# -- pip install osxphotos ; no longer needed

# import cProfile as profile
# import pstats

import sys, os, time, shutil
import argparse
from datetime import datetime, timedelta, timezone
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener, HeifImageFile
import exifread
import concurrent.futures
from rich.console import Console
from rich.progress import Progress, BarColumn, TimeElapsedColumn, Task
from rich.text import Text
from rich.padding import Padding
from rich.theme import Theme
from rich.panel import Panel
import html
import webbrowser
import math

parser = argparse.ArgumentParser(description='Generate a web journal')

parser.add_argument("folder", metavar='dest_folder', help="Destination folder", type=str, nargs="?")

parser.add_argument("-g", "--guide", dest="documentation", help="Show user guide", action="store_true")
parser.add_argument("-c", "--clean", dest="clean", help="Remove all existing output files", action="store_true")
parser.add_argument("-t", "--timing", dest="timings", help="Print timing information", action="store_true")
parser.add_argument("-s", "--single", dest="single_thread", help="Run all tasks on main thread", action="store_true")
parser.add_argument("-nc", "--nocache", dest="no_cache", help="Prevent caching of images and links (for debugging)", action="store_true")
parser.add_argument("-x", "--express", dest="express", help="Express mode - one file per image", action="store_true")
parser.add_argument("-xx", "--extraexpress", dest="extraexpress", help="Extra Express mode - one file per image, only generate thumbnails", action="store_true")
parser.add_argument("-o", "--open", dest="open_result", help="Open output journal in browser", action="store_true")

group = parser.add_argument_group("album settings")
group.add_argument("-db", dest="data_base", help="Path to Photos library (default: system library)", type=str, default=None)
group.add_argument("-a", dest="album_name", help="Source album name", type=str, default=None)
group.add_argument("-d", "--date", dest="date_sort", help="Show images in chronological order (default: album order)", action="store_true")
group.add_argument("-f", "--favorite", dest="favorites", help="Include only favorite images", action="store_true")

group = parser.add_argument_group("ownership")
group.add_argument("-copy", "--copyright", dest="copyright", help="Page copyright text.", type=str, default="RickAndRandy.com")
group.add_argument("-desc", "--metadesc", dest="metadesc", help="Text for the description meta tag.", type=str, default="RickAndRandy.com")

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
group.add_argument("-ds", "--dont_split", dest="dont_split", help="Don't split photo blocks with multiple text paragraphs", action="store_true")
group.add_argument("-fc", dest="folder_count", help="Maximum number of photo folders to create.", type=int, default=0)
group.add_argument("-q", dest="jpeg_quality", help="JPEG quality level (default: high)", type=str, choices=["low", "medium", "high", "very_high", "maximum"], default="high")
group.add_argument("-ljs", "--local_javascript", dest="local_js", help="Use local javascipt folder - default is ../../", action="store_true")
group.add_argument("-ti", "--top_index", dest="top_index", help="Generate a top level index page, photo captions are paths to sub-journals", action="store_true")

group = parser.add_argument_group("template creation")
group.add_argument("-mt", "--maketemplate", dest="make_template", help="Template start and end dates: YYYY-MM-DD,YYYY-MM-DD", type=str, default=None)

group = parser.add_argument_group("debugging")
subgroup = group.add_mutually_exclusive_group()
subgroup.add_argument("-dc", "--datecaption", dest="dates_as_captions", help="Use dates as thumbnail captions", action="store_true")
subgroup.add_argument("-ac", "--aspectcaption", dest="aspect_as_captions", help="Use aspect ratios as thumbnail captions", action="store_true")

args = parser.parse_args()

script_path = os.path.abspath(os.path.dirname(sys.argv[0]))

theme = Theme({
			"progress.percentage": "white",
			"progress.remaining": "green",
			"progress.elapsed": "cyan",
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

prog_description = "[progress.description]{task.description}"
prog_percentage = "[progress.percentage]{task.percentage:>3.0f}% "

console = Console(theme=theme)

if args.documentation:
	with open(os.path.join(script_path, "journal.md"), "r") as file:
		console.print(file.read(), end="")
	quit()

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

photokit_script_path = "PhotoList"

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

register_heif_opener(thumbnails=False)

def print_now(str):
	console.print(str, end="")

def print_error(*args, dest_console=console):
	message = args[0] if len(args) >= 1 else None
	item = args[1] if len(args) >= 2 else None
	error_message = args[2] if len(args) >= 3 else None

	if item and not isinstance(item, str):
		item = str(item)
	if error_message and not isinstance(error_message, str):
		error_message = str(error_message)

	error_color = "[bold red]"
	error_item_color = "[magenta]"
	error_message_color = "[yellow]"

	parts = []
	if message:
		parts.extend([error_color, message])
	if item:
		parts.extend([error_item_color, item])
	if error_message:
		if len(parts)>0:
			parts.extend([error_color, " - "]) 
		parts.extend([error_message_color, error_message]) 

	dest_console.print("".join(parts))

def open_image_file(file_ref):
	image = None

	try:
		image = Image.open(file_ref)
	except:
		pass

	return image

def load_image(image):
	if isinstance(image, HeifImageFile):
		image.load()
	else:
		image = ImageOps.exif_transpose(image)
	
	return image

def size_of_image_file(file_ref):
	image_size = None

	try:
		image = Image.open(file_ref)
		image = load_image(image)
		image_size = image.size
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
	
def save_versions(image_ref, ref_index, version_data, header_info, image_folders):
	def save_image(image, path, profile):
		with open(path, "wb") as file:
			image.save(file, "JPEG", quality=args.jpeg_quality, icc_profile=profile)

	def save_scaled(image, size, path, sampling, profile):
		start_time = time.time()
		scaled_image = image.resize(size, resample=sampling)
		scaled_time = time.time()
		save_image(scaled_image, path, profile)
		saved_time = time.time()
		return (scaled_image, saved_time-scaled_time, scaled_time-start_time)

	def save_scaled_header(image, size, offset, path, sampling, profile):
		src_slice_height = int(image.size[0] * size[1] / size[0])
		src_top = int((image.size[1]-src_slice_height) * offset / 100)
		start_time = time.time()
		cropped_image = image.resize(size, box=(0, src_top, image.size[0], src_top+src_slice_height), resample=sampling)
		scaled_time = time.time()
		save_image(cropped_image, path, profile)
		saved_time = time.time()
		return (saved_time-scaled_time, scaled_time-start_time)

	do_timing = version_data["timings"]
	sampling = version_data["resample"]
	result = 0
	error_msg = ""
	timing_data = None
	new_keys = None

	if do_timing:
		timing_data = {}
		start_time = time.time()
	# print("Image name: " + image_ref["file_name"])
	image = open_image_file(image_ref["file_path"])
	if do_timing:
		open_end_time = time.time()
		timing_data["open_time"] = open_end_time - start_time
	image = load_image(image)
	if image.mode != "RGB":
		image = image.convert("RGB")
	if do_timing:
		timing_data["load_time"] = time.time() - open_end_time
		timing_data["save_time"] = 0.0
		timing_data["scale_time"] = 0.0

	if image:
		image_size = image.size
		width, height = scaled_size(image_size, 1024)
		profile = image.info.get("icc_profile")

		new_keys = {}
		new_keys["width@1x"] = width
		new_keys["height@1x"] = height
		new_keys["image_size"] = image_size
		if do_timing:
			new_keys["timing_data"] = timing_data

		large_images = [None, None, None]

		for folder_name, name_root, size, index in image_folders:
			output_path = os.path.join(version_data["destination_folder"], folder_name, picture_url(name_root, image_ref["picture_num"], False))

			try:
				if index!=-1 and large_images[index]:
					source_image = large_images[index]
				else:
					source_image = image
				new_size = scaled_size(image_size, size)
				scaled_image, save_time, scale_time = save_scaled(source_image, new_size, output_path, sampling, profile)
				if do_timing:
					timing_data["save_time"] += save_time
					timing_data["scale_time"] += scale_time
				if index!=-1:
					large_images[index] = scaled_image
				result = result + 1 if result>=0 else result
			except OSError as e:
				result = -1
				error_msg = "Error saving: " + output_path + ", " + str(e)

			if result >= 0 and header_info:
				header_size = (version_data["page_width"], version_data["header_height"])
				for scale, suffix, index in [ (1, "", 0), (2, "@2x", 1), (3, "@3x", 2)]:
					output_path = os.path.join(version_data["destination_folder"], header_image_url(header_info[2], suffix=suffix, for_html=False))
					try:
						if large_images[index]:
							source_image = large_images[index]
						else:
							source_image = image
						save_time, scale_time = save_scaled_header(source_image, (header_size[0] * scale, header_size[1] * scale), header_info[1], output_path, sampling, profile)
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
	
def get_next_line(srcLines):
	tag = None
	subtag = ""
	text = ""
	line = srcLines.pop(0).strip()
	while len(srcLines) > 0 and len(line) == 0:
		line = srcLines.pop(0).strip()
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
		while text.endswith("<br>") and len(srcLines)>0 and not srcLines[0].startswith("["):
			text = text + '\n' + srcLines.pop(0).strip()
	
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
		print_error("Failed to parse date: ", None, date_string)
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
	return "{:d} {}{}".format(count, str, "s" if count!=1 else " " if pad else "")

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
	page_count = len(page_names)
	if index_num <= 0:
		return previous_external_url if previous_external_url else None
	elif index_num == 1:
		return "{}.html{}".format(index_root, cache_suffix(for_html))
	elif index_num == page_count:
		return "{}last.html{}".format(index_root, cache_suffix(for_html))
	elif index_num >= page_count+1:
		return next_external_url if next_external_url else None
	else:
		return "{}{}.html{}".format(index_root, index_num, cache_suffix(for_html))

def detail_url(picture_number):
	return("{}{}.html".format(detail_root, picture_number))

def top_link_url(caption):
	if "[" in caption and "]" in caption:
		url = caption[caption.index("[")+1:caption.index("]")].strip()
	else:
		url = caption.strip()
	url = url.replace(" ", "_")
	return("{}/index.html".format(url))

def top_link_name(caption):
	if "[" in caption and "]" in caption:
		name = caption[:caption.index("[")].strip()
	else:
		name = caption.strip()
	return(name)

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
	dest[index:index] = src
	return index + len(src)

def make_photo_block(photo_lines, image_refs):
	image_index, image_lines = extract_section(photo_lines, "imagediv", "endimagediv")

	if not (args.express or args.extraexpress):
		remove_tag(image_lines, "singlethumb")

	for image_ref in image_refs:
		new_image_lines = image_lines.copy()
		new_size = scaled_size(image_ref["image_size"], thumb_size)
		
		picture_num = image_ref["picture_num"]
		if not args.top_index:
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
			if args.top_index:
				replace_key(new_image_lines, "_DetailPageURL_", top_link_url(caption))
				replace_key(new_image_lines, "_metavalue_", top_link_name(caption))
			else:
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
			dest_list.append({"photos": new_refs})

def add_images_before_ref_name(refs, before_ref_name, dest_list, index_page_num):
	if len(refs):
		new_refs = []
		while len(refs) > 0 and refs[0]["file_name"] != before_ref_name:
			ref = refs.pop(0)
			new_refs.append(ref)

		if len(new_refs) > 0:
			for ref in new_refs:
				ref["index_page_num"] = index_page_num
			dest_list.append({"photos": new_refs})

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
		return True

	def move_photo(src_index, dest_index):
		src_photo = photos.pop(src_index)
		if dest_index % 4 == 0:
			next_index = find_item(not src_photo["tall"], dest_index // 4)
			insert_photos(dest_index-1, photos.pop(next_index), src_photo)
		else:
			insert_photos(dest_index-1, src_photo)
		return True

	def double_move(src_index, dest_index, find1, find2):
		src_line_index = src_index // 4
		src_index2 = find_item(find1, src_line_index, src_index % 4+1)
		dest_index2 = find_item(find2, src_line_index+1, dest_index % 4+1)

		if src_index2!=-1 and dest_index2!=-1:
			dest2 = photos.pop(dest_index2)
			dest1 = photos.pop(dest_index)
			src2 = photos.pop(src_index2)
			src1 = photos.pop(src_index)
			insert_photos(src_line_index*4+2, dest1, dest2, src1, src2)
			return True
		else:
			return False

	def double_move1(src_index, dest_index):
		double_move(src_index, dest_index, True, False)

	def double_move2(src_index, dest_index):
		double_move(src_index, dest_index, False, True)

	for page in pages:
		for entry in page["entries"]:
			if "photos" in entry:
				photos = entry["photos"]
				line_count = (len(photos)+3) // 4

				tall_counts = []
				tall_count = 0
				for index, photo in enumerate(photos):
					photo["block_index"] = index
					tall_count += photo["tall"]
					if index%4 == 3 or index == len(photos)-1:
						tall_counts.append(tall_count)
						tall_count = 0

				moves1 = { 	(1,3):(consolidate, True, False, -1), (3,1):(consolidate, False, True, 1),
							(1,1): (move_photo, True, True, -1), (3,3): (move_photo, False, False, 1),
							(2,2):(double_move1, True, False, -2) }
				moves2 = { 	(2,2):(double_move2, False, True, 2) }
				move_list = [ moves1, moves2 ]

				moved_count = 1
				while moved_count > 0:
					moved_count = 0

					for line_index in range(0, line_count-1):
						counts = (tall_counts[line_index], tall_counts[line_index+1])
						for moves in move_list:
							if counts in moves:
								func, src_find, dest_find, src_change = moves[counts]
								src_index, dest_index = find_wide_tall(src_find, dest_find, line_index)
								if func(src_index, dest_index):
									tall_counts[line_index] += src_change
									tall_counts[line_index+1] -= src_change
									moved_count += 1

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
							moved_count += 1

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
	albumFavoritesOnly = True

	while len(journal) > 0:
		tag, subtag, text = get_next_line(journal)
		match tag:
			case("date"):
				date_overrides[subtag] = text
			case("value"):
				if len(subtag) > 0 and len(text) > 0:
					match subtag:
						case("thumb_size"):
							thumb_size = int(text)
						case("header_height"):
							header_height = int(text)
						case("image_size"):
							base_image_size = int(text)
						case("tall_aspect"):
							tall_aspect = float(text)
			case("previous"):
				previous_external_url = text
			case("next"):
				next_external_url = text
			case ("album") if not args.album_name:
				args.album_name = text
				args.favorites = albumFavoritesOnly
				args.open_result = True
				args.clean = True
				args.reorder_thumbs = True
			case("year"):
				args.year = int(text)
			case("test"):
				args.no_cache = True
			case("flags"):
				flag_parts = text.split(",")
				if 'all' in flag_parts:
					albumFavoritesOnly = False # catch case that [Flags] is before [Album]
					args.favorites = False
				if 'datesort' in flag_parts:
					args.date_sort = True
				if 'topindex' in flag_parts:
					args.top_index = True

def getFilesPhotos(file_paths):
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
					file_paths.append((photo.original_filename, photo_path, photo.title, photo.date, photo.width, photo.height))
				else:
					print_error("Warning: File missing for ", None, photo.filename)
	else:
		parser.error("Photos album not found: " + args.album_name)

def getFilesPhotoKit(file_paths):
	import urllib.parse
	import subprocess

	def stringToParts(str, file_paths):
		parts = str.strip().split("\t")
		if len(parts) == 7:
			original_name = parts[0]
			file_path = urllib.parse.unquote(parts[1].removeprefix("file://"))
			file_date = date_from_string(parts[2].removesuffix(" +0000"))
			photo_width = parts[3]
			photo_height = parts[4]
			title = parts[5]
			if title == "":
				title = None
			is_favorite = (parts[6] == "true")
			if not args.favorites or is_favorite:
				file_paths.append((original_name, file_path, title, file_date, photo_width, photo_height))

	run_path = os.path.join(script_path, photokit_script_path)
	temporaryImagePath = "/tmp/journalbuilder"
	if args.favorites:
		command = [run_path, args.album_name, '-p', temporaryImagePath, '-f']
	else:
		command = [run_path, args.album_name, '-p', temporaryImagePath]

	process = subprocess.Popen(command, universal_newlines=True, stdout=subprocess.PIPE)
	count_str = process.stdout.readline()
	num_files = int(count_str) if len(count_str)>0 else 0

	if num_files == 0:
		parser.error("Photos album not found: " + args.album_name)

	with Progress(prog_description, BarColumn(), prog_percentage, console=console) as progress:
		task = progress.add_task("Scanning album photos...", total=num_files)
		done = False
		while not done:
			output = process.stdout.readline()
			if output:
				stringToParts(output, file_paths)
				progress.update(task, advance=1)
			return_code = process.poll()
			if return_code is not None:
				for output in process.stdout.readlines():
					stringToParts(output, file_paths)
					progress.update(task, advance=1)
				done = True

def getFilesFolder(file_paths):
	images_folder_path = args.images_folder
	if not "/" in images_folder_path:
		images_folder_path = os.path.join(destination_folder, images_folder_path)
	if os.path.isdir(images_folder_path):
		for file_name in os.listdir(images_folder_path):
			file_path = os.path.join(images_folder_path, file_name)
			if not file_name.startswith('.') and os.path.isfile(file_path):
				file_paths.append((file_name, file_path, None, None, None, None, None))

def main():
	global console
	global page_width
	global nav_width
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

	if args.express or args.extraexpress:
		args.folder_count = 1

	if args.folder_count == 0:
		args.folder_count = 100

	# read the file list, get the file info
	photo_list_start = time.time()
	file_paths = []

	if args.album_name:
		getFilesPhotoKit(file_paths)
	else:
		getFilesFolder(file_paths)
			
	if len(file_paths) == 0:
		parser.error("No source photos found! Please specify an album name (-a) or an image folder (-i).")

	file_scan_start = time.time()
	photo_list_time = file_scan_start - photo_list_start

	folder_scales = [1, 2, 3, 4, 6, 8, 12]
	image_folder_count = 1

	def folder_count_for_size(size):
		for i, scale in enumerate(folder_scales, 1):
			if scale * base_image_size >= size:
				return i
		return len(folder_scales)

	print_now("Retrieving photo metadata...")
	for file_name, file_path, title, photo_date, photo_width, photo_height in file_paths:
		try:
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
					print_error("Warning: Using os date for ", file_name, photo_date)

				image_ref["date"] = photo_date
				image_ref["date_string"] = photo_date.strftime(date_format)

				if args.reorder_thumbs or args.aspect_as_captions:
					if photo_width and photo_height:
						image_size = (photo_width, photo_height)
					else:
						image_size = size_of_image_file(image_file)
					if image_size:
						aspect_ratio = float(image_size[0]) / float(image_size[1])
					else:
						aspect_ratio = 1.0
					image_ref["aspect"] = aspect_ratio
					image_ref["tall"] = aspect_ratio < tall_aspect

				if photo_width and photo_height:
					image_ref["current_size"] = (photo_width, photo_height)
					folder_count = folder_count_for_size(max(int(photo_width), int(photo_height)))
				else:
					folder_count = 3

				folder_count = min(args.folder_count, folder_count)
				image_ref["folder_count"] = folder_count
				image_folder_count = max(image_folder_count, folder_count)

				if not title and 'Image ImageDescription' in keys:
					title = tags['Image ImageDescription'].values

				if title and (title != "default") and not ("DCIM\\" in title) and not ("OLYMPUS DIGITAL CAMERA" in title):
					image_ref["caption"] = title
				
				exif_data = [file_name, image_ref["date_string"]]
				
				def format_shutter(speed):
					if speed <= 0.5:
						return "1/{:d}s".format(int(1.0 / speed))
					else:
						return "{:.1f}s".format(speed)

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
		except OSError as e:
			print("Error opening file:", file_path, file_name, e)
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

	image_columns = 4
	column_gap = 15
	page_width = thumb_size * image_columns + column_gap * (image_columns - 1)
	nav_inset = 15
	nav_width = page_width - 2 * nav_inset

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
			page = { "entries": entries }
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
					print_error("Warning: Header image not found for page: ", text, tag_parts[0])

			page_headers.append((header_ref, header_offset, index_page_num))
			page_names.append(text)
			pages.append(page)
		elif tag == "caption":
			caption_ref = next((image_ref for image_ref in all_image_refs if image_ref["file_name"] == subtag), None)
			if caption_ref:
				caption_ref["caption"] = text
			else:
				print_error("Warning: Image for caption not found: ", None, subtag)
		elif entries is not None:
			use_last = last_entries is not None and len(entries) == 0
			entries_to_use = last_entries if use_last else entries
			index_to_use = index_page_num-1 if use_last else index_page_num
			if tag == "heading" or tag == "timestamp":
				if "." in subtag:
					add_images_before_ref_name(unplaced_image_refs, subtag, entries_to_use, index_to_use)
				else:
					date = date_from_string(subtag)
					if date:
						add_images_before_date(unplaced_image_refs, date, entries_to_use, index_to_use)
				if tag == "heading":
					entries.append({ "heading": text })
			elif tag == "text":
				entries.append({ "text": text})
			elif tag == "image":
				tag_parts = subtag.split(",")
				if len(tag_parts)>=1:
					entry = { "image": tag_parts[0] }
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
					print_error("Warning: Invalid movie info: ", None, text)
	
	if len(pages) == 0 and args.album_name:
		index_page_num = 1
		name = args.journal_title if args.journal_title else args.album_name
		journal_title = name
		entries = []
		page = { "entries": entries }
		pages.append(page)
		page_headers.append((None, 0, index_page_num))
		page_names.append(name)

	if entries is not None:
		add_images_before_date(unplaced_image_refs, None, entries, index_page_num)
	
	# merge movie entries
	last_photos = None
	for page_index, page in enumerate(pages):
		first_photos = None
		entries = page["entries"]
		index = 0
		while index < len(entries):
			entry = entries[index]
			if "Movie" in entry:
				movie_list = [ entry["Movie"] ]
				if not first_photos:
					first_photos = movie_list
				entries[index] = { "photos": movie_list, "movielist" : True }
				while index < len(entries)-1 and "Movie" in entries[index+1]:
					next_movie = entries.pop(index+1)
					movie_list.append(next_movie["Movie"])
			elif "photos" in entry:
				if not first_photos:
					first_photos = entry["photos"]
				last_photos = entry["photos"]
			index += 1
		
		header_ref, header_offset, page_num = page_headers[page_index]
		if not header_ref:
			if first_photos and len(first_photos)>0:
				page_headers[page_index] = (first_photos[0], header_offset, page_num)
			if page_index == len(pages)-1:
				page_headers[page_index] = (last_photos[-1], header_offset, page_num)
	
	# re-order thumbnails slightly to minimize page height
	if args.reorder_thumbs:
		print_now("Rearranging photos...")
		rearrange(pages)
		console.print(" done.")

	# split any giant blocks of pics if we have multiple paragraphs above
	if not args.dont_split:
		for page_index, page in enumerate(pages):
			entries = page["entries"]
			index = 0
			textCount = 0
			while index < len(entries):
				entry = entries[index]
				if "photos" in entry and not "movielist" in entry:
					photoList = entry["photos"]
					photoRows = math.ceil(len(photoList) / image_columns)

					if textCount>1 and photoRows>1:
						photoRowsPerGap = int(photoRows/textCount)
						entries.pop(index)
						insertIndex = index - textCount + 1
						index -= 1

						for i in range(textCount):
							rowsThisBlock = photoRowsPerGap
							if len(photoList) > (textCount-i) * rowsThisBlock * image_columns:
								rowsThisBlock += 1
							lastIndex = rowsThisBlock * image_columns
							entries.insert(insertIndex, { "photos" : photoList[:lastIndex] })
							del photoList[:lastIndex]
							insertIndex += 2
							index += 1
					textCount = 0
				if "text" in entry:
					textCount += 1
				else:
					textCount = 0
				index += 1

	#build the image list
	final_image_refs = []
	for page in pages:
		for entry in page["entries"]:
			if "photos" in entry:
				final_image_refs.extend(entry["photos"])
	
	# set the target image numbers
	for image_index, image_ref in enumerate(final_image_refs, 1):
		image_ref["picture_num"] = str(image_index)
	
	# start output phase
	journal_scan_time = time.time() - journal_scan_start
	
	max_image_folders = [
					(picture_folder_root, picture_name_root, base_image_size, 0)
				]

	for index in range(1, image_folder_count):
		scale = folder_scales[index]
		max_image_folders.append((picture_folder_root + "@" + str(scale) + "x", picture_name_root, base_image_size*scale, index if index<3 else -1))
	
	thumb_folders = [
					(thumb_folder_root, thumb_name_root, thumb_size, 0),
					(thumb_folder_root + "@2x", thumb_name_root, thumb_size*2, 0),
					(thumb_folder_root + "@3x", thumb_name_root, thumb_size*3, 0)
				]

	if args.express or args.extraexpress:
		thumb_folders = thumb_folders[0:1]

	# clean existing output files
	if args.clean:
		print_now("Cleaning destination folder...")
		folders_removed = 0
		files_removed = 0
		for name in os.listdir(destination_folder):
			path = os.path.join(destination_folder, name)
			if name.startswith(thumb_folder_root) or name.startswith(picture_folder_root) or name=="assets" or name=="js":
				shutil.rmtree(path)
				folders_removed += 1
			elif name.startswith(thumb_name_root) or name.startswith(picture_name_root) or name.startswith(header_name_root) or name.startswith(index_root) or name.startswith(detail_root) or name=="movies.txt":
				os.remove(path)
				files_removed += 1
		if files_removed>0 or folders_removed>0:
			console.print(" removed {} and {}.".format(pluralize("folder", folders_removed), pluralize("file", files_removed)))
		else:
			console.print(" done.")

	folder_list = [ "assets" ]
	if args.local_js:
		folder_list.append("js")

	#copy assets folders
	for folder_name in folder_list:
		dest_assets_path = os.path.join(destination_folder, folder_name)
		if os.path.isdir(dest_assets_path):
			shutil.rmtree(dest_assets_path)
		if not os.path.isdir(dest_assets_path):
			print_now("Copying " + folder_name + " folder...")
			src_assets_path = os.path.join(script_path, folder_name)
			try:
				shutil.copytree(src_assets_path, dest_assets_path)
				console.print(" done.")
			except OSError as e:
				print_error("\nError copying: ", dest_assets_path, e)

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
			print_error("Error saving: ", movie_file_path, e)

	image_timing = None
	image_rate = 0

	image_count = len(final_image_refs)
	if image_count>0:
		# create image folders
		dest_folders = []
		if not (args.top_index or args.extraexpress):
			dest_folders.extend(max_image_folders)
		dest_folders.extend(thumb_folders)
		create_start = False
		for folder_name, _, _, index in dest_folders:
			dest_path = os.path.join(destination_folder, folder_name)
			if not os.path.isdir(dest_path):
				if not create_start:
					print_now("Creating folders")
					create_start = True
				print_now(".")
				os.mkdir(dest_path)
		if create_start:
			console.print(" done.")
		
		# resize images
		version_data = {
			"page_width" : page_width,
			"header_height" : header_height,
			"destination_folder" : destination_folder,
			"timings" : args.timings,
			"resample" : Image.Resampling.BICUBIC if args.express or args.extraexpress else Image.Resampling.LANCZOS
		}

		image_keys = ["file_path", "file_name", "picture_num"]

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

		prog_rate = "[{task.fields[color]}] ({task.fields[ips]:>5.1f} images per second)"

		class StyledElapsedColumn(TimeElapsedColumn):
			def render(self, task: "Task") -> Text:
				elapsed = task.finished_time if task.finished else task.elapsed
				if elapsed is None:
					return Text("--s", style="progress.elapsed")
				else:
					return Text("{:3.1f}s".format(elapsed), style="bright_cyan")

		with Progress(prog_description, BarColumn(), prog_percentage, StyledElapsedColumn(), prog_rate, console=console) as progress:
			task = progress.add_task("Creating {}".format(pluralize("image", image_count)), total=image_count, ips=0, color="conceal")
			futures = []
			image_process_start = time.time()
			completed_count = 0

			for ref_index, image_ref in enumerate(final_image_refs):
				compact_ref = { key: image_ref[key] for key in image_keys if key in image_ref }

				file_name = image_ref["file_name"]

				if not (args.top_index or args.extraexpress):
					image_folders = max_image_folders[0:image_ref["folder_count"]]
				else:
					image_folders = []
				image_folders.extend(thumb_folders)

				header_info = None
				if len(page_headers) > 0:
					header_info = next((header for header in page_headers if header[0] and header[0]["file_name"] == file_name), None)
					if header_info:
						header_info = (None, header_info[1], header_info[2])

				if args.single_thread:
					result, error_msg, new_keys, index = save_versions(compact_ref, ref_index, version_data, header_info, image_folders)
					if new_keys:
						if args.timings:
							accumulate_timing(new_keys, image_timing)
						image_ref |= new_keys
					if result < 0:
						print_error("Image Save Error: ", file_name, error_msg, dest_console=progress.console)
					else:
						completed_count += 1

					image_rate = completed_count / (time.time() - image_process_start)
					progress.update(task, advance=1, ips=image_rate, color="bright_green")
				else:
					futures.append(executor.submit(save_versions, compact_ref, ref_index, version_data, header_info, image_folders))

			index = 0
			if len(futures)>0:
				for future in concurrent.futures.as_completed(futures, timeout=None):
					if future.exception():
						print_error("Image scaling exception: ", final_image_refs[ref_index]["file_name"], future.exception(), dest_console=progress.console)
					result, error_msg, new_keys, ref_index = future.result()
					if new_keys:
						if args.timings:
							accumulate_timing(new_keys, image_timing)
						final_image_refs[ref_index] |= new_keys

					if result < 0:
						print_error("Image Save Error: ", final_image_refs[ref_index]["file_name"], error_msg, dest_console=progress.console)
					else:
						completed_count += 1

					image_rate = completed_count / (time.time() - image_process_start)
					progress.update(task, advance=1, ips=image_rate, color="bright_green")

			progress.update(task, refresh=True, color="conceal")

	image_process_time = time.time() - image_process_start
	html_generate_start = time.time()
	
	copyright_html = html.escape("©" + str(args.year) + " " + args.copyright)

	# save detail html files
	page_count = len(pages)
	detail_count = len(final_image_refs)
	if detail_count>0 and not args.top_index:
		with Progress(prog_description, BarColumn(), prog_percentage, console=console) as progress:
			task = progress.add_task("Creating {}".format(pluralize("detail page", detail_count)), total=detail_count)
			with open(os.path.join(script_path, "detail.html"), "r") as file:
				detail_lines = file.readlines()
			with open(os.path.join(script_path, "movie.html"), "r") as file:
				movie_lines = file.readlines()

			for detail_number, image_ref in enumerate(final_image_refs, 1):
				picture_num = image_ref["picture_num"]
				detail_path = os.path.join(destination_folder, detail_url(picture_num))

				if "is_movie" in image_ref:
					new_detail_lines = movie_lines.copy()
				else:
					new_detail_lines = detail_lines.copy()
					
				page_title = journal_title + " - " + (image_ref["caption"] if "caption" in image_ref else image_ref["file_name"])
				
				replace_key(new_detail_lines, "_PageTitle_", html.escape(page_title))
				replace_key(new_detail_lines, "_MetaDesc_", html.escape(args.metadesc))
				replace_key(new_detail_lines, "_ImageURL_", picture_url(picture_name_root, picture_num))
				replace_key(new_detail_lines, "_ImageWidth_", str(image_ref["width@1x"]))
				replace_key(new_detail_lines, "_ImageHeight_", str(image_ref["height@1x"]))
			
				replace_key(new_detail_lines, "_IndexPageURL_", index_url(image_ref["index_page_num"], for_html=False))
				
				replace_key(new_detail_lines, "_PageNumber_", str(detail_number))
				replace_key(new_detail_lines, "_PreviousPageNumber_", str(detail_number-1))
				replace_key(new_detail_lines, "_NextPageNumber_", str(detail_number+ 1))
				
				replace_key(new_detail_lines, "_CurrentPageURL_", detail_url(detail_number))
				replace_key(new_detail_lines, "_PreviousPageURL_", detail_url(detail_number-1))
				replace_key(new_detail_lines, "_NextPageURL_", detail_url(detail_number+1))

				replace_key(new_detail_lines, "_SourceCount_", str(image_ref["folder_count"]))
			
				exif_text = image_ref["exif"]
				if "caption" in image_ref:
					exif_text += "<br>{}".format(image_ref["caption"])
				replace_key(new_detail_lines, "_EXIF_", exif_text)
			
				replace_key(new_detail_lines, "_Copyright_", copyright_html)
				
				if detail_number == 1:
					remove_lines_with_key(new_detail_lines, "removeonfirst")
				if detail_number == detail_count:
					remove_lines_with_key(new_detail_lines, "removeonlast")
					replace_key(new_detail_lines, 'nextsizes="_NextSourceCount_"', "")
				else:
					replace_key(new_detail_lines, "_NextSourceCount_", str(final_image_refs[detail_number]["folder_count"]))
				
				remove_tags(new_detail_lines, "rkid", "removeonfirst", "removeonlast")

				if args.local_js:
					replace_key(new_detail_lines, "../../", "js/")

				try:
					with open(detail_path, "w") as detail_file:
						detail_file.writelines(new_detail_lines)
						progress.update(task, advance=1)
						
				except OSError as e:
					print_error("Error saving: ", detail_path, e, dest_console=progress.console)
	
	# write the index html pages
	if page_count>0:
		with open(os.path.join(script_path, "index.html"), "r") as file:
			index_lines = file.readlines()
			
		replace_key(index_lines, "_PageWidth_", str(page_width))
		replace_key(index_lines, "_NavWidth_", str(nav_width))
		replace_key(index_lines, "_ThumbSize_", str(thumb_size))
		replace_key(index_lines, "_HeaderHeight_", str(header_height))
			
		nav_index, nav_lines = extract_section(index_lines, "nav", "endnav")
		_, photo_lines = extract_section(index_lines, "picblock", "endpicblock")
		_, title_line = extract_section(index_lines, "title1item")
		_, title_line2 = extract_section(index_lines, "title2item")
		text_index, text_line = extract_section(index_lines, "journaltext")
		image_index, image_line = extract_section(index_lines, "imageitem")
		
		with Progress(prog_description, BarColumn(), prog_percentage, console=console) as progress:
			task = progress.add_task("Creating {}".format(pluralize("index page", page_count)), total=page_count)

			for page_index, page in enumerate(pages, 1):
				new_index_lines = index_lines.copy()
				
				page_title = journal_title
				if page_count > 1:
					page_title = page_title + " - " + page_names[page_index-1]
				
				replace_key(new_index_lines, "_PageTitle_", html.escape(page_title))
				replace_key(new_index_lines, "_MetaDesc_", html.escape(args.metadesc))
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
				for entry in page["entries"]:
					if "heading" in entry:
						heading_parts = entry["heading"].split("\t")
						if len(heading_parts)>0:
							new_title_line = title_line if len(heading_parts)==1 else title_line2
							new_title_line = new_title_line.replace("_Text_", heading_parts[0])
							if len(heading_parts)>1:
								new_title_line = new_title_line.replace("_Text2_", heading_parts[1])
							new_lines.append(new_title_line)
					elif "text" in entry:
						new_lines.append(text_line.replace("_Text_", entry["text"]))
					elif "image" in entry:
						image_filename = entry["image"]
						try:
							width, height=size_of_image_file(os.path.join(destination_folder, image_filename))
							new_image_line = image_line.replace("_ImageURL_", image_filename)
							dest_width = entry["width"] if "width" in entry else page_width
							new_image_line = new_image_line.replace("_Width_", str(dest_width))
							new_image_line = new_image_line.replace("_Height_", str(dest_width * height // width))
							new_lines.append(new_image_line)
						except OSError as e:
							print_error("Error with static photo: ", image_filename, e, dest_console=progress.console)
					elif "photos" in entry:
						new_lines.extend(make_photo_block(photo_lines.copy(), entry["photos"]))
						
				insert_array_into_array(new_lines, new_index_lines, text_index)
					
				if page_count > 1:
					insert_array_into_array(make_nav_bar(nav_lines.copy(), page_index), new_index_lines, nav_index)
			
				if page_headers[page_index-1][0]:
					replace_key(new_index_lines, "_HeaderImageURL_", header_image_url(page_index))
				else:
					remove_lines_with_key(new_index_lines, "_HeaderImageURL_")
			
				remove_tags(new_index_lines, "rkid", "removeonfirst", "removeonlast")

				if args.local_js:
					replace_key(new_index_lines, "../../", "js/")

				output_path = os.path.join(destination_folder, index_url(page_index, for_html=False))
				try:
					with open(output_path, "w") as file:
						file.writelines(new_index_lines)
						progress.update(task, advance=1)
		
				except OSError as e:
					print_error("Error saving: ", output_path, e, dest_console=progress.console)
					
				page_index += 1
	
	html_generate_time = time.time() - html_generate_start
	total_time = time.time() - start_time
	
	if args.timings:
		timing_stats = []

		def add_timing_stat(label, time, format="{:<22} [cyan]{:7.3f}s[/]"):
			if (time >= 0.0005):
				timing_stats.append(format.format(label, time))

		add_timing_stat("Enumerate files:", photo_list_time)
		add_timing_stat("Metadata scan:", file_scan_time)
		add_timing_stat("Journal scanning: ", journal_scan_time)
		add_timing_stat("Image Processing:", image_process_time)
		if image_timing:
			display_names = [ 
				("open_time", "Image open:"),
				("load_time", "Image load:"),
				("scale_time", "Image scaling:"),
				("save_time", "Image save:"),
				("header_save_time", "Header save:"),
				("header_scale_time", "Header scale:")
			]
			cumulative_time = 0
			for key, title in display_names:
				add_timing_stat("  " + title, image_timing[key])
				cumulative_time += image_timing[key]
			if not args.single_thread:
				add_timing_stat("  Proc time ({:.1f}x):".format(cumulative_time / image_process_time), cumulative_time)
		add_timing_stat("HTML Generation:", html_generate_time)
		add_timing_stat("Total Time:", total_time)
		add_timing_stat("Image Rate:", image_rate, format="{:<22}  [bright_green]{:5.1f} ips[/]")

		console.print()
		console.print(Panel.fit("\n".join(timing_stats), title="Timing Summary"))

	if args.no_cache:
		console.print()
		console.print(Panel.fit(Padding("[dark_orange]WARNING: Image caching is disabled in output files!", (0,4))))

	if args.open_result:
		dest_url = "file://" + os.path.join(destination_folder, index_url(1, for_html=False))
		webbrowser.open(dest_url)

if __name__ == '__main__':
	if args.make_template:
		start_date = None
		end_date = None
		dates = args.make_template.split(",")

		if len(dates) >= 1:
			start_date = date_from_string(dates[0])
			if len(dates) >= 2:
				end_date = date_from_string(dates[1])
			else:
				end_date = start_date
		
		if start_date and end_date:
			print("[Site]JournalName")
			print("[Album]AlbumName")
			print("[Year]"+str(args.year))
			print("[Value=thumb_size]220")
			print("[Value=header_height]280")
			print()
			print("[Page=HeaderImage.ext,offset]PageName")
			print()
			print("[Heading]Movies")
			print("[Movie=ThumbImage.ext]Caption,XXX.m4v,(540,60H),(1080,60H),(360,30H),(2160,60H)")
			print()

			while start_date <= end_date:
				print(start_date.strftime("[Heading=%Y-%m-%d]%A - %B %-d, %Y	Location"))
				print()
				start_date = start_date + timedelta(hours = 24)

			print()
			print("[Epilog=HeaderImage.ext,offset]")
		else:
			parser.error("Template creation requires start date and end date: YYYY-MM-DD,YYYY-MM-DD")
	else:
		if not args.single_thread:
			# executor = concurrent.futures.ThreadPoolExecutor()
			executor = concurrent.futures.ProcessPoolExecutor()

		console.print(Panel("[green]Begin JournalBuilder"))

		# prof = profile.Profile()
		# prof.enable()

		main()

		# prof.disable()

		# stats = pstats.Stats(prof).strip_dirs().sort_stats("tottime")
		# stats.print_stats(40)

		# import profile
		# profile.run('main()')
