"""Assets domain constants."""

# Longest prefix wins; anything unmatched is treated as a document.
MIME_KIND_MAP = (
    ("image/", "image"),
    ("video/", "video"),
    ("audio/", "audio"),
    ("text/vtt", "subtitle"),
    ("application/pdf", "document"),
)

DEFAULT_MIME_TYPE = "application/octet-stream"
PROBED_KINDS = ("image", "video")
