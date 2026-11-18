"""FFmpeg / ffprobe integration for probing and MP4 export inside the enterprise network."""

import json
import shutil
import subprocess
from pathlib import Path

from app.config.settings import get_settings
from app.public.exceptions import AppError


class MediaBinaries:
    def __init__(self) -> None:
        settings = get_settings()
        self.ffmpeg = shutil.which(settings.ffmpeg_binary)
        self.ffprobe = shutil.which(settings.ffprobe_binary)

    def require_ffmpeg(self) -> str:
        if self.ffmpeg is None:
            raise AppError(
                "FFmpeg is not available on this host",
                code="MEDIA_RENDERER_UNAVAILABLE",
                status_code=503,
            )
        return self.ffmpeg

    def require_ffprobe(self) -> str:
        if self.ffprobe is None:
            raise AppError(
                "ffprobe is not available on this host",
                code="MEDIA_PROBE_UNAVAILABLE",
                status_code=503,
            )
        return self.ffprobe


def probe(path: Path) -> dict:
    binaries = MediaBinaries()
    ffprobe = binaries.require_ffprobe()
    completed = subprocess.run(  # noqa: S603 - fixed binary, no shell
        [
            ffprobe,
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise AppError(
            "ffprobe could not read the media file",
            code="MEDIA_PROBE_FAILED",
            status_code=422,
            details={"stderr": completed.stderr[-400:]},
        )
    payload = json.loads(completed.stdout or "{}")
    streams = payload.get("streams") or []
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    duration = payload.get("format", {}).get("duration") or (
        video.get("duration") if video else None
    )
    result: dict = {
        "duration_ms": int(float(duration) * 1000) if duration else None,
        "codec": (video or audio or {}).get("codec_name"),
        "has_video": video is not None,
        "has_audio": audio is not None,
    }
    if video is not None:
        result["width"] = int(video.get("width") or 0)
        result["height"] = int(video.get("height") or 0)
    return result


def render_image_sequence(
    images: list[Path],
    output: Path,
    *,
    width: int = 1080,
    height: int = 1920,
    fps: int = 25,
    seconds_per_image: float = 2.0,
) -> dict:
    """Render uploaded stills into a verified MP4.

    Every image is looped for exactly `seconds_per_image`, normalised to the requested
    frame size and joined by the concat filter, so the timeline is deterministic instead
    of depending on demuxer duration heuristics. The output is probed with ffprobe
    afterwards; a stream ffprobe cannot read is a failure, never a success.
    """
    if not images:
        raise AppError(
            "At least one image asset is required", code="VALIDATION_ERROR", status_code=422
        )
    binaries = MediaBinaries()
    ffmpeg = binaries.require_ffmpeg()

    output.parent.mkdir(parents=True, exist_ok=True)
    command: list[str] = [ffmpeg, "-y"]
    chains: list[str] = []
    for index, image in enumerate(images):
        command += ["-loop", "1", "-t", f"{seconds_per_image:.3f}", "-i", str(image)]
        chains.append(
            f"[{index}:v]scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p,fps={fps}[v{index}]"
        )
    joined = "".join(f"[v{index}]" for index in range(len(images)))
    chains.append(f"{joined}concat=n={len(images)}:v=1:a=0[out]")
    command += [
        "-filter_complex",
        ";".join(chains),
        "-map",
        "[out]",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(output),
    ]

    completed = subprocess.run(  # noqa: S603 - fixed binary, no shell
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0 or not output.is_file() or output.stat().st_size == 0:
        raise AppError(
            "FFmpeg failed to render the export",
            code="MEDIA_RENDER_FAILED",
            status_code=422,
            details={"stderr": completed.stderr[-400:]},
        )
    return probe(output)
