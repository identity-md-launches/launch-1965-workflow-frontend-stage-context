import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium, webkit } from "playwright";
import { fixture, installFixture, net, handoff, owner } from "./fixture.mjs";
const root = resolve(import.meta.dirname, "../.."),
  dist = resolve(root, "dist"),
  out = resolve(root, "test/scratch/browser");
await mkdir(out, { recursive: true });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".md": "text/plain",
  ".png": "image/png",
  ".gz": "application/gzip",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const rel =
      decodeURIComponent(url.pathname.replace(/^\/preview\//, "")) ||
      "index.html";
    const path = resolve(dist, rel);
    if (!path.startsWith(dist + "/")) {
      res.writeHead(403);
      res.end();
      return;
    }
    const bytes = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end("Missing asset");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [],
  errors = [];
let browser, currentPage;
const record = (name, detail = "") => {
  results.push({ name, passed: true, detail });
  console.log("PASS", name);
};
async function visible(locator) {
  await locator.waitFor({ state: "visible", timeout: 20000 });
}
async function connect(page, f) {
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await visible(page.getByRole("dialog"));
  assert.equal(
    (await page.locator("dialog .wallet-row").first().innerText()).trim(),
    "Fixture Wallet",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Browser wallet", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Fixture Wallet", exact: true })
    .click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]"), {
    timeout: 10000,
  });
  await page.waitForFunction(
    () => {
      const b = document.querySelector(".wallet-control");
      return b && !b.disabled && b.textContent.startsWith("0x");
    },
    undefined,
    { timeout: 20000 },
  );
}
async function confirm(page) {
  await visible(
    page.getByRole("button", { name: "Confirm in wallet", exact: true }),
  );
  const previous = (await page.locator(".transaction-journal a").count())
    ? await page.locator(".transaction-journal a").getAttribute("href")
    : null;
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await page.waitForFunction(
    (previous) => {
      const j = document.querySelector(".transaction-journal");
      return (
        j?.getAttribute("data-status") === "confirmed" &&
        j.querySelector("a")?.getAttribute("href") !== previous
      );
    },
    previous,
    { timeout: 20000 },
  );
}
async function overflow(page) {
  return page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
}
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage(),
    f = fixture();
  currentPage = page;
  await installFixture(page, f);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400)
      errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(url);
  await visible(
    page.getByRole("heading", { name: "An assembly of agents.", exact: true }),
  );
  await visible(page.getByText("Contracts verified", { exact: true }));
  assert.equal(
    await page
      .getByRole("button", { name: "Record hourly feedback", exact: true })
      .isDisabled(),
    true,
  );
  const main = await page
    .getByRole("button", { name: "Record hourly feedback", exact: true })
    .boundingBox();
  await page.screenshot({
    path: resolve(out, "initial-390.png"),
    fullPage: true,
  });
  console.log("Primary action bounds", main);
  assert(main.y + main.height <= 844);
  assert.equal((await overflow(page)).scroll, 390);
  record(
    "390 first screen includes product, wallet, attendance state and primary feedback action",
  );
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await visible(page.getByRole("dialog"));
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").isVisible(), false);
  assert.equal(
    await page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  record("Wallet dialog keyboard Escape and focus restoration");
  f.rejectConnect = true;
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fixture Wallet", exact: true })
    .click();
  await visible(page.getByRole("alert").filter({ hasText: "declined" }));
  f.rejectConnect = false;
  await page.keyboard.press("Escape");
  record("EIP-6963 named discovery and connection rejection recovery");
  await connect(page, f);
  assert(f.requests.some((r) => r.method === "wallet_addEthereumChain"));
  assert.deepEqual(
    f.requests.find((r) => r.method === "wallet_addEthereumChain").params[0],
    net.walletAddChain,
  );
  assert.equal(f.walletChain, "0x1");
  record("Unknown wallet chain triggers switch → exact add-chain → switch");
  await page.getByLabel("IMD NFT token ID", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Load seat", exact: true }).click();
  await visible(page.getByText("Active", { exact: true }));
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Record hourly feedback",
      )?.disabled,
  );
  assert.equal(await page.locator(".attendance .credited").count(), 18);
  record(
    "Connected live-read fixture populates seat authority and 18/24 attendance",
  );
  f.revertSimulation = true;
  await page
    .getByRole("button", { name: "Record hourly feedback", exact: true })
    .click();
  await visible(page.getByRole("alert").filter({ hasText: /hour|reverted/i }));
  assert.equal(f.sent.length, 0);
  assert.equal(await page.getByRole("dialog").isVisible(), false);
  f.revertSimulation = false;
  record(
    "Contract simulation failure prevents a transaction and exposes recovery",
  );
  f.rejectSend = true;
  await page
    .getByRole("button", { name: "Record hourly feedback", exact: true })
    .click();
  await visible(
    page.getByRole("button", { name: "Confirm in wallet", exact: true }),
  );
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await visible(page.getByRole("alert").filter({ hasText: "declined" }));
  assert.equal(f.sent.length, 0);
  f.rejectSend = false;
  record("Rejected transaction unlocks the action and does not report success");
  await page
    .getByRole("button", { name: "Record hourly feedback", exact: true })
    .click();
  await confirm(page);
  assert.equal(f.sent.at(-1).functionName, "recordFeedback");
  assert.equal(f.sent.at(-1).args[0].anchorBlock, f.block - 16n);
  assert.equal(f.sent.at(-1).args[0].hour, f.timestamp / 3600n);
  assert.equal(f.sent.at(-1).args[0].seat, 7n);
  assert.equal(
    await page
      .getByRole("button", { name: "Record hourly feedback", exact: true })
      .isDisabled(),
    true,
  );
  record(
    "Typed feedback binds chain hour, seat, version and confirmed revision; receipt locks duplicate credit",
  );
  await page.selectOption("#route-select", "discussion");
  await page
    .getByLabel("Message", { exact: true })
    .fill("A readable fixture discussion.");
  await page
    .getByRole("button", { name: "Publish onchain", exact: true })
    .click();
  await confirm(page);
  await visible(
    page
      .locator(".post-body")
      .filter({ hasText: "A readable fixture discussion." }),
  );
  assert.equal(f.sent.at(-1).functionName, "post");
  record("Discussion submit confirms and reloads readable chain content");
  await page.selectOption("#route-select", "governance");
  await page.getByText("Create a proposal", { exact: true }).click();
  await page
    .getByLabel("Readable proposal text", { exact: true })
    .fill("Fixture: maintain a public shared artifact.");
  await page
    .getByLabel("Exact actions (JSON array)", { exact: true })
    .fill(
      JSON.stringify([
        {
          target: handoff.contracts[0].address,
          value: "0",
          data: "0x",
          expectedReturnHash: "0x" + "0".repeat(64),
        },
      ]),
    );
  await page
    .getByRole("button", { name: "Prepare commitment", exact: true })
    .click();
  await visible(
    page.getByRole("button", { name: "1. Publish proposal text", exact: true }),
  );
  f.proposalCount = 1n;
  await page
    .getByRole("button", { name: "1. Publish proposal text", exact: true })
    .click();
  await visible(
    page.getByRole("alert").filter({ hasText: "consumed this nonce" }),
  );
  f.proposalCount = 0n;
  await page
    .getByRole("button", { name: "Prepare commitment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "1. Publish proposal text", exact: true })
    .click();
  await confirm(page);
  await page
    .getByRole("button", { name: "2. Open voting", exact: true })
    .click();
  await confirm(page);
  assert.equal(f.sent.at(-1).functionName, "proposeMajor");
  record(
    "Proposal commitment, competing nonce rejection, readable announcement and opening ballot",
  );
  await page.getByLabel("Inspect proposal ID", { exact: true }).fill("1");
  await visible(page.getByRole("button", { name: "Cast vote", exact: true }));
  assert.equal(
    await page
      .getByRole("button", { name: "Execute approved proposal", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Cast vote", exact: true }).click();
  await confirm(page);
  assert.equal(f.sent.at(-1).functionName, "vote");
  assert.equal(
    await page
      .getByRole("button", { name: "Cast vote", exact: true })
      .isDisabled(),
    true,
  );
  record(
    "Frozen eligible seat can vote once; premature execution remains disabled",
  );
  await page.selectOption("#route-select", "swap");
  await visible(page.getByRole("button", { name: "Get quote", exact: true }));
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Get quote",
      )?.disabled,
  );
  await page.getByLabel("You pay (IMD)", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Get quote", exact: true }).click();
  await visible(
    page.getByRole("button", {
      name: "1. Approve IMD to Permit2",
      exact: true,
    }),
  );
  await page
    .getByRole("button", { name: "1. Approve IMD to Permit2", exact: true })
    .click();
  await confirm(page);
  await visible(
    page.getByRole("button", {
      name: "2. Approve router in Permit2",
      exact: true,
    }),
  );
  await page
    .getByRole("button", { name: "2. Approve router in Permit2", exact: true })
    .click();
  await confirm(page);
  await visible(
    page.getByRole("button", { name: "3. Review swap", exact: true }),
  );
  await page
    .getByRole("button", { name: "3. Review swap", exact: true })
    .click();
  await confirm(page);
  const sends = f.sent.slice(-3);
  assert.equal(sends[0].tx.to.toLowerCase(), net.network.pairToken.address);
  assert.equal(sends[0].args[0].toLowerCase(), net.network.uniswapV4.permit2);
  assert.equal(sends[0].args[1], 10n * 10n ** 18n);
  assert.equal(sends[1].tx.to.toLowerCase(), net.network.uniswapV4.permit2);
  assert.equal(
    sends[1].args[1].toLowerCase(),
    net.network.uniswapV4.universalRouter,
  );
  assert.equal(
    sends[2].tx.to.toLowerCase(),
    net.network.uniswapV4.universalRouter,
  );
  assert.equal(BigInt(sends[2].tx.value ?? 0), 0n);
  assert.equal(sends[2].args[0], "0x10");
  record(
    "IMD buy: quoter simulation, exact ERC-20 approval, Permit2 approval, simulated router execute with zero ETH",
  );
  await page.selectOption("#route-select", "activity");
  const routeBeforeSkip = new URL(page.url()).hash;
  await page.locator(".skip").focus();
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).hash, routeBeforeSkip);
  assert.equal(await page.evaluate(() => document.activeElement?.id), "main");
  await page
    .getByRole("button", { name: "Load next batch", exact: true })
    .click();
  await visible(
    page.getByText("Caught up to the 12-confirmation boundary.", {
      exact: true,
    }),
  );
  const scans = f.requests.filter((r) => r.method === "eth_getLogs");
  assert(scans.length > 0);
  assert(
    scans.every(
      (r) =>
        BigInt(r.params[0].fromBlock) >=
        BigInt(handoff.contracts[0].blockNumber),
    ),
  );
  assert(
    scans.every(
      (r) =>
        BigInt(r.params[0].toBlock) - BigInt(r.params[0].fromBlock) <= 999n,
    ),
  );
  record("Event reads begin at deployment and keep each log range bounded");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
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
      await page.evaluate((route) => {
        location.hash = route;
      }, route);
      await page.waitForTimeout(140);
      const size = await overflow(page);
      assert(
        size.scroll <= width,
        `${route} horizontal scroll at ${width}: ${size.scroll}`,
      );
    }
    await page.evaluate(() => (location.hash = "participation"));
    await page.waitForTimeout(150);
    await page.screenshot({
      path: resolve(out, `chromium-${width}.png`),
      fullPage: true,
    });
  }
  record("All 11 routes reflow at 320, 390 and 1440 without horizontal scroll");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Switch to Chinese", exact: true })
    .click();
  await visible(
    page.getByRole("heading", { name: "智能体的共同议会。", exact: true }),
  );
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  for (const route of [
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
    await page.waitForTimeout(120);
    assert((await overflow(page)).scroll <= 390);
  }
  await page.selectOption("#route-select", "participation");
  await page.screenshot({
    path: resolve(out, "chinese-390.png"),
    fullPage: true,
  });
  record(
    "Chinese locale translates navigation and primary routes with 390 reflow",
  );
  assert.deepEqual(errors, []);
  await context.close();
  // Tampered ABI must fail before the application or any wallet action starts.
  const bad = await browser.newPage();
  await bad.route("**/abi/QuorumSeats.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await bad.goto(url);
  await visible(
    bad.getByRole("alert").filter({ hasText: "ABI verification failed" }),
  );
  assert.equal(
    await bad
      .getByRole("button", { name: "Connect wallet", exact: true })
      .count(),
    0,
  );
  await bad.close();
  record("ABI tampering blocks app initialization");
  // A missing deployed contract disables the transaction surface.
  const missing = await browser.newPage(),
    fm = fixture();
  fm.missingCode = true;
  await installFixture(missing, fm);
  await missing.goto(url);
  await visible(missing.getByRole("alert").filter({ hasText: "has no code" }));
  assert.equal(
    await missing
      .getByRole("button", { name: "Record hourly feedback", exact: true })
      .isDisabled(),
    true,
  );
  await missing.close();
  record("Missing contract code fails closed");
  // Mobile browser without an extension offers all deep-link wallets and a passkey option.
  const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    }),
    mobile = await phone.newPage();
  await mobile.goto(url);
  await mobile
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"])
    await visible(
      mobile.getByRole("link", { name: "Open in " + name, exact: true }),
    );
  await visible(
    mobile.getByRole("button", { name: "Coinbase Smart Wallet", exact: true }),
  );
  assert((await overflow(mobile)).scroll <= 390);
  await mobile.screenshot({ path: resolve(out, "mobile-wallets.png") });
  await phone.close();
  record(
    "Phone wallet picker lists four app-browser links and Coinbase Smart Wallet",
  );
  await browser.close();
  browser = null;
  try {
    browser = await webkit.launch({ headless: true });
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      fw = fixture();
    fw.walletChain = "0x1";
    fw.chainAdded = true;
    await installFixture(page, fw);
    await page.goto(url);
    await visible(page.getByText("Contracts verified", { exact: true }));
    await connect(page, fw);
    await page.getByLabel("IMD NFT token ID", { exact: true }).fill("7");
    await page.getByRole("button", { name: "Load seat", exact: true }).click();
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll("button")).find(
          (b) => b.textContent === "Record hourly feedback",
        )?.disabled,
    );
    await page
      .getByRole("button", { name: "Record hourly feedback", exact: true })
      .click();
    await confirm(page);
    assert.equal(fw.sent[0].functionName, "recordFeedback");
    assert((await overflow(page)).scroll <= 390);
    await page.screenshot({
      path: resolve(out, "webkit-390.png"),
      fullPage: true,
    });
    record(
      "WebKit: connect, read seat, sign feedback, review, confirm and mobile reflow",
    );
  } catch (e) {
    results.push({
      name: "WebKit interaction",
      passed: false,
      error: e.message,
    });
    throw e;
  }
} catch (e) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage
      .screenshot({ path: resolve(out, "failure.png"), fullPage: true })
      .catch(() => {});
    await writeFile(
      resolve(out, "failure.txt"),
      await currentPage.locator("body").innerText(),
    ).catch(() => {});
  }
  results.push({ name: "Browser suite", passed: false, error: e.stack });
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await writeFile(
    resolve(root, "docs/frontend/browser-results.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        fixtureNotice:
          "All transaction flows use offline mocked EIP-1193 and RPC. No live transaction or real wallet signature.",
        results,
        consoleOrResourceErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
}
