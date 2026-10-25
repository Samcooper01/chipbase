# Flash-card decks: the file format

One YAML file per deck, plus a `*_scope.md` beside it recording what the deck
covers and where its content was checked against.

## Deck header

```yaml
deck: sdc                     # the identifier in the URL
title: SDC (Synopsys Design Constraints)
reference: https://...        # the documentation the answers link to
source_link: anchor | path    # how a card's `source` joins the reference
default_question: "..."       # for decks whose cards show file text, not commands
basis:                        # the source note printed above the cards
  tool: OpenSTA
  tool_url: https://...
  doc_title: the OpenSTA command reference
  tag: as implemented in OpenSTA
  note: >-
    ...
sections:
  - id: clocks
    title: Clocks
    blurb: ...
    commands: [create_clock, ...]   # chips on the section tile
```

## Card styles

Every card carries `id`, `section`, `hint`, `explain`, and `source`. What else
it needs depends on its `style`:

| `style` | shows | options | fields |
|---|---|---|---|
| (none) | `command` in the dark box | four meanings | `command`, `answer`, `wrong` |
| (none, with `excerpt`) | real tool output | four readings | `excerpt`, `question`, `answer`, `wrong` |
| `reverse` | a prose `prompt` | four commands, in the monospace face | `prompt`, `answer`, `wrong` |
| `bug` | a `command` that is wrong | four faults | `command`, `answer`, `wrong` |
| `blank` | a `command` with `____` in it | four fillings, in the monospace face | `command`, `answer`, `wrong` |
| `order` | nothing above the items | the items themselves, clicked in order | `question`, `items` |

A card may always override the question with its own `question`. An ordering
card is graded on the first mistake: it is correct only once every item has
been picked in order, and a wrong pick reveals the whole order and ends the
card.

## Rules the cards are held to

- Three wrong answers, all plausible, none a restatement of another.
- The correct answer must not be the longest option. The check is
  `len(answer) > max(len(wrong)) + 10`, and it is run over every deck.
- A hint on every card, phrased as a question to ask yourself rather than as
  half the answer. A hint keeps the card where it is on the schedule.
- Every acronym expanded on every use, in every field.
- No em dashes and no en dashes anywhere.
- Quoted file text and tool output must be verbatim from a real file or run,
  and the scope document says which.

## Checking a deck

From the repository root:

```
.venv/bin/python tests/games/validate_content.py        # the rules above, over every deck
node tests/games/play_drills.js http://127.0.0.1:8888   # plays every card against a running server
```

The first needs no server. The second needs `npm install` in `tests/games` once; it loads each
deck's real page in a browser-like page model, answers every card, and reports any card whose
answer is missing from its options or which fails to grade.
