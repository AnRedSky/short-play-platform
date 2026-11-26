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

ASSET_REGISTERED = "registered"
ASSET_QC_PASSED = "qc_passed"
ASSET_REJECTED = "rejected"
ASSET_FORMAL = "formal"

QC_PENDING = "pending"
QC_PASSED = "passed"
QC_FAILED = "failed"

AUTHORIZATION_PENDING = "pending"
AUTHORIZATION_CLEARED = "cleared"
AUTHORIZATION_RESTRICTED = "restricted"

VERSION_DRAFT = "draft"
VERSION_FORMAL = "formal"
VERSION_SUPERSEDED = "superseded"

UPLOAD_PENDING = "pending"
UPLOAD_UPLOADED = "uploaded"
UPLOAD_COMPLETED = "completed"
