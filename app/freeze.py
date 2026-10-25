"""Freeze the site to static files for GitHub Pages.

    python -m app.freeze            # writes site/, ready to publish
    python -m app.freeze --serve    # then serves site/ on 127.0.0.1:8890 to check it

Every page is rendered by the app itself, through its own routes, so the
static copy is the site exactly as the local server shows it. The crawl
starts at the front page and follows every link, and also starts from the
pages the site's content says exist (every problem, lab, reading page and
drill), so a page nothing links to yet is still published. Then static/ is
copied as it is.

A page is written as <path>/index.html, which GitHub Pages serves at <path>
(and <path>/); anything else, such as a problem's evaluator or a data file,
is written at its own path. A route that redirects becomes a small page that
forwards the browser. The build fails if any link leads nowhere, so a broken
link never reaches the published site.

The published address is config.PUBLIC_URL; pages that quote the site's
address (the tutor setup commands) use it. When that address sits below the
host's root, as a GitHub Pages project site does (/<repository>/), every
root link the build writes gets that prefix, because the app writes its
links from the root.
"""

import os
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from . import config

os.environ.setdefault("CHIPBASE_SITE_URL", config.PUBLIC_URL)
config.SITE_URL = os.environ["CHIPBASE_SITE_URL"].rstrip("/")

from fastapi.testclient import TestClient  # noqa: E402

from . import education_content, lab_content, problems, tutor_package  # noqa: E402
from .main import app  # noqa: E402

OUT = config.BASE_DIR / "site"
MARKER = ".chipbase-freeze"
# each build writes into a folder of its own and swaps it into place when it
# has finished, so two builds at once (two people, or two sessions) never
# trip over each other, and site/ is never left half written
BUILD = config.BASE_DIR / (".site-build-%d" % os.getpid())
STATIC = Path(__file__).resolve().parent / "static"

# links in the rendered HTML: href, src and action attributes, and the
# problem pages' grading payload, which names the evaluator to load
ATTR = re.compile(r'''\b(?:href|src|action)\s*=\s*["']([^"']+)["']''')
PAYLOAD_URL = re.compile(r'"evaluator_url":\s*"([^"]+)"')
EXTERNAL = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//|#)", re.I)

# the part of the published address below the host, such as /chipbase
PREFIX = urlsplit(config.SITE_URL).path.rstrip("/")


def seeds():
    """Pages the content says exist, whether or not anything links to them."""
    # every fixed route in the app: a page that loses its last link is still
    # published, and still reachable by its address
    urls = ["/"] + sorted({r.path for r in app.routes
                           if getattr(r, "methods", None) and "GET" in r.methods
                           and "{" not in r.path and not r.path.startswith(("/static", "/favicon", "/docs", "/redoc", "/openapi"))})
    for p in problems.load_all():
        urls.append("/problem/%s" % p.id)
        if (p.directory / "evaluate.js").is_file():
            urls.append("/problem/%s/evaluate.js" % p.id)
    for t in education_content.TOPICS:
        if t.get("live"):
            urls.append("/education/%s" % t["slug"])
    for lab_id in lab_content.LABS:
        urls.append("/lab/%s" % lab_id)
    urls.append("/tutor/%s" % tutor_package.filename())
    return urls


def target_for(path: str, is_html: bool) -> Path:
    rel = path.strip("/")
    if is_html:
        return BUILD / rel / "index.html" if rel else BUILD / "index.html"
    return BUILD / rel


def redirect_page(to: str) -> str:
    return (
        "<!DOCTYPE html>\n<html lang=\"en\"><head><meta charset=\"utf-8\">"
        "<title>Moved</title><link rel=\"canonical\" href=\"%s\">"
        "<meta http-equiv=\"refresh\" content=\"0; url=%s\"></head>"
        "<body><p>This page moved to <a href=\"%s\">%s</a>.</p></body></html>\n" % (to, to, to, to)
    )


