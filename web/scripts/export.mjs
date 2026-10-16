import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { keccak256, toHex } from "viem";
const root = resolve(import.meta.dirname, "../.."),
  out = resolve(root, "dist");
const h = JSON.parse(
  await readFile(resolve(root, "web/deployment-input.json"), "utf8"),
);
const n = JSON.parse(
  await readFile(resolve(root, "web/network-input.json"), "utf8"),
);
export function canonical(v) {
  return Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
}
await mkdir(resolve(out, "abi"), { recursive: true });
const contracts = [];
for (const c of h.contracts) {
  const bytes = execFileSync(
    "git",
    ["show", `${h.sourceCommit}:docs/abi/${c.name}.json`],
    { cwd: root },
  );
  const abi = JSON.parse(bytes.toString());
  if (!Array.isArray(abi)) throw Error("ABI must be an array");
  const hash = keccak256(toHex(JSON.stringify(canonical(abi)))).slice(2);
  if (hash !== c.abiHash)
    throw Error(`${c.name}: canonical ABI hash mismatch ${hash}`);
  const abiPath = `abi/${c.name}.json`;
  await writeFile(resolve(out, abiPath), bytes);
  contracts.push({
    name: c.name,
    address: c.address,
    abiHash: c.abiHash,
    abiPath,
  });
}
await writeFile(
  resolve(out, "constitution.md"),
  execFileSync("git", ["show", `${h.sourceCommit}:docs/constitution.md`], {
    cwd: root,
  }),
);
await writeFile(
  resolve(out, "connector.tar.gz"),
  execFileSync(
    "git",
    [
      "archive",
      "--format=tar.gz",
      h.sourceCommit,
      "connector",
      "docs/abi",
      "docs/constitution.md",
    ],
    { cwd: root, maxBuffer: 4 * 1024 * 1024 },
  ),
);
await writeFile(
  resolve(out, "history.json"),
  JSON.stringify(
    { deploymentBlock: Math.min(...h.contracts.map((c) => c.blockNumber)) },
    null,
    2,
  ) + "\n",
);
const assets = [];
async function walk(dir = "") {
  for (const f of (
    await readdir(resolve(out, dir), { withFileTypes: true })
  ).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = dir ? `${dir}/${f.name}` : f.name;
    if (f.isDirectory()) await walk(path);
    else if (path !== "imd-deployment.json") {
      const b = await readFile(resolve(out, path));
      if (b.length > 8388608) throw Error("Asset too large");
      assets.push({
        path,
        sha256: createHash("sha256").update(b).digest("hex"),
      });
    }
  }
}
await walk();
if (assets.length > 128) throw Error("Too many assets");
const manifest = {
  version: 1,
  launchId: h.launchId,
  chainId: h.chainId,
  sourceCommit: h.sourceCommit,
  attestationHash: h.attestationHash,
  contracts,
  assets,
  ...(h.poolKey ? { poolKey: h.poolKey } : {}),
  network: n.network,
  ...(n.walletAddChain ? { walletAddChain: n.walletAddChain } : {}),
};
await writeFile(
  resolve(out, "imd-deployment.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Exported ${assets.length} assets; verified ${contracts.length} pinned ABI hashes.`,
);
