import { chromium } from "@playwright/test";
const B = process.env.BASE || "http://localhost:3417";
const out = process.argv[2] || "shots";
const browser = await chromium.launch();
const errors = [];
async function shot(name, w, h, fn, scheme = "light") {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(B + "/", { waitUntil: "networkidle" });
  if (fn) await fn(p);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (sw > 0) errors.push(`${name}: horizontal overflow ${sw}px`);
  await ctx.close();
}
const sample = (label) => async (p) => {
  await p.getByRole("button", { name: new RegExp(label) }).click();
  await p.locator("#verdict-title").waitFor({ timeout: 60000 });
  await p.waitForTimeout(1500);
};
const which = (process.argv[3] || "home,fee,legit,mobile,dark").split(",");
if (which.includes("home")) await shot("home-desktop", 1280, 900);
if (which.includes("fee")) await shot("fee-desktop", 1280, 900, sample("Internship with a fee"));
if (which.includes("legit")) await shot("legit-desktop", 1280, 900, sample("Real-style interview"));
if (which.includes("mobile")) { await shot("home-mobile", 360, 780); await shot("fee-mobile", 360, 780, sample("Internship with a fee")); }
if (which.includes("dark")) await shot("fee-dark", 1280, 900, sample("Internship with a fee"), "dark");
if (which.includes("image")) await shot("image-desktop", 1280, 900, sample("Telegram task job"));
await browser.close();
console.log(errors.length ? errors.join("\n") : "no console errors / overflow");
