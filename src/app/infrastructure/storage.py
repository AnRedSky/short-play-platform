"""Local private storage backend.

Only metadata and storage keys enter the database; file bodies stay on disk under
`settings.storage_root`, which is a mounted volume in the Compose deployment.
"""

import hashlib
import shutil
import time
from datetime import UTC, datetime
from pathlib import Path

from app.config.settings import get_settings


def storage_root() -> Path:
    root = Path(get_settings().storage_root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def resolve(storage_key: str) -> Path:
    root = storage_root()
    candidate = (root / storage_key).resolve()
    if root not in candidate.parents and candidate != root:
        raise ValueError(f"Storage key escapes the storage root: {storage_key}")
    return candidate


def build_key(project_id, filename: str, prefix: str = "assets") -> str:
    suffix = Path(filename or "").suffix.lower()[:12]
    digest = hashlib.sha1((filename or "").encode()).hexdigest()[:8]
    now = datetime.now(UTC)
    return f"{prefix}/{project_id}/{now:%Y/%m}/{now:%Y%m%d%H%M%S}-{digest}{suffix}"


def checksum_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_bytes(storage_key: str, data: bytes) -> Path:
    path = resolve(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)
    return path


def copy_into(storage_key: str, source: Path) -> Path:
    path = resolve(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    shutil.copyfile(source, tmp)
    tmp.replace(path)
    return path


def exists(storage_key: str) -> bool:
    try:
        return resolve(storage_key).is_file()
    except ValueError:
        return False


def path_of(storage_key: str) -> Path:
    return resolve(storage_key)


def purge_temp_files(max_age_seconds: int = 3600) -> int:
    """Remove stale ``*.tmp`` / ``*.part`` files left behind by interrupted writes."""
    root = storage_root()
    cutoff = time.time() - max_age_seconds
    removed = 0
    for pattern in ("*.tmp", "*.part"):
        for path in root.rglob(pattern):
            try:
                if path.is_file() and path.stat().st_mtime < cutoff:
                    path.unlink()
                    removed += 1
            except OSError:
                continue
    return removed
