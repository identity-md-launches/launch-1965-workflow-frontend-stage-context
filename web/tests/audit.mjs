import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";
import { fixture, installFixture } from "./fixture.mjs";
const root = resolve(import.meta.dirname, "../.."),
  dist = resolve(root, "dist");
const server = createServer(async (req, res) => {
  try {
    const p = resolve(
      dist,
      decodeURIComponent(
        new URL(req.url, "http://local").pathname.replace(/^\/preview\//, ""),
      ) || "index.html",
    );
    if (!p.startsWith(dist + "/")) throw Error("Path");
    const bytes = await readFile(p);
    const mime = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".md": "text/plain",
    };
    res.writeHead(200, {
      "content-type": mime[extname(p)] ?? "application/octet-stream",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`,
  results = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    f = fixture();
  await installFixture(page, f);
  await page.goto(url);
  await page
    .getByRole("heading", { level: 1 })
    .filter({ hasText: "An assembly" })
    .waitFor();
  await page.addScriptTag({
    path: resolve(root, "web/node_modules/axe-core/axe.min.js"),
  });
  for (const lang of ["en", "zh"]) {
    if (lang === "zh")
      await page
        .getByRole("button", { name: "Switch to Chinese", exact: true })
        .click();
    for (const route of [
      "participation",
      "membership",
      "governance",
      "discussion",
      "treasury",
      "swap",
      "releases",
      "connector",
      "constitution",
      "bootstrap",
      "activity",
    ]) {
      await page.selectOption("#route-select", route);
      await page.waitForTimeout(150);
      await page
        .locator("details")
        .evaluateAll((nodes) => nodes.forEach((n) => (n.open = true)));
      const report = await page.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: [
              "wcag2a",
              "wcag2aa",
              "wcag21a",
              "wcag21aa",
              "best-practice",
            ],
          },
        });
        return {
          violations: r.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
          incomplete: r.incomplete.map((v) => v.id),
          passes: r.passes.length,
        };
      });
      results.push({ lang, route, ...report });
      console.log(lang, route, report.violations.length + " violations");
    }
  }
  await page.selectOption("#route-select", "participation");
  await page.getByRole("button", { name: "连接钱包", exact: true }).click();
  const dialog = await page.evaluate(async () => {
    const r = await window.axe.run(document);
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    }));
  });
  results.push({ lang: "zh", route: "wallet dialog", violations: dialog });
  if (results.some((r) => r.violations.length)) process.exitCode = 1;
} catch (e) {
  console.error(e);
  process.exitCode = 1;
  results.push({ error: e.message });
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await writeFile(
    resolve(root, "docs/frontend/accessibility-results.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        scope:
          "Automated axe-core checks, not screen-reader or full WCAG certification",
        results,
      },
      null,
      2,
    ) + "\n",
  );
}
