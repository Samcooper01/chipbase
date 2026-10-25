// Renders the two cuts of the card at twice their size: docs/banner/banner.html to
// docs/banner.png (the README strip) and linkedin.html to app/static/preview.png (the
// 1200x627 the site's og:image points at, which is what link previews show).
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
  // two cuts of the same card: the README strip, and the 1200x627 the link
  // previews read from og:image
  // the preview renders at 1x, so the file is exactly the 1200x627 its og:image tags claim
  for (const [source, size, scale, out] of [
    ["banner.html", { width: 1200, height: 420 }, 2, join(HERE, "..", "banner.png")],
    ["linkedin.html", { width: 1200, height: 627 }, 1, join(ROOT, "app", "static", "preview.png")],
  ]) {
    let page = readFileSync(join(HERE, source), "utf8");
    for (const [key, value] of Object.entries(slots)) page = page.replaceAll(`{{${key}}}`, value);
    const cut = await browser.newPage({ viewport: size, deviceScaleFactor: scale });
    await cut.setContent(page, { waitUntil: "load" });
    await cut.evaluate(() => document.fonts.ready);
    await cut.screenshot({ path: out });
    console.log(out);
  }
} finally {
  await browser.close();
}
