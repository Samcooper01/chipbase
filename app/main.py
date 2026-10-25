"""Web application: a small judge in the style of a coding-practice site,
but the submissions are floorplans, constraints, and tool scripts, and the
test cases are physical-design quality metrics.

Every page is the same for every visitor, so the whole site freezes to
static files for GitHub Pages (python -m app.freeze). Anything per visitor,
such as grading and solved problems, happens in the visitor's browser. This
server is the local authoring copy of that site: it must not grow routes
that only a live server could answer."""

import json
import mimetypes
import re
from pathlib import Path

import markdown as markdown_lib

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import algo_content, challenge_content, config, education_content, explore, lab_content, problems, process_content

# some systems' mimetypes tables lack WebP, and the static files would then be
# served as downloads; name it, so the browser shows it
mimetypes.add_type("image/webp", ".webp")

app = FastAPI(title="Chipbase")

_HERE = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=_HERE / "static"), name="static")
templates = Jinja2Templates(directory=_HERE / "templates")

# cache-busting version for our own static assets: the newest mtime under
# static/ and of the problems' evaluators. Recomputed at startup, and every
# content change restarts the server, so browsers always fetch current
# scripts after a plain refresh.
_asset_v = 0
for _p in list((_HERE / "static").rglob("*")) + list(config.PROBLEMS_DIR.glob("*/evaluate.js")):
    if _p.is_file():
        _asset_v = max(_asset_v, int(_p.stat().st_mtime))
templates.env.globals["asset_v"] = _asset_v
# where flags and drill suggestions go (GitHub issues on the site's repository)
templates.env.globals["issues_url"] = config.ISSUES_URL

# navigation dropdown data: stage catalogs that actually have content,
# in flow order; computed once at startup (content changes restart the app)
templates.env.globals["explore_nav_stages"] = [
    {"name": cat["name"], "href": f"/explore/algorithms/{cat['slug']}"}
    for cat in explore.CATEGORIES
    if algo_content.get_stage(cat["slug"]) is not None
]
templates.env.globals["education_nav_topics"] = [
    {"name": t["name"], "href": f"/education/{t['slug']}"}
    for t in education_content.TOPICS
    if t.get("live")
]
templates.env.globals["problems_nav_topics"] = [
    {"name": t["name"], "href": f"/problems#{t['slug']}"}
    for t in education_content.TOPICS
    if t["name"] in problems.EDU_TOPIC_ORDER
]


def _games_nav():
    from . import games_content          # the games session's list of drills
    return [{"name": g["title"], "href": g["href"]} for g in games_content.GAMES if g.get("live")]


templates.env.globals["games_nav"] = _games_nav()


from . import site_catalog as _site_catalog  # noqa: E402
# the tools the site is built on, for the footer on every page (one list, shared with the front page)
templates.env.globals["built_on"] = _site_catalog.BUILT_ON


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    all_problems = problems.load_all()
    topic_counts = [
        (topic, len(plist))
        for topic, plist in problems.grouped_by_topic(all_problems)
    ]
    live_explorables = [e for e in explore.EXPLORABLES if e["live"]]
    planned_explorables = [e for e in explore.EXPLORABLES if not e["live"]]
    return templates.TemplateResponse(
        request,
        "home.html",
        {
            "problem_total": len(all_problems),
            "total_points": sum(p.points for p in all_problems),
            "total_algos": algo_content.total_algo_count(),
            "topic_counts": topic_counts,
            "live_explorables": live_explorables,
            "planned_explorables": planned_explorables[:2],
            # everything on the site, for the front page's catalog (games
            # session owns site_catalog.py)
            "catalog": _site_catalog.catalog(),
        },
    )


@app.get("/problems", response_class=HTMLResponse)
def problems_index(request: Request):
    edu_meta = {t["name"]: t for t in education_content.TOPICS}
    sections = []
    for name in problems.EDU_TOPIC_ORDER:
        groups = problems.PLANNED_TYPES.get(name, [])
        sections.append(
            {
                "name": name,
                "slug": edu_meta.get(name, {}).get("slug"),
                "groups": groups,
                "type_count": sum(len(g["items"]) for g in groups),
            }
        )
    return templates.TemplateResponse(
        request,
        "index.html",
        {"sections": sections},
    )


