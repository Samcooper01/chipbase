"""Central configuration: filesystem locations, and where the site is
published."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PROBLEMS_DIR = BASE_DIR / "problems"
DATA_DIR = BASE_DIR / "data"

DATA_DIR.mkdir(exist_ok=True)

# The published site, a static copy on GitHub Pages (python -m app.freeze).
# Pages that quote the site's own address, such as the tutor setup page,
# use SITE_URL when it is set and the address they were served from
# otherwise, so a local server quotes itself. The freeze sets it.
SITE_URL = os.environ.get("CHIPBASE_SITE_URL", "").rstrip("/")
PUBLIC_URL = "https://samcooper01.github.io/chipbase"

# The repository the site is published from. Flagging a drill item and
# suggesting a drill open issues on it.
GITHUB_REPO = "Samcooper01/chipbase"
ISSUES_URL = "https://github.com/%s/issues" % GITHUB_REPO
