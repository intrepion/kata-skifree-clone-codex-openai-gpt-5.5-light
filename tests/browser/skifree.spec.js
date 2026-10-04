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

test("MVP 2 scores gates and tricks and persists local bests", async ({ page }) => {
  await page.goto(gameUrl);
  await page.evaluate(() => {
    window.skiFreeTest.resetBests();
    window.skiFreeTest.start(1936);
  });

  await page.evaluate(() => {
    const gate = window.skiFreeTest.snapshot().testGate;
    window.skiFreeTest.forceX(gate.x);
    window.skiFreeTest.forceDistance(gate.y + 4);
  });
  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().gateBonus))
    .toBe(250);

  await page.evaluate(() => {
    const jump = window.skiFreeTest.snapshot().testJump;
    window.skiFreeTest.forceX(jump.x);
    window.skiFreeTest.forceDistance(jump.y - 4);
  });
  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().airborne))
    .toBe(true);
  await page.keyboard.press("z");
  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().trickBonus))
    .toBe(400);

  await page.evaluate(() => window.skiFreeTest.forceCrash());
  const bests = await page.evaluate(() => window.skiFreeTest.snapshot().bests);
  expect(bests.score).toBeGreaterThanOrEqual(1000);
  expect(bests.distance).toBeGreaterThanOrEqual(800);

  await page.reload();
  const persisted = await page.evaluate(() => window.skiFreeTest.snapshot().bests);
  expect(persisted).toEqual(bests);
});
