const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const gameUrl = pathToFileURL(path.join(__dirname, "..", "..", "index.html")).href;

test("MVP 1 opens from file, starts, crashes, and restarts", async ({ page }) => {
  const messages = [];
  page.on("console", (message) => messages.push(message.text()));

  await page.goto(gameUrl);
  await expect(page.locator("#start-button")).toBeVisible();
  await page.locator("#start-button").click();

  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().mode))
    .toBe("running");

  await page.evaluate(() => {
    const obstacle = window.skiFreeTest.snapshot().testObstacle;
    window.skiFreeTest.forceDistance(obstacle.y - 8);
  });

  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().mode))
    .toBe("crashed");
  await expect(page.locator("#status")).toHaveText("Crashed");

  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().mode))
    .toBe("running");
  await expect(page.locator("#status")).toHaveText("Running");
  expect(messages).toEqual([]);
});
