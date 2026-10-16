import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { keccak256, toHex } from "viem";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "../.."),
  dist = resolve(root, "dist");
const load = async (p) => JSON.parse(await readFile(resolve(root, p), "utf8"));
const m = await load("dist/imd-deployment.json"),
  h = await load("web/deployment-input.json"),
  n = await load("web/network-input.json");
const canon = (v) =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canon(v[k])]),
        )
      : v;
assert.deepEqual(
  Object.keys(m).sort(),
  [
    "version",
    "launchId",
    "chainId",
    "sourceCommit",
    "attestationHash",
    "contracts",
    "assets",
    "poolKey",
    "network",
    "walletAddChain",
  ].sort(),
);
for (const k of [
  "version",
  "launchId",
  "chainId",
  "sourceCommit",
  "attestationHash",
  "poolKey",
])
  assert.deepEqual(m[k], h[k], k);
assert.deepEqual(m.network, n.network);
assert.deepEqual(m.walletAddChain, n.walletAddChain);
assert.deepEqual(
  m.contracts.map(({ abiPath, ...c }) => c),
  h.contracts.map(({ name, address, abiHash }) => ({ name, address, abiHash })),
);
for (const c of m.contracts) {
  const abi = await load(`dist/${c.abiPath}`);
  assert(Array.isArray(abi));
  assert.equal(
    keccak256(toHex(JSON.stringify(canon(abi)))).slice(2),
    c.abiHash,
  );
  assert.deepEqual(
    abi,
    JSON.parse(
      execFileSync(
        "git",
        ["show", `${h.sourceCommit}:docs/abi/${c.name}.json`],
        { cwd: root },
      ),
    ),
  );
}
const files = [];
async function walk(d = "") {
  for (const f of await readdir(resolve(dist, d), { withFileTypes: true })) {
    const p = d ? `${d}/${f.name}` : f.name;
    if (f.isDirectory()) await walk(p);
    else if (p !== "imd-deployment.json") files.push(p);
  }
}
await walk();
assert.deepEqual(files.sort(), m.assets.map((a) => a.path).sort());
assert(m.assets.length <= 128);
let bytes = 0;
for (const a of m.assets) {
  assert(
    !a.path.startsWith("/") && !a.path.includes("..") && !a.path.includes(":"),
  );
  const b = await readFile(resolve(dist, a.path));
  assert(b.length <= 8388608);
  bytes += b.length;
  assert.equal(createHash("sha256").update(b).digest("hex"), a.sha256);
}
assert(bytes < 32 * 1024 * 1024);
console.log(
  JSON.stringify(
    {
      passed: true,
      contracts: m.contracts.length,
      assets: m.assets.length,
      exportBytes: bytes,
    },
    null,
    2,
  ),
);
