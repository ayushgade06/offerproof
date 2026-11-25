// Captures the 5 submission screenshots + OG image from a running deployment.
// Usage: BASE=https://offerproof-two.vercel.app node scripts/submission-shots.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const B = process.env.BASE || "https://offerproof-two.vercel.app";
mkdirSync("docs", { recursive: true });
const browser = await chromium.launch();

async function page(w, h, scale = 1, scheme = "light") {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, colorScheme: scheme, reducedMotion: "reduce" });
  return ctx.newPage();
}
async function runSample(p, name) {
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.getByRole("button", { name }).click();
  await p.locator("#verdict-title").waitFor({ timeout: 60000 });
  await p.waitForTimeout(1200);
}

// 1. Hero with input
let p = await page(1600, 1000);
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.screenshot({ path: "docs/1-hero.png" });

// 2. Results for sample 1, desktop (with a highlight active)
await runSample(p, /Internship with a fee/);
await p.evaluate(() => window.scrollTo(0, 0));
await p.locator("mark").nth(1).hover();
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(300);
await p.screenshot({ path: "docs/2-result-desktop.png" });
await p.screenshot({ path: "docs/screenshot-result.png" });

// OG image 1200x630
const og = await page(1200, 630, 1);
await runSample(og, /Internship with a fee/);
await og.screenshot({ path: "app/opengraph-image.png" });

// 3. Screenshot sample, mobile
const m = await page(390, 844, 2);
await runSample(m, /Telegram task job/);
await m.screenshot({ path: "docs/3-screenshot-result-mobile.png", fullPage: false });

// 4. Accuracy section
await p.goto(B + "/how-it-works", { waitUntil: "networkidle" });
await p.locator("#accuracy").scrollIntoViewIfNeeded();
await p.evaluate(() => window.scrollBy(0, -40));
await p.screenshot({ path: "docs/4-accuracy.png" });

// 5. Share card
await runSample(p, /Internship with a fee/);
await p.getByRole("button", { name: /Share warning card/ }).click();
const link = p.locator('p[role="status"] a');
await link.waitFor({ timeout: 30000 });
const url = await link.getAttribute("href");
await p.goto(url, { waitUntil: "networkidle" });
await p.screenshot({ path: "docs/5-share-card.png" });
console.log("share card:", url);

await browser.close();
