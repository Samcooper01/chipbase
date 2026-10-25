/* Filtering for algorithm catalog pages: by family (type) and by level
   (basic / advanced / industry). State mirrors into URL query parameters
   so filtered views are shareable. */

(function () {
  "use strict";

  var familyBar = document.getElementById("filter-family");
  var levelBar = document.getElementById("filter-level");
  var scopeBar = document.getElementById("filter-scope");
  var countEl = document.getElementById("filter-count");
  if (!familyBar || !levelBar) return;

  var state = { family: "all", level: "all", scope: "all" };

  function matches(el) {
    var okFamily =
      state.family === "all" || el.dataset.family === state.family;
    var okLevel =
      state.level === "all" || el.dataset.level === state.level;
    /* entries tagged 'both' match either scope selection */
    var okScope =
      state.scope === "all" ||
      el.dataset.scope === state.scope ||
      el.dataset.scope === "both";
    return okFamily && okLevel && okScope;
  }

  function applyFilters() {
    var shown = 0;
    var total = 0;
    /* one card per entry; a card carries its algorithm's lab link, so the
       two show and hide together */
    document.querySelectorAll(".algo-card").forEach(function (card) {
      total += 1;
      var visible = matches(card);
      card.style.display = visible ? "" : "none";
      if (visible) shown += 1;
    });
    /* hide family sections with nothing visible in them */
    document.querySelectorAll(".algo-section").forEach(function (section) {
      var any = Array.prototype.some.call(
        section.querySelectorAll(".algo-card"),
        function (c) { return c.style.display !== "none"; }
      );
      section.style.display = any ? "" : "none";
    });
    var noun = countEl.dataset.noun || "algorithms";
    countEl.textContent =
      shown === total ? total + " " + noun : shown + " of " + total + " shown";

    /* shareable URL */
    var params = new URLSearchParams();
    if (state.family !== "all") params.set("family", state.family);
    if (state.level !== "all") params.set("level", state.level);
    if (state.scope !== "all") params.set("scope", state.scope);
    var qs = params.toString();
    history.replaceState(null, "",
      window.location.pathname + (qs ? "?" + qs : ""));
  }

  function wire(bar, key, dataName) {
    bar.querySelectorAll(".seg-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        bar.querySelectorAll(".seg-btn").forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        state[key] = btn.dataset[dataName];
        applyFilters();
      });
    });
  }

  wire(familyBar, "family", "family");
  wire(levelBar, "level", "level");
  if (scopeBar) wire(scopeBar, "scope", "scope");

  /* restore filters from the URL */
  var params = new URLSearchParams(window.location.search);
  var bars = { family: familyBar, level: levelBar, scope: scopeBar };
  ["family", "level", "scope"].forEach(function (key) {
    var value = params.get(key);
    if (!value) return;
    var bar = bars[key];
    if (!bar) return;
    var btn = bar.querySelector(".seg-btn[data-" + key + "='" + value + "']");
    if (btn) {
      bar.querySelectorAll(".seg-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      state[key] = value;
    }
  });

  applyFilters();
})();