@app.get("/problem/{problem_id}", response_class=HTMLResponse)
def problem_page(request: Request, problem_id: str):
    problem = problems.get(problem_id)
    if problem is None:
        return HTMLResponse("problem not found", status_code=404)
    # everything the browser grader needs, plus where to load it from
    client_payload = problems.grading_data(problem)
    client_payload["worker_url"] = "/static/grader/worker.js?v=%d" % _asset_v
    if (problem.directory / "evaluate.js").is_file():
        client_payload["evaluator_url"] = "/problem/%s/evaluate.js?v=%d" % (problem.id, _asset_v)
    return templates.TemplateResponse(
        request,
        "problem.html",
        {
            "problem": problem,
            "client_payload": json.dumps(client_payload),
        },
    )


@app.get("/problem/{problem_id}/evaluate.js")
def problem_evaluator(problem_id: str):
    # the problem's own grading function, run by static/grader/worker.js
    problem = problems.get(problem_id)
    path = problem.directory / "evaluate.js" if problem else None
    if path is None or not path.is_file():
        return HTMLResponse("no evaluator", status_code=404)
    return FileResponse(path, media_type="text/javascript")


@app.get("/explore", response_class=HTMLResponse)
def explore_hub_page(request: Request):
    return templates.TemplateResponse(
        request,
        "explore_hub.html",
        {"sections": explore.SECTIONS},
    )


@app.get("/sandboxes", response_class=HTMLResponse)
def sandboxes_page(request: Request):
    return templates.TemplateResponse(
        request,
        "sandboxes.html",
        {
            "examples": explore.sandboxes("example"),
            "designs": explore.sandboxes("open"),
        },
    )


_EXAMPLE_STAGES = {"synthesis", "floorplan", "placement", "cts", "routing", "timing", "finish"}


@app.get("/explore/examples/{stage}", response_class=HTMLResponse)
def example_page(request: Request, stage: str):
    if stage not in _EXAMPLE_STAGES:
        return HTMLResponse("unknown example", status_code=404)
    return templates.TemplateResponse(
        request, "flow.html", {"stage": stage}
    )


@app.get("/explore/designs/{design}", response_class=HTMLResponse)
def design_page(request: Request, design: str):
    # a whole design taken through the flow in the browser (design.html); the
    # name is the key of its data file under static/explore/designs/
    if not re.fullmatch(r"[a-z0-9]+", design) or not (_HERE / "static" / "explore" / "designs" / (design + ".js")).is_file():
        return HTMLResponse("unknown design", status_code=404)
    return templates.TemplateResponse(request, "design.html", {"design": design})


@app.get("/explore/algorithms", response_class=HTMLResponse)
def algorithms_page(request: Request):
    return templates.TemplateResponse(
        request,
        "explore.html",
        {"groups": explore.grouped()},
    )


@app.get("/explore/algorithms/maze-router", response_class=HTMLResponse)
def maze_router_page(request: Request):
    return templates.TemplateResponse(
        request, "maze_router.html"
    )


@app.get("/explore/algorithms/floorplan-sandbox", response_class=HTMLResponse)
def floorplan_sandbox_page(request: Request):
    return templates.TemplateResponse(
        request, "floorplan_sandbox.html"
    )


@app.get("/explore/algorithms/{stage_slug}", response_class=HTMLResponse)
def algorithm_catalog_page(request: Request, stage_slug: str):
    entry = algo_content.get_stage(stage_slug)
    if entry is None:
        return HTMLResponse("unknown algorithm section", status_code=404)
    # list order is the reading order within each family (flow order
    # for routing); levels are chips and filters, not the sort key
    algorithms = entry["algorithms"]
    return templates.TemplateResponse(
        request,
        "algo_catalog.html",
        {
            "stage": entry["stage"],
            "algorithms": algorithms,
        },
    )


