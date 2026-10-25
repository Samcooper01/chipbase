/* Play every drill through the real pages in a browser-like DOM.
 *
 *   node tests/games/play_drills.js [base-url]      (default http://127.0.0.1:8891)
 *
 * The content validator checks what the files say; this checks what a player
 * gets: that every card renders, that the answer the content calls correct is
 * actually among the options and grades as correct, that the two graders in
 * the what-happens-if drill agree, and that a wrong answer is marked wrong.
 * Needs jsdom:  npm install jsdom   (or run with NODE_PATH pointing at one)
 */
const { JSDOM, VirtualConsole } = require("jsdom");
const http = require("http");
const BASE = process.argv[2] || "http://127.0.0.1:8891";

const get = url => new Promise((res, rej) => {
  http.get(url, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => res(b)); }).on("error", rej);
});
async function page(url) {
  const errors = []; const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push(e.message));
  const dom = await JSDOM.fromURL(url, { runScripts: "dangerously", resources: "usable",
    virtualConsole: vc, pretendToBeVisual: true });
  await new Promise(r => dom.window.addEventListener("load", r));
  const d = dom.window.document;
  return { dom, d, errors, $: q => d.querySelector(q), $$: q => [...d.querySelectorAll(q)] };
}
const norm = t => t.replace(/`/g, "");
let failures = 0;
function report(name, played, errors) {
  if (errors.length) failures += errors.length;
  console.log(name.padEnd(34), "played", String(played).padStart(3),
    errors.length ? "| FAIL: " + errors.join("; ") : "| ok");
}

async function playCards(url, name, rounds = 3) {
  const { dom, $, $$, errors } = await page(url);
  const data = JSON.parse($("#fc-deck").textContent), by = {};
  data.cards.forEach(c => by[c.id] = c);
  const seen = new Set();
  let guard = 0;
  while (seen.size < data.cards.length && guard++ < data.cards.length * 4) {
    if (!$(".fc-option") && !$(".fc-order-item")) {
      const start = $("[data-act=start]") || $("[data-act=practice]");
      if (!start) break;
      start.click(); continue;
    }
    const card = $(".fc-card"), c = by[card.getAttribute("data-card")];
    const style = card.getAttribute("data-style");
    seen.add(c.id);
    if (style === "order") {
      for (const want of c.items) {
        const btn = $$(".fc-order-item").find(b => b.querySelector(".fc-order-text").textContent === want && !b.disabled);
        if (!btn) { errors.push("missing order step in " + c.id); break; }
        btn.click();
      }
      if (!$(".fc-verdict") || !$(".fc-verdict").classList.contains("fc-v-ok")) errors.push("order graded wrong: " + c.id);
    } else {
      const i = $$(".fc-option").findIndex(o => o.textContent.slice(1) === norm(c.answer));
      if (i < 0) { errors.push("answer not among the options: " + c.id); break; }
      $$(".fc-option")[i].click();
      if (!$(".fc-verdict").classList.contains("fc-v-ok")) errors.push("correct answer graded wrong: " + c.id);
    }
    if (!$(".fc-next")) { errors.push("no feedback shown: " + c.id); break; }
    $(".fc-next").click();
  }
  if (seen.size < data.cards.length) errors.push("only reached " + seen.size + " of " + data.cards.length);
  report(name, seen.size, errors);
  dom.window.close();
}

async function playOverUnder(name) {
  const { dom, $, $$, errors } = await page(BASE + "/games/over-under/all");
  const data = JSON.parse($("#ou-data").textContent), by = {};
  data.items.forEach(i => by[i.id] = i);
  const seen = new Set();
  let n = 0;
  while (n < data.items.length * 3) {
    if ($(".fc-idle-title")) {
      if (seen.size >= data.items.length) break;
      $('[data-act="start"]').click();
      continue;
    }
    if (!$(".ou-choice")) break;
    const it = by[$(".ou-card").getAttribute("data-item")];
    seen.add(it.id);
    const want = it.value > it.threshold ? "over" : "under";
    $$(".ou-choice").find(b => b.getAttribute("data-call") === want).click();
    if (!$(".fc-verdict").classList.contains("fc-v-ok")) errors.push("graded wrong: " + it.id);
    if (!$(".ou-scale")) errors.push("no reveal: " + it.id);
    $(".fc-next").click(); n++;
  }
  if (seen.size < data.items.length)
    errors.push("never played: " + data.items.filter(i => !seen.has(i.id)).map(i => i.id).join(", "));
  report(name, seen.size, errors);
  dom.window.close();
}

async function playPathology(name) {
  const { dom, d, $, $$, errors } = await page(BASE + "/games/spot-the-pathology/all");
  const data = JSON.parse($("#pa-data").textContent), by = {};
  data.items.forEach(i => by[i.id] = i);
  const seen = new Set();
  let n = 0;
  // Keep asking for another round until every item has been played once. The
  // page prefers items it has not shown yet, so this terminates quickly.
  while (n < data.items.length * 3) {
    if ($(".fc-idle-title")) {
      if (seen.size >= data.items.length) break;
      $('[data-act="start"]').click();
      continue;
    }
    if (!$(".pa-card")) break;
    const card = $(".pa-card"), it = by[card.getAttribute("data-item")], style = card.getAttribute("data-style");
    if (!$(".pa-img")) errors.push("no image: " + it.id);
    if (style === "name") {
      const i = $$(".fc-option").findIndex(o => o.textContent.slice(1) === norm(it.answer));
      if (i < 0) { errors.push("answer not among the options: " + it.id); break; }
      $$(".fc-option")[i].click();
    } else if (style === "pair") {
      $$(".ou-choice").find(b => b.getAttribute("data-call") === it.answer).click();
    } else {
      const img = $(".pa-img");
      img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 500, right: 500, bottom: 500 });
      const t = it.targets[0];
      img.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true,
        clientX: (t.x + t.w / 2) * 500, clientY: (t.y + t.h / 2) * 500 }));
      if (!$(".pa-overlay").classList.contains("is-shown")) errors.push("no target reveal: " + it.id);
    }
    if (!$(".fc-verdict") || !$(".fc-verdict").classList.contains("fc-v-ok")) errors.push("graded wrong: " + it.id);
    seen.add(it.id);
    $(".fc-next").click(); n++;
  }
  if (seen.size < data.items.length)
    errors.push("never played: " + data.items.filter(i => !seen.has(i.id)).map(i => i.id).join(", "));
  report(name, seen.size, errors);
  dom.window.close();
}

async function playWhatIf(name) {
  const { dom, $, $$, errors } = await page(BASE + "/games/what-if/all");
  const data = JSON.parse($("#wi-data").textContent), by = {};
  data.items.forEach(i => by[i.id] = i);
  const seen = new Set();
  let n = 0;
  while (n < data.items.length * 3) {
    if ($(".fc-idle-title")) {
      if (seen.size >= data.items.length) break;
      $('[data-act="start"]').click();
      continue;
    }
    if (!$(".wi-option")) break;
    const it = by[$(".wi-card").getAttribute("data-item")];
    seen.add(it.id);
    if (dom.window.WhatIf.winner(it) !== it.best) errors.push("the two graders disagree: " + it.id);
    const pick = $$(".wi-option").find(b => b.getAttribute("data-choice") === it.best);
    if (!pick) { errors.push("best option not on the card: " + it.id + " wants " + it.best + ", card shows " + $$(".wi-option").map(b => b.getAttribute("data-choice")).join("/")); $$(".wi-option")[0].click(); $(".fc-next").click(); n++; continue; }
    pick.click();
    if (!$(".fc-verdict").classList.contains("fc-v-ok")) errors.push("best option graded wrong: " + it.id);
    if ($$(".wi-row").length !== it.options.length) errors.push("outcome table incomplete: " + it.id);
    $(".fc-next").click(); n++;
  }
  if (seen.size < data.items.length)
    errors.push("never played: " + data.items.filter(i => !seen.has(i.id)).map(i => i.id).join(", "));
  report(name, seen.size, errors);
  dom.window.close();
}

async function checkWrongAnswer() {
  const { dom, $, $$, errors } = await page(BASE + "/games/over-under/all");
  const data = JSON.parse($("#ou-data").textContent);
  const it = data.items.find(i => i.id === $(".ou-card").getAttribute("data-item"));
  const wrong = it.value > it.threshold ? "under" : "over";
  $$(".ou-choice").find(b => b.getAttribute("data-call") === wrong).click();
  if (!$(".fc-verdict").classList.contains("fc-v-bad")) errors.push("a wrong answer was not marked wrong");
  report("a wrong answer is marked wrong", 1, errors);
  dom.window.close();
}

(async () => {
  for (const deck of ["sdc", "liberty", "tcl", "cells", "formats", "fundamentals",
                      "openroad", "orfs", "signoff", "timing-reports"]) {
    await playCards(`${BASE}/games/flash-cards/${deck}/all`, "flash cards: " + deck);
  }
  for (const stage of ["setup", "synthesis", "constraints", "placement", "cts",
                       "timing", "routing", "signoff", "infra"]) {
    await playCards(`${BASE}/games/log-forensics/${stage}`, "forensics: " + stage);
  }
  await playOverUnder("over / under");
  await playPathology("spot the pathology");
  await playWhatIf("what happens if");
  await checkWrongAnswer();
  console.log(failures ? "\n" + failures + " failures" : "\neverything passes");
  process.exit(failures ? 1 : 0);
})();
