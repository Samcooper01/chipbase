"""The tutor download: a zip of the chipbase-tutor server's source, built from
the tutor/ folder when it is asked for, so the download is always the code in
the repository and never a stale copy."""

import io
import re
import zipfile
from pathlib import Path

TUTOR = Path(__file__).resolve().parent.parent / "tutor"
SKIP_DIRS = {".venv", "__pycache__", ".pytest_cache", "build", "dist"}  # build and dist: leftovers of a local pip install


def version() -> str:
    text = (TUTOR / "pyproject.toml").read_text()
    m = re.search(r'^version\s*=\s*"([^"]+)"', text, re.M)
    return m.group(1) if m else "0"


def _files():
    for path in sorted(TUTOR.rglob("*")):
        rel = path.relative_to(TUTOR)
        if path.is_dir() or any(part in SKIP_DIRS or part.endswith(".egg-info") for part in rel.parts):
            continue
        yield path, rel


def build_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for path, rel in _files():
            z.write(path, "chipbase-tutor/" + rel.as_posix())
    return buf.getvalue()


def filename() -> str:
    return "chipbase-tutor-%s.zip" % version()
