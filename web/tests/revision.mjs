// Regression checks against the production export. All chain responses are fixtures.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";
import { keccak256 } from "viem";
import { fixture, installFixture } from "./fixture.mjs";

const root = resolve(import.meta.dirname, "../..");
const dist = resolve(root, "dist");
const baseline = process.argv.includes("--reproduce");
const out = resolve(
  root,
  "test/scratch/revision",
  baseline ? "before" : "after",
);
await mkdir(out, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".md": "text/plain",
};
const server = createServer(async (req, res) => {
  try {
    const rel =
      decodeURIComponent(
        new URL(req.url, "http://localhost").pathname.replace(
          /^\/preview\//,
          "",
        ),
      ) || "index.html";
    const path = resolve(dist, rel);
    if (!path.startsWith(dist + "/")) throw Error("Outside export");
    const bytes = await readFile(path);
    res.writeHead(200, {
      "content-type": mime[extname(path)] ?? "application/octet-stream",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [];
const errors = [];
const browser = await chromium.launch({ headless: true });
async function pageFor(f, width = 390) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  await installFixture(page, f);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400)
      errors.push(`${r.status()} ${r.url()}`);
  });
  page.setDefaultTimeout(20000);
  return page;
}
async function check(name, run) {
  try {
    const detail = await run();
    results.push({ name, passed: true, detail });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, error: e.stack });
    console.error("FAIL", name, e.message);
    process.exitCode = 1;
  }
}
const A = "0x" + "a".repeat(64),
  B = "0x" + "b".repeat(64),
  zero = "0x" + "0".repeat(64);
const artifactA = Buffer.from("Approved release A artifact\n");
const artifactB = Buffer.from("Approved release B artifact\n");
const hashA = keccak256(artifactA),
  hashB = "0x695aa847038874623b6a7591d1e9cc1042b3f90c46556dd5d71bef0c21694e6d";
function releases() {
  const f = fixture();
  f.currentRelease = A;
  for (const [id, siteHash] of [
    [A, hashA],
    [B, hashB],
  ])
    f.releases[id] = {
      sourceHash: zero,
      buildHash: zero,
      siteHash,
      connectorHash: zero,
      migrationHash: zero,
      approvedAt: 1n,
      proposal: 1n,
      manifestURI: "Fixture release manifest",
    };
  return f;
}
const uploadA = (page) =>
  page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "release-a.txt",
      mimeType: "text/plain",
      buffer: artifactA,
    });
