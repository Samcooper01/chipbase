/* Copy reference: highlight a passage anywhere in a page's main content and a
   small button offers to copy it as a reference for the chipbase-tutor MCP
   (Model Context Protocol) server. The reference is a plain quote plus a
   source line, so it reads sensibly to any model even without the server:

     > "the highlighted passage"
     > (Chipbase: Static Timing Analysis > Setup and hold, http://host/education/static-timing-analysis)
     > Around it: "...the text around the passage on the page..."

   The server finds the passage on that page and returns the section around
   it. The heading in the source line is only for the reader; the server
   locates the quote itself, so a renamed heading does not break anything. */
(function () {
  var MIN = 3, MAX = 1500;
  var btn = null, hideTimer = null;

  function main() { return document.querySelector("main"); }

  function injectStyle() {
    if (document.getElementById("tref-style")) return;
    var st = document.createElement("style");
    st.id = "tref-style";
    st.textContent =
      ".tref-btn{position:absolute;z-index:60;font:600 12px/1 var(--mono,monospace);padding:7px 10px;" +
      "border:2px solid var(--navy,#16241b);border-radius:8px;background:var(--panel,#fff);color:var(--text,#16241b);" +
      "box-shadow:3px 3px 0 var(--shadow-hard,rgba(0,0,0,.8));cursor:pointer;white-space:nowrap}" +
      ".tref-btn:hover{background:var(--panel-2,#f0efe9)}" +
      ".tref-btn.is-done{border-color:var(--green,#16a34a);color:var(--green-deep,#15803d)}";
    document.head.appendChild(st);
  }

  function pageTitle() {
    var h1 = main() && main().querySelector("h1");
    var t = h1 ? h1.textContent : document.title;
    return t.replace(/\s+/g, " ").replace(/\s*-\s*Chipbase.*$|^Chipbase\s*-\s*/, "").trim();
  }

  /* the nearest heading above the start of the selection, in document order */
  function headingBefore(node) {
    var heads = main() ? main().querySelectorAll("h2, h3, h4") : [];
    var found = "";
    for (var i = 0; i < heads.length; i++) {
      var pos = heads[i].compareDocumentPosition(node);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING || heads[i].contains(node)) found = heads[i].textContent;
      else break;
    }
    return found.replace(/\s+/g, " ").trim();
  }

  /* The text around the passage, read from the page as the browser built it.
     Some pages draw their content in the browser, and the tutor, which reads
     the page as the server sends it, cannot see that content; this line gives
     it the passage's surroundings anyway. The passage's own block (a paragraph,
     list item, caption, table cell), widened to the block around it while it
     is short, then cut to about CONTEXT characters centred on the passage. */
  var CONTEXT = 700, BLOCKS = "p, li, dd, dt, td, th, figcaption, blockquote, pre, summary, h1, h2, h3, h4, h5, h6, section, article, div";
  function around(sel, text) {
    var node = sel.getRangeAt(0).commonAncestorContainer;
    var el = node.nodeType === 1 ? node : node.parentElement;
    el = el && el.closest(BLOCKS);
    var root = main();
    while (el && el !== root && el.textContent.replace(/\s+/g, " ").trim().length < 240) {
      var up = el.parentElement && el.parentElement.closest(BLOCKS);
      if (!up || !root.contains(up)) break;
      el = up;
    }
    if (!el || !root.contains(el)) return "";
    var all = el.textContent.replace(/\s+/g, " ").trim();
    if (all.length <= text.length + 40) return "";               /* nothing beyond the passage itself */
    if (all.length <= CONTEXT) return all;
    var at = Math.max(0, all.indexOf(text.slice(0, 60)));
    var from = Math.max(0, Math.min(at - (CONTEXT - text.length) / 2, all.length - CONTEXT));
    var cut = all.slice(from, from + CONTEXT);
    if (from > 0) cut = "..." + cut.replace(/^\S*\s/, "");
    if (from + CONTEXT < all.length) cut = cut.replace(/\s\S*$/, "") + "...";
    return cut;
  }

  function build(sel) {
    var text = sel.toString().replace(/\s+/g, " ").trim();
    if (text.length > MAX) text = text.slice(0, MAX).replace(/\s+\S*$/, "") + " ...";
    var start = sel.getRangeAt(0).startContainer;
    var head = headingBefore(start), title = pageTitle();
    var where = head && head !== title ? title + " > " + head : title;
    var url = location.origin + location.pathname;
    var ctx = around(sel, text);
    return '> "' + text + '"\n> (Chipbase: ' + where + ", " + url + ")\n" +
      (ctx ? '> Around it: "' + ctx.replace(/"/g, "'") + '"\n' : "");
  }

  function usable(sel) {
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
    if (sel.toString().replace(/\s+/g, " ").trim().length < MIN) return false;
    var node = sel.getRangeAt(0).commonAncestorContainer;
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || !main() || !main().contains(el)) return false;
    return !el.closest("input, textarea, select, button, .tref-btn");
  }

  function hide() { if (btn) { btn.remove(); btn = null; } }

  function copy(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    } else { fallback(text); done(); }
  }
  function fallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }

  function show(sel) {
    injectStyle();
    hide();
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect ? range.getBoundingClientRect() : { bottom: 0, left: 0 };
    var ref = build(sel);
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tref-btn";
    btn.textContent = "Copy reference";
    btn.title = "Copy this passage as a quote your tutor can look up";
    btn.style.top = (window.scrollY + rect.bottom + 8) + "px";
    btn.style.left = Math.max(8, window.scrollX + rect.left) + "px";
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); });  /* keep the selection */
    btn.addEventListener("click", function () {
      copy(ref, function () {
        btn.textContent = "Copied: paste it to your tutor";
        btn.classList.add("is-done");
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, 1800);
      });
    });
    btn.setAttribute("data-ref", ref);
    document.body.appendChild(btn);
  }

  function check() {
    var sel = window.getSelection();
    if (usable(sel)) show(sel); else hide();
  }

  document.addEventListener("mouseup", function (e) {
    if (btn && btn.contains(e.target)) return;
    setTimeout(check, 0);
  });
  document.addEventListener("keyup", function (e) { if (e.shiftKey || e.key === "Shift") check(); });

  window.TutorRef = { build: build, usable: usable, check: check };
})();
