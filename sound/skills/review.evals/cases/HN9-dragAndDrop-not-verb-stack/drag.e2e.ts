import type { Page } from "@playwright/test";

const dragAndDrop = async (page: Page, fromId: string, toId: string) => {
  await page.locator(`[data-id="${fromId}"]`).hover();
  await page.mouse.down();
  await page.locator(`[data-id="${toId}"]`).hover();
  await page.mouse.up();
};

const dragAndDropPoint = async (page: Page, fromId: string, x: number, y: number) => {
  await page.locator(`[data-id="${fromId}"]`).hover();
  await page.mouse.down();
  await page.mouse.move(x, y);
  await page.mouse.up();
};

export { dragAndDrop, dragAndDropPoint };