@app.get("/explore/algorithms/{stage_slug}/{algo_slug}", response_class=HTMLResponse)
def algorithm_detail_page(request: Request, stage_slug: str, algo_slug: str):
    found = algo_content.get_algo(stage_slug, algo_slug)
    if found is None:
        return HTMLResponse("unknown algorithm page", status_code=404)
    entry = algo_content.get_stage(stage_slug)
    body_html = markdown_lib.markdown(
        found["algo"]["body"], extensions=["fenced_code", "tables"]
    )
    return templates.TemplateResponse(
        request,
        "algo_page.html",
        {
            "stage": entry["stage"],
            "algo": found["algo"],
            "prev": found["prev"],
            "next": found["next"],
            "body_html": body_html,
        },
    )


@app.get("/explore/processes", response_class=HTMLResponse)
def processes_catalog_page(request: Request):
    return templates.TemplateResponse(
        request,
        "algo_catalog.html",
        {
            "stage": process_content.STAGE,
            "algorithms": process_content.ENTRIES,
            "section_href": "/explore/processes",
            "section_label": "Foundry Processes",
            "catalog_kind": "processes",
        },
    )


@app.get("/explore/processes/{slug}", response_class=HTMLResponse)
def process_detail_page(request: Request, slug: str):
    found = process_content.get_entry(slug)
    if found is None:
        return HTMLResponse("unknown process page", status_code=404)
    body_html = markdown_lib.markdown(
        found["algo"]["body"], extensions=["fenced_code", "tables"]
    )
    return templates.TemplateResponse(
        request,
        "algo_page.html",
        {
            "stage": process_content.STAGE,
            "algo": found["algo"],
            "prev": found["prev"],
            "next": found["next"],
            "body_html": body_html,
            "section_href": "/explore/processes",
            "section_label": "Foundry Processes",
            "catalog_kind": "processes",
        },
    )


@app.get("/games", response_class=HTMLResponse)
def games_page(request: Request):
    # Games hub: fast-feedback drills (games session owns games_content.py).
    from . import games_content

    return templates.TemplateResponse(
        request,
        "games.html",
        {
            "games": games_content.hub_games(),
            "totals": games_content.hub_totals(),
        },
    )


@app.get("/data", response_class=HTMLResponse)
def data_page(request: Request):
    # Open data: the OpenROAD runs behind the drills (games session owns
    # dataset.py and data.html). Reads the manifest `python3 -m app.dataset
    # build` writes; the page says so if it has not been built.
    from . import dataset

    manifest = dataset.load()
    ctx = {"data": manifest}
    if manifest:
        runs = manifest["runs"]
        ctx["designs"] = sorted({r["design"] for r in runs})
        ctx["platforms"] = sorted({r["platform"] for r in runs})
        ctx["cited"] = sum(1 for r in runs if r["used_by"])
        archive = dataset.OUT / manifest["archive"]
        ctx["archive_mb"] = "%.1f" % (archive.stat().st_size / 1e6) if archive.exists() else None
    return templates.TemplateResponse(request, "data.html", ctx)


@app.get("/glossary", response_class=HTMLResponse)
def glossary_page(request: Request):
    # Every term and acronym the site uses (games session owns app/glossary/).
    from . import glossary

    return templates.TemplateResponse(
        request, "glossary.html", {"g": glossary.load()}
    )


@app.get("/tutor", response_class=HTMLResponse)
def tutor_page(request: Request):
    # Setup page for the chipbase-tutor MCP server (games session owns
    # tutor.html, tutor_package.py and the tutor/ folder). The commands on the
    # page are filled in with this site's own address.
    from . import tutor_package

    return templates.TemplateResponse(
        request,
        "tutor.html",
        {
            "version": tutor_package.version(),
            "size_kb": max(1, round(len(tutor_package.build_zip()) / 1024)),
            "filename": tutor_package.filename(),
            "site": config.SITE_URL or str(request.base_url).rstrip("/"),
        },
    )


@app.get("/tutor/{filename}")
def tutor_download(filename: str):
    # the tutor's source as a zip, named with its version so the static copy
    # is an ordinary file
    from . import tutor_package

    if filename != tutor_package.filename():
        return HTMLResponse("not found", status_code=404)
    return Response(tutor_package.build_zip(), media_type="application/zip")


