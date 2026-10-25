/* Games: command flash cards, multiple choice with a Leitner spaced-repetition
   schedule. Progress is kept in the browser (localStorage), one record per deck:
   { cardId: { box: 1..5, due: epoch ms } }. A card never answered is "new".
   - Correct on the first try in a round: move up one box (a new card enters
     box 2); the card is next due after INTERVAL_DAYS[box].
   - Correct after asking for the card's hint: the box does not advance, so the
     card comes back sooner.
   - Wrong: back to box 1, due now, and it returns later in the same round
     until answered correctly.
   A round is up to ROUND_SIZE cards: due cards first (oldest due first), then
   new cards drawn at random from what is left, so that every kind of card in
   a section has the same chance of appearing in the first round.
   A card's `style` decides what it shows and what the options are:
     command (the default)  `command`, and four meanings to choose between
     reading                `excerpt` of real output, with its own `question`
     reverse                a prose `prompt`, and four commands to choose between
     bug                    a `command` that is wrong, and four faults to choose
     blank                  a `command` with a gap in it, and four fillings
     order                  `items`, to be clicked into the right order
   A card with a `hint` shows a "Show a hint" button (or the h key).
   window.FlashCards = { mount, buildRound, grade, stats }. */
(function () {
  "use strict";
  var ROUND_SIZE = 10, REQUEUE_GAP = 3, DAY = 86400000;
  var DEFAULT_QUESTION = {
    command: "What does this command do?",
    reading: "What does this output tell you?",
    reverse: "Which command does this?",
    bug: "What is wrong with this?",
    blank: "What belongs in the blank?",
    order: "Put these in the order they run."
  };
  /* styles whose options are commands rather than prose, so they are set in
     the monospace face */
  var CODE_OPTIONS = { reverse: true, blank: true };
  var INTERVAL_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 21 };

  /* ---------- pure scheduling functions (tested headlessly) ---------- */
  function grade(entry, correct, now, hinted) {
    if (!correct) return { box: 1, due: now };
    var box = entry ? Math.min(5, entry.box + 1) : 2;
    if (hinted) box = entry ? entry.box : 1;
    return { box: box, due: now + INTERVAL_DAYS[box] * DAY };
  }
  function buildRound(cards, progress, now, size, rng) {
    size = size || ROUND_SIZE;
    var due = cards.filter(function (c) { var p = progress[c.id]; return p && p.due <= now; })
      .sort(function (a, b) { return progress[a.id].due - progress[b.id].due; });
    var fresh = cards.filter(function (c) { return !progress[c.id]; });
    if (rng) fresh = shuffled(fresh, rng);
    return due.concat(fresh).slice(0, size).map(function (c) { return c.id; });
  }
  function stats(cards, progress, now) {
    var s = { total: cards.length, fresh: 0, learning: 0, reviewing: 0, known: 0, due: 0, nextDue: null };
    cards.forEach(function (c) {
      var p = progress[c.id];
      if (!p) { s.fresh++; return; }
      if (p.box <= 2) s.learning++; else if (p.box <= 4) s.reviewing++; else s.known++;
      if (p.due <= now) s.due++; else if (s.nextDue === null || p.due < s.nextDue) s.nextDue = p.due;
    });
    return s;
  }
  function shuffled(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------- rendering helpers ---------- */
  function styleOf(card) { return card.style || (card.excerpt ? "reading" : "command"); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function rich(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>"); }
  function whenText(ms, now) {
    var d = Math.max(0, ms - now), h = d / 3600000;
    if (h < 1) return "within the hour";
    if (h < 24) return "in " + Math.round(h) + " hour" + (Math.round(h) === 1 ? "" : "s");
    var days = Math.round(h / 24); return "in " + days + " day" + (days === 1 ? "" : "s");
  }

  function mount(root, deck, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, clock = opts.now || function () { return Date.now(); };
    var KEY = "pdleet-fc-" + deck.deck;
    /* Log forensics used to be saved under "pdleet-fc-undefined" because its
       data carried no deck name; move that record across once. */
    try {
      var legacy = "pdleet-fc-undefined";
      if (deck.deck === "log-forensics" && !window.localStorage.getItem(KEY) && window.localStorage.getItem(legacy)) {
        window.localStorage.setItem(KEY, window.localStorage.getItem(legacy));
        window.localStorage.removeItem(legacy);
      }
    } catch (e) {}
    var byId = {}; deck.cards.forEach(function (c) { byId[c.id] = c; });
    function load() {
      try { var raw = window.localStorage.getItem(KEY); var p = raw ? JSON.parse(raw) : {}; return p && typeof p === "object" ? p : {}; }
      catch (e) { return {}; }
    }
    function save() { try { window.localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) {} }
    /* One record per deck, shared by its sections: a page may be given only
       one section's cards, so records for other cards are kept untouched. */
    var progress = load();

    var queue = [], firstTry = {}, missed = [], cur = null, options = [], answered = false, roundLen = 0, done = 0, practicing = false, hinted = false;
    var order = { picked: [], items: [] };

    var box = document.createElement("div"); box.className = "fc-box"; root.appendChild(box);
    var statusEl = document.createElement("div"); statusEl.className = "fc-status"; root.appendChild(statusEl);

    function renderStatus() {
      var s = stats(deck.cards, progress, clock());
      statusEl.innerHTML = '<span><b>' + s.total + '</b> cards</span><span><b>' + s.fresh + '</b> new</span>' +
        '<span><b>' + s.learning + '</b> learning</span><span><b>' + s.reviewing + '</b> reviewing</span>' +
        '<span><b>' + s.known + '</b> known</span>' +
        '<button type="button" class="fc-linkbtn" data-act="reset-progress">reset progress</button>';
    }
    function startRound(practice) {
      var now = clock();
      var ids = buildRound(deck.cards, progress, now, ROUND_SIZE, rng);
      practicing = false;
      if (!ids.length && practice) { ids = shuffled(deck.cards.map(function (c) { return c.id; }), rng).slice(0, ROUND_SIZE); practicing = true; }
      queue = ids.slice(); firstTry = {}; missed = []; roundLen = ids.length; done = 0;
      if (!queue.length) { renderIdle(); return; }
      next();
    }
    function renderIdle() {
      var s = stats(deck.cards, progress, clock());
      box.innerHTML = '<div class="fc-card fc-idle"><div class="fc-idle-title">No cards are due.</div>' +
        '<p class="fc-explain">' + (s.nextDue ? "The next card is due " + whenText(s.nextDue, clock()) + "." : "") +
        ' A practice round draws cards at random and does not change the schedule.</p>' +
        '<div class="fc-actions"><button type="button" class="btn" data-act="practice">Practice round</button></div></div>';
      renderStatus();
    }
    function body(card, style) {
      if (style === "reading") return '<pre class="fc-excerpt"><code>' + esc(card.excerpt) + '</code></pre>';
      if (style === "reverse") return '<div class="fc-prompt">' + rich(card.prompt || "") + '</div>';
      /* an ordering card may still show something to reason from */
      if (style === "order") return card.excerpt ? '<pre class="fc-excerpt"><code>' + esc(card.excerpt) + '</code></pre>' : "";
      return '<pre class="fc-command"><code>' + esc(card.command) + '</code></pre>';
    }
    function next() {
      if (!queue.length) { renderSummary(); return; }
      cur = byId[queue.shift()]; answered = false; hinted = false;
      var style = styleOf(cur);
      order = { picked: [], items: [] };
      if (style === "order") order.items = shuffled(cur.items.map(function (t, i) { return { text: t, place: i }; }), rng);
      else options = shuffled([{ text: cur.answer, ok: true }].concat(cur.wrong.map(function (w) { return { text: w, ok: false }; })), rng);
      var html = '<div class="fc-card" data-card="' + esc(cur.id) + '" data-style="' + esc(style) + '">' +
        '<div class="fc-meta"><span class="chip fc-topic">' + esc(cur.topic || "") + '</span><span class="fc-count">' + (practicing ? "practice &middot; " : "") + 'card ' + (done + 1) + ' of ' + roundLen + (firstTry[cur.id] === false ? " &middot; retry" : "") + '</span></div>' +
        body(cur, style) +
        '<div class="fc-question">' + esc(cur.question || DEFAULT_QUESTION[style]) + '</div>' +
        (cur.hint ? '<div class="fc-hint-row"><button type="button" class="fc-hintbtn" data-act="hint">Show a hint</button><span class="fc-hint"></span></div>' : '');
      if (style === "order") {
        html += '<div class="fc-order">';
        order.items.forEach(function (it, i) {
          html += '<button type="button" class="fc-order-item" data-item="' + i + '"><span class="fc-key">' + (i + 1) +
            '</span><span class="fc-order-text"><code>' + esc(it.text) + '</code></span><span class="fc-order-pos"></span></button>';
        });
        html += '</div><p class="fc-order-note">Click them in order. One wrong choice ends the card.</p>';
      } else {
        var code = CODE_OPTIONS[style];
        html += '<div class="fc-options">';
        options.forEach(function (o, i) {
          html += '<button type="button" class="fc-option' + (code ? ' fc-option-code' : '') + '" data-opt="' + i + '"><span class="fc-key">' + (i + 1) + '</span><span>' + (code ? '<code>' + esc(o.text) + '</code>' : rich(o.text)) + '</span></button>';
        });
        html += '</div>';
      }
      html += '<div class="fc-feedback"></div></div>';
      box.innerHTML = html;
      renderStatus();
    }
    /* An ordering card is graded on the first mistake: every pick so far must
       be right, so the card is correct only once the last item is picked. */
    function orderPick(i) {
      if (answered || !cur || !order.items[i]) return;
      var btns = box.querySelectorAll(".fc-order-item");
      var item = order.items[i], wanted = order.picked.length;
      if (item.place === wanted) {
        order.picked.push(i);
        btns[i].classList.add("fc-order-done");
        btns[i].disabled = true;
        btns[i].querySelector(".fc-order-pos").textContent = "#" + (wanted + 1);
        if (order.picked.length < order.items.length) return;
        settle(true);
      } else {
        btns[i].classList.add("fc-wrong");
        for (var k = 0; k < btns.length; k++) {
          btns[k].disabled = true;
          /* reveal every item's real place, so a miss still teaches the order */
          btns[k].querySelector(".fc-order-pos").textContent = "#" + (order.items[k].place + 1);
          if (order.items[k].place === wanted) btns[k].classList.add("fc-right");
        }
        settle(false);
      }
    }
    function showHint() {
      if (!cur || !cur.hint || hinted) return;
      hinted = true;
      var row = box.querySelector(".fc-hint-row"); if (!row) return;
      row.querySelector(".fc-hintbtn").style.display = "none";
      row.querySelector(".fc-hint").innerHTML = rich(cur.hint);
    }
    function answer(i) {
      if (answered || !cur || !options[i]) return;
      var btns = box.querySelectorAll(".fc-option");
      for (var k = 0; k < btns.length; k++) {
        btns[k].disabled = true;
        if (options[k].ok) btns[k].classList.add("fc-right");
        else if (k === i) btns[k].classList.add("fc-wrong");
      }
      settle(options[i].ok);
    }
    /* Record the answer, schedule the card, and show the explanation. Every
       style ends here, having already marked its own buttons. */
    function settle(ok) {
      answered = true;
      var now = clock();
      if (!(cur.id in firstTry)) {
        firstTry[cur.id] = ok;
        if (!ok) missed.push(cur.id);
        if (!practicing) { progress[cur.id] = grade(progress[cur.id], ok, now, hinted); save(); }
      }
      if (ok) done++;
      else queue.splice(Math.min(REQUEUE_GAP, queue.length), 0, cur.id);
      var fb = box.querySelector(".fc-feedback");
      fb.innerHTML = '<div class="fc-verdict ' + (ok ? "fc-v-ok" : "fc-v-bad") + '">' + (ok ? (hinted ? "Correct, with a hint. The card stays where it is on the schedule." : "Correct.") : "Not quite. This card will come back later in the round.") + '</div>' +
        '<p class="fc-explain">' + rich(cur.explain || "") + '</p>' +
        /* a diagnosis card may also carry the change that puts it right */
        (cur.fix ? '<div class="fc-fix"><span class="fc-fix-label">The fix</span><pre><code>' + esc(cur.fix) + '</code></pre></div>' : '') +
        '<div class="fc-actions"><button type="button" class="btn fc-next" data-act="next">Next card</button>' +
        '<a class="fc-source" href="' + esc(cur.href || deck.reference) + '" target="_blank" rel="noopener">' + esc(((deck.basis && deck.basis.tool) || "command") + " reference: " + cur.source) + '</a></div>';
      renderStatus();
    }
    function renderSummary() {
      var right = roundLen - missed.length;
      var html = '<div class="fc-card fc-summary"><div class="fc-idle-title">Round complete: ' + right + ' of ' + roundLen + ' right on the first try.</div>';
      if (missed.length) {
        html += '<p class="fc-explain">' + (practicing ? "Missed in practice (the schedule is unchanged):" : "These cards go back to the start of the schedule and come first in the next round:") + '</p><ul class="fc-missed">';
        missed.forEach(function (id) {
          var c = byId[id], label = c.command ? '<code>' + esc(c.command) + '</code>' : esc(c.prompt || c.question || c.id);
          html += '<li>' + label + '</li>';
        });
        html += '</ul>';
      }
      html += '<div class="fc-actions"><button type="button" class="btn" data-act="start">Next round</button></div></div>';
      box.innerHTML = html; cur = null;
      renderStatus();
    }
    function onClick(e) {
      var t = e.target;
      while (t && t !== root && !(t.getAttribute && (t.getAttribute("data-opt") !== null || t.getAttribute("data-item") !== null || t.getAttribute("data-act") !== null))) t = t.parentNode;
      if (!t || t === root) return;
      var opt = t.getAttribute("data-opt"), item = t.getAttribute("data-item"), act = t.getAttribute("data-act");
      if (item !== null && item !== undefined) orderPick(parseInt(item, 10));
      else if (opt !== null && opt !== undefined) answer(parseInt(opt, 10));
      else if (act === "hint") showHint();
      else if (act === "next") next();
      else if (act === "start") startRound(false);
      else if (act === "practice") startRound(true);
      else if (act === "reset-progress") {
        if (!opts.confirm || opts.confirm("Reset all progress for this deck?")) { progress = {}; save(); startRound(false); }
      }
    }
    function onKey(e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || "")) return;
      if (cur && !answered && styleOf(cur) === "order" && /^[1-9]$/.test(e.key)) { orderPick(parseInt(e.key, 10) - 1); e.preventDefault(); }
      else if (cur && !answered && /^[1-4]$/.test(e.key)) { answer(parseInt(e.key, 10) - 1); e.preventDefault(); }
      else if (cur && !answered && (e.key === "h" || e.key === "H")) { showHint(); e.preventDefault(); }
      else if (cur && answered && e.key === "Enter") { next(); e.preventDefault(); }
    }
    root.addEventListener("click", onClick);
    if (opts.keyTarget) opts.keyTarget.addEventListener("keydown", onKey);
    startRound(false);
    return { answer: answer, next: next, state: function () { return { queue: queue.slice(), cur: cur && cur.id, options: options, progress: progress, missed: missed.slice() }; } };
  }

  var api = { mount: mount, buildRound: buildRound, grade: grade, stats: stats, INTERVAL_DAYS: INTERVAL_DAYS };
  if (typeof window !== "undefined") window.FlashCards = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
