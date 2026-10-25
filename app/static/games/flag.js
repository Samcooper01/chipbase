/* Flagging, shared by every drill.

   The drills render their own cards, so rather than reach into three engines
   this watches the page for whichever card is on screen and reads its id. A
   card is found by the attribute its engine already sets: data-card on a
   flash card or a forensics case, data-item on a summary or a map.

   Nothing here changes content. A flag becomes a GitHub issue on the site's
   repository: sending opens GitHub's new-issue page in a new tab with the
   drill, the item, the page and the note already filled in, and the flag is
   raised when it is submitted there. The issues list is the review queue.
   The address comes from the page's chipbase-issues meta tag (base.html). */
(function () {
  "use strict";
  function currentItem(root) {
    root = root || document;
    var el = root.querySelector("[data-card], [data-item]");
    if (!el) return null;
    return el.getAttribute("data-card") || el.getAttribute("data-item");
  }
  function issueUrl(body) {
    var meta = document.querySelector('meta[name="chipbase-issues"]');
    var base = meta ? meta.getAttribute("content") : "";
    var q = new URLSearchParams({
      template: "flag-question.yml",
      title: "Flag: " + body.drill + " / " + body.item,
      drill: body.drill,
      item: body.item,
      page: body.page,
      note: body.note,
    });
    return base + "/new?" + q.toString();
  }
  function mount(root, drill, opts) {
    opts = opts || {};
    var post = opts.post || function (body) {
      window.open(issueUrl(body), "_blank", "noopener");
    };
    var bar = document.createElement("div");
    bar.className = "fg-bar";
    bar.innerHTML = '<button type="button" class="fg-open">flag this one</button>' +
      '<form class="fg-form" hidden><label class="fg-label" for="fg-note">What looks wrong?</label>' +
      '<input class="fg-note" id="fg-note" type="text" maxlength="200" placeholder="optional, one line">' +
      '<button type="submit" class="fg-send">open on GitHub</button>' +
      '<button type="button" class="fg-cancel">cancel</button></form>' +
      '<span class="fg-said" hidden>Opened in a new tab. Submit the issue there to send the flag.</span>';
    root.appendChild(bar);
    var open = bar.querySelector(".fg-open"), form = bar.querySelector(".fg-form"),
        note = bar.querySelector(".fg-note"), said = bar.querySelector(".fg-said");
    open.addEventListener("click", function () {
      form.hidden = false; open.hidden = true; said.hidden = true; note.value = ""; note.focus();
    });
    bar.querySelector(".fg-cancel").addEventListener("click", function () {
      form.hidden = true; open.hidden = false;
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var item = currentItem(root.parentNode || root) || currentItem(document);
      if (!item) return;
      post({ drill: drill, item: item, note: note.value, page: window.location.href });
      form.hidden = true; open.hidden = false; said.hidden = false;
    });
    return { currentItem: function () { return currentItem(document); } };
  }
  var api = { mount: mount, currentItem: currentItem, issueUrl: issueUrl };
  if (typeof window !== "undefined") window.Flag = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