@app.get("/progress", response_class=HTMLResponse)
def progress_page(request: Request):
    # One learner's progress across the site (games session owns progress.py).
    from . import progress

    return templates.TemplateResponse(request, "progress.html", progress.context())


@app.get("/data/files/{rel:path}")
def data_file(rel: str):
    # Only files the dataset publishes, by folder and suffix; anything else 404s.
    from . import dataset

    target = dataset.resolve_file(rel)
    if target is None:
        return HTMLResponse("not found", status_code=404)
    text = {".log", ".rpt", ".sh", ".tcl", ".py", ".sdc", ".md", ".csv"}
    if target.suffix in text:
        return FileResponse(target, media_type="text/plain; charset=utf-8")
    if target.suffix == ".gz":
        return FileResponse(target, filename=target.name)
    return FileResponse(target)


@app.get("/games/{path:path}", response_class=HTMLResponse)
def game_page(request: Request, path: str):
    # Drill pages at any depth under /games/ (games session owns
    # games_content.py and the games_*.html templates).
    from . import games_content

    ctx = games_content.page_context(path)
    if ctx is None:
        return HTMLResponse("unknown game", status_code=404)
    return templates.TemplateResponse(request, ctx.pop("template"), ctx)


@app.get("/lab/{lab_id}", response_class=HTMLResponse)
def lab_page(request: Request, lab_id: str):
    lab = lab_content.get_lab(lab_id)
    if lab is None:
        return HTMLResponse("unknown lab", status_code=404)
    prompt_html = markdown_lib.markdown(
        lab["prompt"], extensions=["fenced_code", "tables"]
    )
    # Carry the lab id into the spec so the engine can namespace its
    # per-lab best-score storage (and know which lab it is drawing).
    spec = dict(lab["spec"])
    spec.setdefault("id", lab_id)
    return templates.TemplateResponse(
        request,
        "lab.html",
        {
            "lab": lab,
            "prompt_html": prompt_html,
            "spec_json": json.dumps(spec),
        },
    )


@app.get("/education", response_class=HTMLResponse)
def education_hub_page(request: Request):
    return templates.TemplateResponse(
        request,
        "education_hub.html",
        {
            "topics": education_content.TOPICS,
            # each topic's sections: the books on its shelf
            "chapters": {t["slug"]: education_content.chapters(t) for t in education_content.TOPICS},
        },
    )


@app.get("/education/{slug}", response_class=HTMLResponse)
def education_guide_page(request: Request, slug: str):
    topic = education_content.get_topic(slug)
    if topic is None or not topic.get("live"):
        return HTMLResponse("unknown education topic", status_code=404)
    body_html = markdown_lib.markdown(
        topic["body"], extensions=["fenced_code", "tables"]
    )
    return templates.TemplateResponse(
        request,
        "education_guide.html",
        {
            "topic": topic,
            "body_html": body_html,
        },
    )


@app.get("/algorithms{rest:path}", include_in_schema=False)
def algorithms_redirect(rest: str):
    return RedirectResponse("/explore/algorithms" + rest, status_code=301)


@app.get("/challenges", response_class=HTMLResponse)
def challenges_page(request: Request):
    # a single challenge for now: the Challenges tab is the challenge itself
    ch = challenge_content.all_challenges()[0]
    return templates.TemplateResponse(
        request,
        "challenge.html",
        {"ch": ch},
    )


@app.get("/challenges/gemmini/workload", response_class=HTMLResponse)
def challenge_workload_page(request: Request):
    # step-by-step walkthrough of one matrix multiply through Gemmini (challenge documentation)
    return templates.TemplateResponse(request, "challenge_workload.html")


@app.get("/challenges/{slug}", response_class=HTMLResponse)
def challenge_page(request: Request, slug: str):
    return RedirectResponse("/challenges")


from starlette.exceptions import HTTPException as _HTTPException  # noqa: E402


@app.exception_handler(404)
def not_found(request: Request, exc: _HTTPException):
    # an unknown address gets the site's own page (GitHub Pages serves the
    # frozen copy of it, site/404.html, for any path it does not have)
    return templates.TemplateResponse(request, "404.html", status_code=404)


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(
        _HERE / "static" / "favicon.svg", media_type="image/svg+xml"
    )