const approval = (page) => page.locator("section.panel").first();
async function waitApproval(page, hash) {
  await page.waitForFunction(
    (hash) =>
      document.querySelector("section.panel pre")?.textContent.includes(hash),
    hash,
  );
}
async function refresh(page) {
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
}
try {
  await check("Full uint256 seat ID wraps at 320 and 390", async () => {
    const measurements = [];
    for (const width of [320, 390]) {
      const f = fixture();
      const seat = 2n ** 256n - 2n;
      f.postCount = 1n;
      f.posts = [
        {
          seat,
          version: 1n,
          timestamp: f.timestamp,
          kind: 0,
          proposal: 0n,
          parent: 0n,
          commitment: zero,
          body: "A bounded onchain discussion post.",
        },
      ];
      const page = await pageFor(f, width);
      await page.goto(url + "#discussion");
      await page.locator(".post-meta > span").waitFor();
      await page
        .getByRole("heading", { name: "Chain discussion", exact: true })
        .scrollIntoViewIfNeeded();
      const m = await page
        .locator(".post-meta > span")
        .evaluate((e) => ({
          width: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          left: e.getBoundingClientRect().left,
          right: e.getBoundingClientRect().right,
          text: e.textContent,
          height: e.getBoundingClientRect().height,
        }));
      assert(m.text.includes(String(seat)));
      assert(baseline ? m.scrollWidth > width : m.scrollWidth === width);
      if (!baseline) assert(m.right <= width && m.height > 25);
      measurements.push(m);
      await page.screenshot({ path: resolve(out, `discussion-${width}.png`) });
      if (!baseline) {
        await page
          .getByRole("button", { name: "Switch to Chinese", exact: true })
          .click();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth),
          width,
        );
        assert(
          (await page.locator(".post-meta > span").textContent()).includes(
            String(seat),
          ),
        );
      }
      await page.close();
    }
    return measurements;
  });
  await check(
    "Unavailable admission is unknown; verified zero enables setup notice",
    async () => {
      const f = fixture(),
        page = await pageFor(f);
      await page.route(
        /^https:\/\/(ethereum-rpc\.publicnode\.com|eth\.drpc\.org)/,
        (route) => route.abort(),
      );
      await page.goto(url + "#membership");
      await page
        .getByRole("heading", { name: "Join the assembly.", exact: true })
        .waitFor();
      const loading = await page.locator("main .notice").first().textContent();
      if (baseline) assert.match(loading, /Admission is not configured/);
      else {
        assert.match(loading, /Checking admission/);
        await page
          .getByText("Unable to read admission. Refresh to retry.", {
            exact: true,
          })
          .waitFor({ timeout: 45000 });
        assert.equal(
          await page
            .getByRole("link", { name: "View setup", exact: true })
            .count(),
          0,
        );
        for (const name of ["Approve exact NFT", "Authorize / rotate key"])
          assert(
            await page.getByRole("button", { name, exact: true }).isDisabled(),
          );
        await page
          .getByRole("button", { name: "Switch to Chinese", exact: true })
          .click();
        await page
          .getByText("无法读取准入状态，请刷新重试。", { exact: true })
          .waitFor();
        await page.screenshot({
          path: resolve(out, "admission-error-390.png"),
        });
      }
      await page.close();
      if (!baseline) {
        f.configured = false;
        const zeroPage = await pageFor(f);
        await zeroPage.goto(url + "#membership");
        await zeroPage
          .getByRole("link", { name: "View setup", exact: true })
          .waitFor();
        assert.match(
          await zeroPage.locator("main .notice").first().textContent(),
          /Admission is not configured/,
        );
        f.configured = true;
        await refresh(zeroPage);
        await zeroPage
          .getByRole("link", { name: "View setup", exact: true })
          .waitFor({ state: "detached" });
        await zeroPage.close();
      }
      return { firstNotice: loading };
    },
  );
  await check(
    "Chinese validation and wallet rejection use the selected language",
    async () => {
      const f = fixture(),
        page = await pageFor(f);
      await page.goto(url);
      await page
        .getByRole("button", { name: "Switch to Chinese", exact: true })
        .click();
      await page.getByLabel("IMD NFT 代币编号", { exact: true }).fill("abc");
      await page.getByRole("button", { name: "读取席位", exact: true }).click();
      const text = await page
        .locator(".seat-picker [role=alert]")
        .textContent();
      assert.equal(
        text,
        baseline ? "Enter a non-negative whole number." : "请输入非负整数。",
      );
      await page.screenshot({ path: resolve(out, "validation-zh-390.png") });
      if (!baseline) {
        await page
          .getByRole("button", { name: "切换为英文", exact: true })
          .click();
        assert.equal(
          await page.locator(".seat-picker [role=alert]").textContent(),
          "Enter a non-negative whole number.",
        );
        await page
          .getByRole("button", { name: "Switch to Chinese", exact: true })
          .click();
        f.rejectConnect = true;
        await page.locator(".wallet-control").click();
        await page
          .getByRole("button", { name: "Fixture Wallet", exact: true })
          .click();
        await page
          .getByRole("alert")
          .filter({ hasText: "钱包中已拒绝请求" })
          .waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth),
          390,
        );
      }
      await page.close();
      return { invalidSeatMessage: text };
    },
  );
  await check(
    "Artifact verdict and file selection belong to the displayed release",
    async () => {
      const f = releases(),
        page = await pageFor(f);
      await page.goto(url + "#releases");
      await waitApproval(page, hashA);
      await uploadA(page);
      await approval(page)
        .getByRole("status")
        .filter({ hasText: "Matches approved site hash" })
        .waitFor();
      await page
        .getByLabel("Release ID (blank = current)", { exact: true })
        .fill(B);
      await waitApproval(page, hashB);
      const verdict = await approval(page).getByRole("status").textContent();
      assert(
        baseline
          ? verdict.includes("Matches approved site hash")
          : verdict === "",
      );
      assert.equal(
        await page
          .locator('input[type="file"]')
          .evaluate((e) => e.files.length),
        0,
      );
      await page.screenshot({
        path: resolve(out, "release-b-390.png"),
        fullPage: true,
      });
      if (!baseline) {
        await uploadA(page);
        await approval(page)
          .getByRole("status")
          .filter({ hasText: "Does not match approved site hash" })
          .waitFor();
        await page
          .getByLabel("Release ID (blank = current)", { exact: true })
          .fill("");
        await waitApproval(page, hashA);
        await uploadA(page);
        await approval(page)
          .getByRole("status")
          .filter({ hasText: "Matches approved site hash" })
          .waitFor();
        f.currentRelease = B;
        await refresh(page);
        await waitApproval(page, hashB);
        assert.equal(
          await approval(page).getByRole("status").textContent(),
          "",
        );
        assert.equal(
          await page
            .locator('input[type="file"]')
            .evaluate((e) => e.files.length),
          0,
        );
        await uploadA(page);
        await approval(page)
          .getByRole("status")
          .filter({ hasText: "Does not match approved site hash" })
          .waitFor();
        f.releases[B].siteHash = hashA;
        await refresh(page);
        await waitApproval(page, hashA);
        assert.equal(
          await approval(page).getByRole("status").textContent(),
          "",
        );
        assert.equal(
          await page
            .locator('input[type="file"]')
            .evaluate((e) => e.files.length),
          0,
        );
      }
      await page.close();
      return { hashA, hashB, verdictAfterSelectingB: verdict };
    },
  );
  if (!baseline)
    await check(
      "Pending artifact hashes cannot overwrite a new release or newer file",
      async () => {
        const f = releases();
        const latestHash = keccak256(artifactB);
        f.releases[B].siteHash = latestHash;
        const page = await pageFor(f);
        await page.goto(url + "#releases");
        await waitApproval(page, hashA);
        await page.evaluate(() => {
          const original = File.prototype.arrayBuffer;
          window.__hashReads = [];
          File.prototype.arrayBuffer = async function () {
            const bytes = await original.call(this);
            await new Promise((resolve) => window.__hashReads.push(resolve));
            return bytes;
          };
        });
        await uploadA(page);
        await page.waitForFunction(() => window.__hashReads.length === 1);
        await page
          .getByLabel("Release ID (blank = current)", { exact: true })
          .fill(B);
        await waitApproval(page, latestHash);
        await page.evaluate(() => window.__hashReads.shift()());
        await page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
        assert.equal(
          await approval(page).getByRole("status").textContent(),
          "",
        );
        await uploadA(page);
        await page.waitForFunction(() => window.__hashReads.length === 1);
        await page
          .locator('input[type="file"]')
          .setInputFiles({
            name: "release-b.txt",
            mimeType: "text/plain",
            buffer: artifactB,
          });
        await page.waitForFunction(() => window.__hashReads.length === 2);
        await page.evaluate(() => window.__hashReads[1]());
        await approval(page)
          .getByRole("status")
          .filter({ hasText: "Matches approved site hash" })
          .waitFor();
        await page.evaluate(() => window.__hashReads[0]());
        await page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
        assert(
          (await approval(page).getByRole("status").textContent()).includes(
            latestHash,
          ),
        );
        await page.close();
        return "Delayed reads discarded across release changes and file replacement.";
      },
    );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await writeFile(
    resolve(out, "results.json"),
    JSON.stringify(
      {
        mode: baseline ? "reproduce accepted export" : "regression",
        results,
        consoleOrResourceErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
}
