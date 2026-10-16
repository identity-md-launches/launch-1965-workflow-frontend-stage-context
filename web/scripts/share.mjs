import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    await readFile(resolve(import.meta.dirname, "../assets/share.svg"), "utf8"),
  );
  await page
    .locator("svg")
    .screenshot({ path: resolve(import.meta.dirname, "../public/share.png") });
} finally {
  await browser.close();
}
