// End-to-end check of grading in real browsers (Playwright): the problem
// pages, the module worker, the WebAssembly Tcl runtime, the timeout, and
// the record of solved problems in browser storage.
//
//   PORT=8891 ./run.sh &                      # or any running copy, or the frozen site
//   cd tests/grader && npm install && npx playwright install firefox chromium webkit
//   BASE=http://127.0.0.1:8891 node browser_grade.mjs [firefox chromium webkit]

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as pw from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = process.env.BASE || "http://127.0.0.1:8891";
const ENGINES = process.argv.slice(2).length ? process.argv.slice(2) : ["firefox", "chromium", "webkit"];

const solution = (id, file) => readFileSync(join(ROOT, "problems", id, "solution", file), "utf8");
let failures = 0;
function check(ok, what) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures++;
}

async function submit(page, text, button = "#btn-submit") {
  if (text !== null) {
    await page.evaluate((t) => document.querySelector(".CodeMirror").CodeMirror.setValue(t), text);
  }
  await page.evaluate(() => { const r = document.getElementById("results"); r.innerHTML = ""; r.classList.add("hidden"); });
  await page.click(button);
  await page.waitForSelector("#results:not(.hidden) .banner", { timeout: 30000 });
  return page.textContent("#results");
}

for (const name of ENGINES) {
  console.log(name);
  let browser;
  try {
    browser = await pw[name].launch();
  } catch (err) {
    console.log(`  SKIP ${name} did not start: ${String(err.message).split("\n")[0]}`);
    continue;
  }
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // a script problem: the Tcl runtime in a worker
  await page.goto(`${BASE}/problem/script-count-masters`);
  check(await page.isHidden("#solved-chip"), "not marked solved before any submission");
  let text = await submit(page, solution("script-count-masters", "script.tcl"));
  check(text.includes("Accepted") && text.includes("100 / 100"), "reference solution is accepted with full points");
  check(text.includes("saved in this browser"), "a submission says it was saved");
  check(await page.isVisible("#solved-chip"), "the solved chip appears after an accepted submission");
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem("pdleet-problems") || "{}"));
  check(rec["script-count-masters"] && rec["script-count-masters"].status === "solved", "the browser record says solved");

  text = await submit(page, "puts {BUF_X1 99}\nerror {deliberate}");
  check(text.includes("Grading error") && text.includes("deliberate"), "a Tcl error is reported with its message");
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("pdleet-problems") || "{}"));
  check(after["script-count-masters"].status === "solved", "a later failing run does not unsolve the problem");

  const t0 = Date.now();
  text = await submit(page, "while 1 {}", "#btn-run");
  const took = (Date.now() - t0) / 1000;
  check(text.includes("did not finish within 10 seconds"), `an infinite loop is stopped (after ${took.toFixed(1)} s)`);
  text = await submit(page, solution("script-count-masters", "script.tcl"), "#btn-run");
  check(text.includes("Accepted") && !text.includes("saved in this browser"), "a fresh worker grades the next run; Run does not save");

  // an exact-output language problem, and a sim problem, and the quiz
  await page.goto(`${BASE}/problem/tcl-procs`);
  text = await submit(page, solution("tcl-procs", "script.tcl"));
  check(text.includes("Accepted"), "tcl-procs reference solution is accepted");
  await page.goto(`${BASE}/problem/fp-core-size`);
  text = await submit(page, solution("fp-core-size", "floorplan.tcl"));
  check(text.includes("Accepted"), "fp-core-size (a sim problem, no Tcl runtime) is accepted");
  text = await submit(page, "set core_width 0\nset core_height 10");
  check(text.includes("below the sane minimum of 1.0"), "a sim problem's own message comes through word for word");
  await page.goto(`${BASE}/problem/sta-slack-quiz`);
  await page.fill("#numeric-answer", "205");
  text = await submit(page, null);
  check(text.includes("Accepted"), "the quiz accepts the right answer");

  // the OpenROAD problem explains itself instead of grading
  await page.goto(`${BASE}/problem/or-gcd-floorplan`);
  check((await page.$("#btn-submit")) === null, "the OpenROAD problem has no grade buttons");
  check((await page.textContent(".banner-warn")).includes("cannot run in a"), "the OpenROAD problem says why");

  // the record shows up elsewhere
  await page.goto(`${BASE}/progress`);
  const solvedCount = await page.textContent('[data-total="solved"]');
  check(solvedCount === "4", `the progress page counts 4 solved (says ${solvedCount})`);
  await page.goto(`${BASE}/`);
  const prog = await page.textContent("[data-progress-of]");
  check(/^4 of \d+ solved$/.test(prog.trim()), `the front page shows the solved count (${prog.trim()})`);

  check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join("; ") : ""));
  await browser.close();
}

console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
