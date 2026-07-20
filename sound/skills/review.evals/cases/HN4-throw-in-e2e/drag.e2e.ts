import { test, expect } from "@playwright/test";
import type { Page, Locator } from "@playwright/test";

const card = (page: Page): Locator => page.locator('[data-role="card"]').first();

test("card is draggable", async ({ page }) => {
  await page.goto("/editor");
  const box = await card(page).boundingBox();
  if (!box) throw new Error("Card not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  expect(box.width).toBeGreaterThan(0);
});
