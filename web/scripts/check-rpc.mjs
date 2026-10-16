import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, http, fallback, keccak256 } from "viem";
import { resolve } from "node:path";
import { quoterAbi, stateAbi, poolId } from "../src/swap-core.ts";
const root = resolve(import.meta.dirname, "../..");
const m = JSON.parse(
    await readFile(resolve(root, "web/deployment-input.json"), "utf8"),
  ),
  n = JSON.parse(
    await readFile(resolve(root, "web/network-input.json"), "utf8"),
  );
const client = createPublicClient({
  transport: fallback(
    n.network.rpcUrls.map((u) => http(u, { timeout: 12000, retryCount: 0 })),
    { rank: false },
  ),
});
const result = {
  checkedAt: new Date().toISOString(),
  kind: "read-only RPC observation, not independent attestation",
  configuredChainId: m.chainId,
  transactionsBroadcast: 0,
  contracts: [],
};
try {
  result.rpcChainId = await client.getChainId();
  if (result.rpcChainId !== m.chainId) throw Error("Wrong chain");
  const block = await client.getBlock();
  result.block = {
    number: String(block.number),
    hash: block.hash,
    timestamp: String(block.timestamp),
  };
  for (const c of m.contracts) {
    const code = await client.getCode({
      address: c.address,
      blockNumber: block.number,
    });
    if (!code || code === "0x") throw Error(`${c.name}: no code`);
    result.contracts.push({
      name: c.name,
      address: c.address,
      codeBytes: (code.length - 2) / 2,
      runtimeKeccak256: keccak256(code),
    });
  }
  const read = async (name, functionName, args = []) =>
    client.readContract({
      address: m.contracts.find((c) => c.name === name).address,
      abi: JSON.parse(
        await readFile(resolve(root, `docs/abi/${name}.json`), "utf8"),
      ),
      functionName,
      args,
      blockNumber: block.number,
    });
  result.state = {};
  for (const [name, fn] of [
    ["LaunchToken", "symbol"],
    ["LaunchToken", "decimals"],
    ["LaunchToken", "totalSupply"],
    ["QuorumSeats", "configurationHash"],
    ["QuorumSeats", "constitutionHash"],
    ["QuorumSeats", "connectedAtAdmission"],
    ["QuorumSeats", "depositedCount"],
    ["QuorumSeats", "owner"],
    ["QuorumGovernance", "handedOver"],
    ["QuorumGovernance", "founder"],
    ["QuorumGovernance", "proposalCount"],
    ["QuorumReleases", "currentRelease"],
  ])
    result.state[`${name}.${fn}`] = await read(name, fn);
  try {
    const key = m.poolKey;
    const slot = await client.readContract({
      address: n.network.uniswapV4.stateView,
      abi: stateAbi,
      functionName: "getSlot0",
      args: [poolId(key)],
      blockNumber: block.number,
    });
    const quoted = await client.simulateContract({
      address: n.network.uniswapV4.quoter,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          poolKey: key,
          zeroForOne:
            key.currency0.toLowerCase() ===
            n.network.pairToken.address.toLowerCase(),
          exactAmount: 10n ** BigInt(n.network.pairToken.decimals),
          hookData: "0x",
        },
      ],
      blockNumber: block.number,
    });
    result.poolObservation = {
      passed: true,
      poolId: poolId(key),
      slot0: slot,
      input: "1 " + n.network.pairToken.symbol,
      amountOutAtomic: quoted.result[0],
      gasEstimate: quoted.result[1],
      note: "Read-only quoter simulation. No approval, swap or liquidity transaction was sent.",
    };
  } catch (error) {
    result.poolObservation = {
      passed: false,
      error: error.shortMessage ?? error.message,
    };
  }
  result.passed = true;
} catch (e) {
  result.passed = false;
  result.error = e.shortMessage ?? e.message;
}
await writeFile(
  resolve(root, "docs/frontend/rpc-read.json"),
  JSON.stringify(
    result,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    result,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ),
);
