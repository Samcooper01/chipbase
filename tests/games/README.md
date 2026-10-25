# Games and site tests

Three harnesses, both run against the content in `app/`, so a change to a deck
is checked the same way whether a human or a script made it.

## The content rules

```bash
python3 tests/games/validate_content.py
```

No server needed. Checks every drill for the rules the content is held to:
three distinct wrong answers, a hint on every card, the correct answer never
the longest option, every acronym expanded, no dash characters, real log
excerpts on forensics cases, a written description on every image, click
targets inside the image, over-and-under answers roughly balanced, and no
what-happens-if situation that ties on its objective without a tiebreak.
It also holds the glossary to the same standard: every entry complete, and
any acronym the glossary defines expanded wherever another definition uses
it.

It caught a live bug the first time it ran: nine forensics options had been
written as `- Nothing: the rest of the sentence`, which YAML reads as a
dictionary rather than a string, so those options were rendering as garbage.

## Playing the drills

```bash
PORT=8891 ./run.sh &                  # or any running instance
cd tests/games && npm install         # jsdom, once
node play_drills.js http://127.0.0.1:8891
```

Loads each drill's real page in a browser-like DOM and plays it: every card in
every flash-card deck and every forensics stage, a round of each other drill,
including the click-a-region and put-in-order interactions. It checks that the
answer the content calls correct is actually among the options and grades as
correct, that the two independent graders in what-happens-if agree, and that a
wrong answer is marked wrong.

Exit code is non-zero if anything fails, so both are suitable for continuous
integration.

## The site pages

```bash
node tests/games/check_pages.js http://127.0.0.1:8891
```

Mounts the progress, glossary and open data pages and drives their scripts.
Progress is seeded with a known set of browser records and must report
exactly those totals; the glossary search and subject filter must narrow the
list correctly; the data table's design filter must not leak other designs.

The open data page reads a manifest built from the run logs. Rebuild it
after new runs land:

```bash
.venv/bin/python -m app.dataset build
```
