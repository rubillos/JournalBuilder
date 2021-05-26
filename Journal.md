JournalBuilder requires a destination folder where all of the generated files will be placed
It should contain a file named journal.txt which describes the output journal
Source images come either from a folder named images in the output folder, or
from an album in the Photos library spcified with the -a option

Below is the layout for the journal.txt file
--------------------------------------------------------------------------------
[Site]Title                                         ; Site title
[Value:thumb_size]200                               ; Thumbnail size
[Value:header_height]300                            ; Page header height
[Previous]previous.html                             ; URL of previous site
[Next]next.html                                     ; URL of next site
[Caption:filename.ext]Caption                       ; Define a caption for an image
[Date:filename.ext]2020-08-19 14:06:55              ; Override the date for an image

[Page:header.jpg,percent]Title                      ; New page with header image and Title. Percent sets header slice offset
[Epilog:header.jpg,percent]                         ; Special case of [Page] for last page, places remaining images on previous page

[Heading:2020-08-18]Left Text<opt \t>Right Text     ; Heading with optional date, places images before date above heading

[Image]imagename.png                                ; Inline image, sized to page

Text fills empty space, blank lines are ignored
<b>bold</b> is allowed
<i>italic</i> is allowed

lines<br>
can be<br>
concatenated with<br>

any <a href="linked_page.html">standard html</a> may be included
