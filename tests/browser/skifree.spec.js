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

  const nonSnowPixels = await page.evaluate(() => {
    const canvas = document.getElementById("game");
    const context = canvas.getContext("2d");
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let index = 0; index < data.length; index += 160) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (!(red > 240 && green > 248 && blue > 250)) {
        count += 1;
      }
    }
    return count;
  });
  expect(nonSnowPixels).toBeGreaterThan(100);

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

test("MVP 3 stages the yeti phase and supports new slope and reset bests", async ({ page }) => {
  await page.goto(gameUrl);
  await page.evaluate(() => {
    window.skiFreeTest.resetBests();
    window.skiFreeTest.start(1936);
    window.skiFreeTest.forceX(520);
    window.skiFreeTest.forceDistance(1210);
  });
  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().yetiState))
    .toBe("warning");
  await expect(page.locator("#status")).toHaveText("Warning");

  await page.evaluate(() => window.skiFreeTest.forceDistance(1460));
  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().yetiState))
    .toBe("distant");

  await page.evaluate(() => window.skiFreeTest.forceDistance(1660));
  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().yetiState))
    .toBe("chase");
  await expect(page.locator("#status")).toHaveText("Yeti chase");

  const firstSeed = await page.evaluate(() => window.skiFreeTest.snapshot().seed);
  await page.locator("#new-slope-button").click();
  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().seed))
    .not.toBe(firstSeed);

  await page.evaluate(() => {
    window.skiFreeTest.forceDistance(700);
    window.skiFreeTest.forceCrash();
  });
  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().bests.score))
    .toBeGreaterThan(0);
  await page.locator("#reset-bests-button").click();
  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().bests.score))
    .toBe(0);
});

test("MVP 3 exposes playable touch controls on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto(gameUrl);
  await expect(page.locator(".touch-controls")).toBeVisible();

  await page.locator('[data-touch="start"]').click();
  await expect
    .poll(() => page.evaluate(() => window.skiFreeTest.snapshot().mode))
    .toBe("running");

  const before = await page.evaluate(() => window.skiFreeTest.snapshot().x);
  const right = page.locator('[data-touch="right"]');
  const box = await right.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  const after = await page.evaluate(() => window.skiFreeTest.snapshot().x);
  expect(after).toBeGreaterThan(before);
});