def rebase():
    """Put PREFIX in front of every root link in the build: in HTML
    attributes and the meta refresh of redirect pages, in quoted literals
    inside scripts (the pages' inline scripts and every JavaScript file), and
    in CSS url()s. A literal is a link when its first segment is one of the
    app's routes or static/, so a path such as /usr/bin in a script's text is
    left alone."""
    if not PREFIX:
        return
    segments = {re.split(r"[/{]", r.path.strip("/"))[0] for r in app.routes} - {""}
    literal = re.compile(r"""(["'`(])/(?=(?:%s)\b)""" % "|".join(sorted(map(re.escape, segments))))
    attr = re.compile(r"""(\b(?:href|src|action)\s*=\s*["'])/(?!/)""")
    refresh = re.compile(r"""(url=)/(?!/)""")
    css_url = re.compile(r"""(url\(\s*["']?)/(?!/)""")
    script = re.compile(r"(<script\b[^>]*>)(.*?)(</script>)", re.S | re.I)
    add = lambda m: m.group(1) + PREFIX + "/"
    for f in BUILD.rglob("*"):
        if f.suffix not in (".html", ".js", ".mjs", ".css") or not f.is_file():
            continue
        text = f.read_text(encoding="utf-8")
        if f.suffix == ".html":
            new = script.sub(lambda m: m.group(1) + literal.sub(add, m.group(2)) + m.group(3), text)
            new = css_url.sub(add, refresh.sub(add, attr.sub(add, new)))
        elif f.suffix == ".css":
            new = css_url.sub(add, text)
        else:
            new = literal.sub(add, text)
        if new != text:
            f.write_text(new, encoding="utf-8")


def reset_out():
    """Start this build's own folder, empty."""
    if BUILD.exists():
        shutil.rmtree(BUILD)
    BUILD.mkdir()
    (BUILD / MARKER).write_text("made by python -m app.freeze\n")


def publish():
    """Swap the finished build in for site/, refusing to replace a folder
    this script did not make."""
    if OUT.exists() and any(OUT.iterdir()) and not (OUT / MARKER).exists():
        sys.exit("%s exists and was not made by the freeze; not replacing it" % OUT)
    old = config.BASE_DIR / (".site-old-%d" % os.getpid())
    if OUT.exists():
        OUT.rename(old)
    BUILD.rename(OUT)
    shutil.rmtree(old, ignore_errors=True)


def freeze() -> int:
    reset_out()
    client = TestClient(app, follow_redirects=False)
    queue = list(dict.fromkeys(seeds()))
    seen = set(queue)
    referrers = defaultdict(set)
    broken, relative, redirects = [], [], []
    pages = files = 0

    while queue:
        path = queue.pop(0)
        resp = client.get(path)
        if resp.status_code in (301, 302, 303, 307, 308):
            to = urljoin(path, resp.headers["location"])
            target_for(path, True).parent.mkdir(parents=True, exist_ok=True)
            target_for(path, True).write_text(redirect_page(to))
            redirects.append((path, to))
            links = [to]
        elif resp.status_code != 200:
            broken.append((path, resp.status_code))
            continue
        else:
            is_html = resp.headers.get("content-type", "").startswith("text/html")
            dest = target_for(path, is_html)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(resp.content)
            if not is_html:
                files += 1
                continue
            pages += 1
            text = resp.text
            links = []
            for raw in ATTR.findall(text) + PAYLOAD_URL.findall(text):
                if EXTERNAL.match(raw) or raw.startswith(("mailto:", "javascript:", "data:")):
                    continue
                if not raw.startswith("/"):
                    # a relative link resolves differently at <path> and
                    # <path>/, and GitHub Pages serves the latter
                    relative.append((path, raw))
                    continue
                links.append(raw)

        for link in links:
            parts = urlsplit(link)
            if parts.netloc:
                continue
            target = parts.path
            if target.startswith("/static/"):
                if not (STATIC / target[len("/static/"):]).is_file():
                    broken.append((target, 404))
                    referrers[target].add(path)
                continue
            referrers[target].add(path)
            if target not in seen:
                seen.add(target)
                queue.append(target)

    shutil.copytree(STATIC, BUILD / "static")
    not_found = client.get("/404")  # an unknown path renders the not-found page
    (BUILD / "404.html").write_bytes(not_found.content)
    (BUILD / ".nojekyll").write_text("")  # serve files as they are, underscores included
    rebase()
    publish()

    print("%d pages, %d other files, %d redirects, static/ copied -> %s" % (pages, files, len(redirects), OUT))
    for page, raw in relative:
        print("  relative link %r on %s" % (raw, page))
    for target, status in broken:
        print("  BROKEN %s (%s), linked from %s" % (target, status, ", ".join(sorted(referrers[target])) or "the seed list"))
    return 1 if broken else 0


def serve(port: int = 8890):
    import http.server
    import functools

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(OUT))
    print("serving %s on http://127.0.0.1:%d" % (OUT, port))
    http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()


if __name__ == "__main__":
    try:
        status = freeze()
    finally:
        shutil.rmtree(BUILD, ignore_errors=True)  # a failed build leaves nothing behind
    if "--serve" in sys.argv[1:]:
        serve()
    sys.exit(status)
