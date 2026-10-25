// Renders the README banner, docs/banner/banner.html, to docs/banner.png at twice its size.
//
// The screenshot in it is the macro placement lab, taken from the site itself: the live site
// by default, or the address given as the first argument (a local server, for example
// http://127.0.0.1:8888/). Fonts and images are inlined as data URIs first, because a page
// opened from a file cannot load them by path. Uses the Playwright install of the browser
// tests: run `npm install` and `npx playwright install chromium` in tests/grader once.
//
//   node docs/banner/render.mjs [site address]

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const { chromium } = createRequire(join(ROOT, "tests", "grader", "package.json"))("playwright");
const SITE = (process.argv[2] || "https://samcooper01.github.io/chipbase/").replace(/\/?$/, "/");

const dataUri = (bytes, mime) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
const file = (...parts) => readFileSync(join(ROOT, ...parts));

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
try {
  // the lab as a visitor works in it: the canvas and its checks, just below the site's bar
  const lab = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await lab.goto(SITE + "lab/macro-placement-1/", { waitUntil: "networkidle" });
  await lab.evaluate(() => {
    const bar = document.querySelector("header, nav");
    const top = document.getElementById("mp-root").getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top - (bar ? bar.getBoundingClientRect().height : 0) - 10);
  });
  await lab.waitForTimeout(500);
  const shot = await lab.screenshot();

  const slots = {
    INTER: dataUri(file("app", "static", "vendor", "fonts", "inter-var-latin.woff2"), "font/woff2"),
    MONO: dataUri(file("app", "static", "vendor", "fonts", "jetbrains-mono-var-latin.woff2"), "font/woff2"),
    LOGO: dataUri(file("app", "static", "favicon.svg"), "image/svg+xml"),
    SHOT: dataUri(shot, "image/png"),
  };
  let html = readFileSync(join(HERE, "banner.html"), "utf8");
  for (const [key, value] of Object.entries(slots)) html = html.replaceAll(`{{${key}}}`, value);

  const banner = await browser.newPage({ viewport: { width: 1200, height: 420 }, deviceScaleFactor: 2 });
  await banner.setContent(html, { waitUntil: "load" });
  await banner.evaluate(() => document.fonts.ready);
  const out = join(HERE, "..", "banner.png");
  await banner.screenshot({ path: out });
  console.log(out);
} finally {
  await browser.close();
}
