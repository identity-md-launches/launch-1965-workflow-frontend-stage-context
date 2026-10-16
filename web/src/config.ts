import { createConfig, http, fallback } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import {
  createPublicClient,
  defineChain,
  keccak256,
  toHex,
  type Abi,
  type Address,
  type Hex,
} from "viem";
export type Manifest = {
  version: 1;
  launchId: string;
  chainId: number;
  sourceCommit: string;
  attestationHash: string;
  contracts: {
    name: string;
    address: Address;
    abiHash: string;
    abiPath: string;
  }[];
  assets: { path: string; sha256: string }[];
  poolKey?: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
  network: {
    chainId: number;
    name: string;
    testnet: boolean;
    rpcUrls: string[];
    explorer: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    uniswapV4: {
      poolManager: Address;
      universalRouter: Address;
      quoter: Address;
      stateView: Address;
      positionManager: Address;
      permit2: Address;
      extendedSwapParams?: boolean;
    };
    pairToken: {
      address: Address;
      symbol: string;
      name: string;
      decimals: number;
    };
    otherPairTokens?: { address: Address; symbol: string; decimals: number }[];
  };
  walletAddChain?: Record<string, unknown>;
};
export const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
        )
      : v;
const relative = (p: string) =>
  /^[a-zA-Z0-9_./-]+$/.test(p) &&
  !p.startsWith("/") &&
  !p.split("/").includes("..");
export async function loadDeployment() {
  const response = await fetch("./imd-deployment.json", { cache: "no-store" });
  if (!response.ok)
    throw Error(
      "Deployment manifest could not be loaded. Reload from the complete static export.",
    );
  const manifest: Manifest = await response.json();
  if (
    manifest.version !== 1 ||
    manifest.chainId !== manifest.network?.chainId ||
    !manifest.network.rpcUrls.length ||
    manifest.contracts.length !== 7
  )
    throw Error("Invalid deployment configuration.");
  const abis: Record<string, Abi> = {};
  await Promise.all(
    manifest.contracts.map(async (c) => {
      if (!relative(c.abiPath)) throw Error("Unsafe ABI path");
      const r = await fetch("./" + c.abiPath);
      if (!r.ok) throw Error(`Missing ${c.name} ABI`);
      const abi = await r.json();
      if (
        !Array.isArray(abi) ||
        keccak256(toHex(JSON.stringify(canonical(abi)))).slice(2) !== c.abiHash
      )
        throw Error(`${c.name} ABI verification failed`);
      abis[c.name] = abi;
    }),
  );
  const chain = defineChain({
    id: manifest.chainId,
    name: manifest.network.name,
    nativeCurrency: manifest.network.nativeCurrency,
    rpcUrls: { default: { http: manifest.network.rpcUrls } },
    blockExplorers: {
      default: { name: manifest.network.name, url: manifest.network.explorer },
    },
    testnet: manifest.network.testnet,
  });
  const transport = fallback(
    manifest.network.rpcUrls.map((url) =>
      http(url, { timeout: 12000, retryCount: 1 }),
    ),
    { rank: false },
  );
  const client = createPublicClient({
    chain,
    transport,
    batch: { multicall: false },
  });
  const config = createConfig({
    chains: [chain],
    multiInjectedProviderDiscovery: true,
    connectors: [injected(), coinbaseWallet({ appName: "QUORUM" })],
    transports: { [chain.id]: transport },
  });
  const contract = (name: string) => {
    const c = manifest.contracts.find((x) => x.name === name);
    if (!c) throw Error(`Unknown contract: ${name}`);
    return { address: c.address, abi: abis[name] };
  };
  const history = (await fetch("./history.json").then((r) => r.json())) as {
    deploymentBlock: number;
  };
  return {
    manifest,
    abis,
    chain,
    client,
    config,
    contract,
    deploymentBlock: BigInt(history.deploymentBlock),
  };
}
export type Runtime = Awaited<ReturnType<typeof loadDeployment>>;
export const ZERO_HASH = ("0x" + "0".repeat(64)) as Hex;
export const ZERO_ADDRESS = ("0x" + "0".repeat(40)) as Address;
