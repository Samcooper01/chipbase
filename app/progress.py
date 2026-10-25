"""The progress page: what one learner has done, across every section.

Everything is recorded in the visitor's browser, so the page is the same
static file for everyone: the server only describes each record (its
storage key and its size) and the page's own script reads the browser's
records. Problems are kept under "pdleet-problems" (written by
static/app.js on Submit). Reading and challenges keep no record yet; the
page says so instead of inventing one.
"""

from . import education_content, games_content, problems

# The worked examples, in flow order, and the key each one saves under
# ("pdleet.<key>.progress", written by static/explore/flow-page.js).
EXAMPLES = [
    ("synthesis", "Synthesis"), ("floorplan", "Floorplanning"), ("placement", "Placement"),
    ("cts", "Clock tree synthesis"), ("routing", "Routing"), ("timing", "Timing sign-off"),
    ("finish", "Finishing and tapeout"),
]


def context() -> dict:
    probs = [{"id": p.id, "title": p.title, "topic": p.topic, "difficulty": p.difficulty}
             for p in problems.load_all()]

    # what the browser script needs to read the drills' own records
    decks = []
    for d in games_content.FLASH_DECKS:
        if d["live"]:
            decks.append({"key": "pdleet-fc-" + d["id"], "title": d["title"],
                          "total": len(games_content.load_deck(d["id"])["cards"]),
                          "href": "/games/flash-cards/" + d["id"]})
    drills = [
        {"key": "pdleet-fc-log-forensics", "title": "Log forensics", "kind": "cards",
         "total": len(games_content.load_forensics()["cards"]), "href": "/games/log-forensics"},
        {"key": "pdleet-ou-over-under", "title": "Call the number", "kind": "answers",
         "total": len(games_content.load_overunder()["items"]), "href": "/games/over-under"},
        {"key": "pdleet-pa-spot-the-pathology", "title": "Read the die", "kind": "answers",
         "total": len(games_content.load_pathology()["items"]), "href": "/games/spot-the-pathology"},
        {"key": "pdleet-wi-what-if", "title": "Your move", "kind": "answers",
         "total": len(games_content.load_whatif()["items"]), "href": "/games/what-if"},
    ]
    examples = [{"key": "pdleet.%s.progress" % k, "title": t, "href": "/explore/examples/" + k}
                for k, t in EXAMPLES]
    reading = [{"title": t["name"], "href": "/education/" + t["slug"]}
               for t in education_content.TOPICS if t.get("live")]
    return {
        "problems": probs,
        "decks": decks, "drills": drills, "examples": examples, "reading": reading,
    }
