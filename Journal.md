JournalBuilder requires a destination folder where all of the generated files will be placed
It should contain a file named journal.txt (override with the -j option) which describes the output journal
Source images come either from a folder named images (override with the -i option) in the output folder, or
from an album in the Photos library spcified with the -a option

Below is the layout for the journal.txt file
--------------------------------------------------------------------------------
[Site]Title                                         ; Site title
[Year]2022                                          ; Copyright year
[Value=thumb_size]190                               ; Thumbnail size
[Value=header_height]250                            ; Page header height
[Value=image_size]1024                              ; Large image size
[Value=tall_aspect]1.15                             ; Tall aspect ratio threshold
[Previous]previous.html                             ; URL of previous site
[Next]next.html                                     ; URL of next site

[Caption=filename.ext]Caption                       ; Define a caption for an image
[Date=filename.ext]2020-08-19 14:06:55              ; Override the date for an image

[Page=header.ext,percent]Title                      ; New page with header image and Title. Percent sets header slice offset
[Epilog=header.ext,percent]                         ; Special case of [Page] for last page, places remaining images on previous page

[Heading=2020-08-18 <opt HH:MM>]Left Text<opt \t>Right Text     ; Heading with optional date, places images before date above heading
[Heading=filename.ext]Left Text<opt \t>Right Text   ; Heading with optional date, places images before filename.ext above heading

[Timestamp=2020-08-18 <opt HH:MM>]                  ; Adds all photos before timestamp
[Timestamp=filename.ext]                            ; Adds all photos before filename.ext

[Movie=thumb_name.ext]caption,base_movie_name.ext,(height1,fps1),(height2,fps2),...   ; Movie thumbnail
                                                    ; heights can be (360,540,720,1080,2160), should at least have 540p version
                                                    ; append "H" to any width that has HEVC version available
                                                    ; if thumb_name is not specifid, <caption>.jpg will be used
                                                    ; movie filenames should be: <base_movie_name>-<height>p<rate><opt -HEVC>.ext

[Image=imagename.png<opt ,width>]                   ; Inline image, sized to page. <width> sets image width, otherwise full page width

Text fills empty space, blank lines are ignored
<b>bold</b> is allowed
<i>italic</i> is allowed

lines<br>
can be<br>
concatenated with<br>
per line

any <a href="linked_page.html">standard html</a> may be included
