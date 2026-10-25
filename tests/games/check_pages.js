// Mount the new site pages in jsdom and check what their scripts do.
// Run from the project root: node tests/games/check_pages.js http://127.0.0.1:8891
const { JSDOM } = require("jsdom");
const BASE = process.argv[2] || "http://127.0.0.1:8891";
let failures = 0;
function report(name, errors) {
  console.log("%s %s", name.padEnd(34), errors.length ? "FAIL: " + errors.join("; ") : "ok");
  failures += errors.length ? 1 : 0;
}
async function page(path, seed) {
  const html = await (await fetch(BASE + path)).text();
  const dom = new JSDOM(html, { url: BASE + path, runScripts: "outside-only" });
  if (seed) Object.entries(seed).forEach(([k, v]) => dom.window.localStorage.setItem(k, JSON.stringify(v)));
  // run the page's inline scripts after storage is seeded, as a browser would on load
  dom.window.document.querySelectorAll("script:not([src])").forEach(s => dom.window.eval(s.textContent));
  return dom;
}

(async () => {
  // progress: seed one deck, one drill and one example, then read the totals back
  {
    const errors = [];
    const dom = await page("/progress", {
      "pdleet-fc-fundamentals": { a: { box: 5, due: 0 }, b: { box: 4, due: 0 }, c: { box: 1, due: 0 } },
      "pdleet-wi-what-if": { x: { right: true, at: 0 }, y: { right: false, at: 0 } },
      "pdleet.floorplan.progress": { 1: true, 2: true, 3: true },
    });
    const d = dom.window.document, t = k => d.querySelector('b[data-total="' + k + '"]').textContent;
    if (t("cards") !== "2") errors.push("cards known shows " + t("cards") + ", expected 2");
    if (t("answers") !== "2") errors.push("drill items shows " + t("answers") + ", expected 2");
    if (t("steps") !== "3") errors.push("example steps shows " + t("steps") + ", expected 3");
    const row = d.querySelector('[data-key="pdleet-fc-fundamentals"] .pg-num').textContent;
    if (!/^2 known, 3 seen of \d+$/.test(row)) errors.push("deck row reads: " + row);
    const untouched = d.querySelector('[data-key="pdleet-ou-over-under"] .pg-num').textContent;
    if (untouched !== "not started") errors.push("an untouched drill reads: " + untouched);
    report("progress page", errors);
  }
  // glossary: search narrows the list, a subject filter hides other subjects
  {
    const errors = [];
    const dom = await page("/glossary");
    const d = dom.window.document, input = d.querySelector(".gl-search");
    const visible = () => [...d.querySelectorAll(".gl-term")].filter(e => e.style.display !== "none").length;
    const all = visible();
    input.value = "layout versus schematic";
    input.dispatchEvent(new dom.window.Event("input"));
    if (visible() < 1 || visible() >= all) errors.push("search left " + visible() + " of " + all);
    input.value = "";
    input.dispatchEvent(new dom.window.Event("input"));
    d.querySelector('.gl-cats button[data-cat="power"]').click();
    const shown = [...d.querySelectorAll(".gl-term")].filter(e => e.style.display !== "none");
    if (!shown.length || shown.some(e => e.closest(".gl-cat").getAttribute("data-cat") !== "power"))
      errors.push("the subject filter shows terms from other subjects");
    report("glossary page", errors);
  }
  // data: the design filter hides the other designs' rows
  {
    const errors = [];
    const dom = await page("/data");
    const d = dom.window.document;
    const btn = d.querySelector('.dt-filter button[data-design="ibex"]');
    if (!btn) errors.push("no ibex filter");
    else {
      btn.click();
      const rows = [...d.querySelectorAll(".dt-table tr[data-design]")].filter(r => r.style.display !== "none");
      if (!rows.length || rows.some(r => r.getAttribute("data-design") !== "ibex")) errors.push("filter leaks other designs");
    }
    report("open data page", errors);
  }
  // copy reference: select a sentence in a reading page and read back what the button copies
  {
    const errors = [];
    const dom = await page("/education/static-timing-analysis");
    const d = dom.window.document, w = dom.window;
    w.eval(await (await fetch(BASE + "/static/tutor-ref.js")).text());
    const para = [...d.querySelectorAll("main p")].find(p => p.textContent.trim().length > 120 && [...d.querySelectorAll("main h2")].some(h => h.compareDocumentPosition(p) & w.Node.DOCUMENT_POSITION_FOLLOWING));
    const heading = (() => { let h = ""; for (const x of d.querySelectorAll("main h2, main h3, main h4"))
      { if (x.compareDocumentPosition(para) & w.Node.DOCUMENT_POSITION_FOLLOWING) h = x.textContent.trim(); } return h; })();
    const node = [...para.childNodes].find(n => n.nodeType === 3 && n.textContent.trim().length > 40) || para.firstChild;
    const range = d.createRange();
    range.setStart(node, 0); range.setEnd(node, Math.min(60, node.textContent.length));
    w.getSelection().removeAllRanges(); w.getSelection().addRange(range);
    d.dispatchEvent(new w.MouseEvent("mouseup", { bubbles: true }));
    await new Promise(r => setTimeout(r, 20));
    const btn = d.querySelector(".tref-btn");
    if (!btn) errors.push("no Copy reference button after selecting text");
    else {
      const ref = btn.getAttribute("data-ref");
      // quote, source line, and optionally the text around the passage
      const m = ref.match(/^> "(.+?)"\n> \(Chipbase: (.+), (http\S+)\)\n(?:> Around it: ".+"\n)?$/s);
      if (!m) errors.push("reference is not in the expected shape: " + JSON.stringify(ref));
      else {
        if (!m[3].endsWith("/education/static-timing-analysis")) errors.push("wrong page address: " + m[3]);
        if (heading && !m[2].includes(heading.replace(/\s+/g, " "))) errors.push("source line lacks the section heading: " + m[2]);
        require("fs").writeFileSync(process.env.REF_OUT || "/tmp/chipbase-ref.txt", ref);
      }
    }
    // a selection in the navigation bar must not offer a reference
    const nav = d.querySelector("nav a");
    const r2 = d.createRange(); r2.selectNodeContents(nav);
    w.getSelection().removeAllRanges(); w.getSelection().addRange(r2);
    d.dispatchEvent(new w.MouseEvent("mouseup", { bubbles: true }));
    await new Promise(r => setTimeout(r, 20));
    if (d.querySelector(".tref-btn")) errors.push("the button appears for a selection outside the page content");
    report("copy reference button", errors);
  }
  // tutor setup: every command box gets a copy button, the client tabs switch,
  // the commands name this site, and the download is a zip
  {
    const errors = [];
    const dom = await page("/tutor");
    const d = dom.window.document;
    const boxes = d.querySelectorAll(".tu-code"), copies = d.querySelectorAll(".tu-code .tu-copy");
    if (!boxes.length || copies.length !== boxes.length) errors.push(copies.length + " copy buttons for " + boxes.length + " command boxes");
    // a local server names itself; the frozen site names its published address
    const cmd = d.querySelector('.tu-pane[data-pane="code"] pre').textContent;
    if (!cmd.includes("CHIPBASE_URL=" + BASE) && !cmd.includes("CHIPBASE_URL=https://samcooper01.github.io"))
      errors.push("the Claude Code command does not name this site");
    d.querySelector('.tu-tabs button[data-pane="desktop"]').click();
    const on = [...d.querySelectorAll(".tu-pane")].filter(p => p.classList.contains("is-on")).map(p => p.getAttribute("data-pane"));
    if (on.join() !== "desktop") errors.push("tabs show: " + on.join());
    const dlLink = d.querySelector('a[href^="/tutor/"][href$=".zip"]');
    if (!dlLink) errors.push("no download link to a zip");
    const dl = await fetch(BASE + (dlLink ? dlLink.getAttribute("href") : "/tutor/missing.zip"));
    const bytes = new Uint8Array(await dl.arrayBuffer());
    if (dl.headers.get("content-type") !== "application/zip" || bytes[0] !== 0x50 || bytes[1] !== 0x4b) errors.push("download is not a zip");
    const home = await (await fetch(BASE + "/")).text();
    if (!/href="\/tutor"/.test(home)) errors.push("the front page does not link to /tutor");
    report("tutor setup page", errors);
  }
  // front page: a card for every section, and every link on it resolves
  {
    const errors = [];
    const dom = await page("/");
    const d = dom.window.document;
    const titles = [...d.querySelectorAll(".hc-card .hc-title")].map(e => e.textContent.trim());
    for (const want of ["Education", "Methods and algorithms", "Foundry processes", "Glossary", "Problems", "Sandboxes", "Games"])
      if (!titles.includes(want)) errors.push("no card for " + want);
    const bands = [...d.querySelectorAll("main > section")];
    if (!bands[0] || !bands[0].classList.contains("hc-hero-band")) errors.push("the hero is not the first band on the page");
    const banner = d.querySelector("#challenge");
    if (!banner || bands.indexOf(banner) !== 1) errors.push("the challenge banner does not follow the hero");
    // the helpers band is optional; when it is there it names all three
    const helpers = [...d.querySelectorAll(".hc-helper b")].map(e => e.textContent.trim());
    if (helpers.length) for (const want of ["Tutor", "Progress", "Open data"]) if (!helpers.includes(want)) errors.push("no helper for " + want);
    if (!d.getElementById("everything")) errors.push("the Browse everything anchor has no target");
    const links = [...new Set([...d.querySelectorAll("main a[href^='/']")].map(a => a.getAttribute("href").split("#")[0]))];
    for (const href of links) {
      const r = await fetch(BASE + href);
      await r.arrayBuffer(); // read it through; an unread body can trip Node's client on a server that closes the connection
      if (r.status !== 200) errors.push(href + " returns " + r.status);
    }
    report("front page (" + links.length + " links)", errors);
  }
  // the tutor demo's timeline runs: it starts on the page scene, has moved to the copy
  // scene after two seconds, and the page's scripts throw nothing on the way
  {
    const errors = [];
    const dom = await page("/");
    const d = dom.window.document, demo = d.querySelector(".hc-demo");
    if (!demo) errors.push("no tutor demo on the front page");
    else {
      const first = demo.getAttribute("data-scene");
      await new Promise(r => setTimeout(r, 2200));
      const later = demo.getAttribute("data-scene");
      if (first !== "1") errors.push("demo starts on scene " + first);
      if (later !== "2" || !demo.classList.contains("is-selected")) errors.push("after two seconds the demo is on scene " + later);
      if (d.querySelector(".hc-demo-q").textContent.indexOf("Setup and hold: the two checks") < 0) errors.push("the demo's reference is not the real one");
    }
    dom.window.close();
    report("tutor demo timeline", errors);
  }
  console.log(failures ? "\n" + failures + " failures" : "\nall pages pass");
  process.exit(failures ? 1 : 0);
})();
