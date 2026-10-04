const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/browser",
  timeout: 15_000,
  retries: 0,
  use: {
    browserName: "chromium",
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 1
  }
});
