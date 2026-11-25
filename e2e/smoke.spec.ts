import { expect, test } from "@playwright/test";

test("sample 1 → High risk with ≥3 receipts, highlights map to receipts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Internship with a fee/ }).click();
  await expect(page.locator("#verdict-title")).toHaveText("High risk", { timeout: 60_000 });
  const receipts = page.locator('ol > li[id^="receipt-"]');
  expect(await receipts.count()).toBeGreaterThanOrEqual(3);
  // every highlight number points at an existing receipt
  for (const ref of await page.locator("mark[aria-describedby]").evaluateAll((ms) => ms.map((m) => m.getAttribute("aria-describedby")!))) {
    for (const id of ref.split(" ")) await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
  // keyboard: focusing a highlight activates its receipt
  await page.locator("mark").first().focus();
  await expect(page.locator("mark").first()).toHaveAttribute("data-active", "true");
  await page.getByRole("button", { name: /Check another/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("feels off");
  expect(errors).toEqual([]);
});

test("legitimate sample → No major red flags", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Real-style interview invite/ }).click();
  await expect(page.locator("#verdict-title")).toHaveText("No major red flags found", { timeout: 60_000 });
});

test("static pages render", async ({ page }) => {
  for (const [path, text] of [["/how-it-works", "Every flag comes with a receipt"], ["/privacy", "Nothing you paste is kept"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(text);
  }
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
});
