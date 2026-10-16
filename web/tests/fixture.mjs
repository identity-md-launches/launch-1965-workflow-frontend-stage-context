// Offline test fixture only. Never imported by the production app.
import { readFile } from "node:fs/promises";
import {
  decodeFunctionData,
  encodeFunctionResult,
  encodeEventTopics,
  encodeAbiParameters,
  encodeErrorResult,
  parseAbi,
  keccak256,
  toHex,
  erc20Abi,
} from "viem";
import { quoterAbi, routerAbi, permitAbi, stateAbi } from "../src/swap-core.ts";
export const handoff = JSON.parse(
  await readFile(new URL("../deployment-input.json", import.meta.url), "utf8"),
);
export const net = JSON.parse(
  await readFile(new URL("../network-input.json", import.meta.url), "utf8"),
);
const abis = Object.fromEntries(
  await Promise.all(
    handoff.contracts.map(async (c) => [
      c.name,
      JSON.parse(
        await readFile(
          new URL(`../../docs/abi/${c.name}.json`, import.meta.url),
          "utf8",
        ),
      ),
    ]),
  ),
);
const addresses = Object.fromEntries(
  handoff.contracts.map((c) => [c.name, c.address]),
);
const zero = "0x" + "0".repeat(64),
  empty = "0x" + "0".repeat(40);
const tagged = (s) => keccak256(toHex(s));
export const founder = handoff.manifest.contracts.find(
  (c) => c.contract === "QuorumGovernance",
).constructorArgs[4];
// Safe is a provided identity; tests use its address as a mocked owner without its key.
export const owner = "0xf9c003d5a247bb5282b2d6df534ed51860b14210";
const nftAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns(address)",
  "function getApproved(uint256 tokenId) view returns(address)",
  "function approve(address to,uint256 tokenId)",
]);
export function fixture() {
  const f = {
    connected: false,
    account: founder,
    walletChain: "0x2",
    chainAdded: false,
    rejectConnect: false,
    rejectSend: false,
    revertSimulation: false,
    missingCode: false,
    rpcDown: false,
    configured: true,
    credited: false,
    ercAllowance: 0n,
    permitAmount: 0n,
    permitExpiry: 0,
    block: BigInt(handoff.contracts[0].blockNumber) + 1000n,
    timestamp: 1792152000n,
    postCount: 0n,
    proposalCount: 0n,
    voted: false,
    posts: [],
    receipts: new Map(),
    requests: [],
    sent: [],
    handedOver: false,
    proposal: null,
  };
  function block(n = f.block) {
    return {
      number: toHex(n),
      hash: tagged("block" + n),
      parentHash: tagged("block" + (n - 1n)),
      nonce: "0x0000000000000000",
      sha3Uncles: tagged("uncles"),
      logsBloom: "0x" + "0".repeat(512),
      transactionsRoot: tagged("transactions"),
      stateRoot: tagged("state"),
      receiptsRoot: tagged("receipts"),
      miner: owner,
      difficulty: "0x0",
      totalDifficulty: "0x0",
      extraData: "0x",
      size: "0x100",
      gasLimit: "0x1c9c380",
      gasUsed: "0x10000",
      timestamp: toHex(f.timestamp),
      transactions: [],
      uncles: [],
      baseFeePerGas: "0x3b9aca00",
      mixHash: tagged("mix"),
      withdrawalsRoot: tagged("withdrawals"),
      withdrawals: [],
      blobGasUsed: "0x0",
      excessBlobGas: "0x0",
    };
  }
  function identify(to, data) {
    const c = handoff.contracts.find((c) => c.address === to?.toLowerCase());
    const known =
      to?.toLowerCase() === net.network.uniswapV4.quoter
        ? ["quoter", quoterAbi]
        : to?.toLowerCase() === net.network.uniswapV4.universalRouter
          ? ["router", routerAbi]
          : to?.toLowerCase() === net.network.uniswapV4.permit2
            ? ["permit", permitAbi]
            : to?.toLowerCase() === net.network.uniswapV4.stateView
              ? ["state", stateAbi]
              : null;
    const candidates = [
      ...(to?.toLowerCase() === net.network.pairToken.address
        ? [["erc20", erc20Abi]]
        : []),
      ...(known ? [known] : []),
      ...(c ? [[c.name, abis[c.name]]] : []),
      ["nft", nftAbi],
      ["erc20", erc20Abi],
    ];
    for (const [name, abi] of candidates) {
      try {
        return { name, abi, ...decodeFunctionData({ abi, data }) };
      } catch {}
    }
    throw Error("Unknown fixture call " + to + " " + data);
  }
  function post(
    body = "Fixture discussion",
    kind = 0,
    proposal = 0n,
    parent = 0n,
    commitment = zero,
  ) {
    return {
      seat: 7n,
      version: 1n,
      timestamp: f.timestamp,
      kind,
      proposal,
      parent,
      commitment,
      body,
    };
  }
  function read(name, fn, args = []) {
    const refs = {
      QuorumSeats: { token: "LaunchToken" },
      QuorumBoard: { seats: "QuorumSeats" },
      QuorumAssembly: { seats: "QuorumSeats", board: "QuorumBoard" },
      QuorumGovernance: {
        seats: "QuorumSeats",
        board: "QuorumBoard",
        assemblyBook: "QuorumAssembly",
        safePolicy: "QuorumSafePolicy",
      },
      QuorumReleases: { governance: "QuorumGovernance" },
    };
    if (refs[name]?.[fn]) return addresses[refs[name][fn]];
    const constants = {
      configurationHash: f.configured ? tagged("configured") : zero,
      constitutionHash: handoff.manifest.contracts[0].constructorArgs[2],
      stakeAmount: 1000n * 10n ** 18n,
      connectedAtAdmission: f.configured ? 10n : 0n,
      nft: f.configured ? addresses.QuorumReleases : empty,
      depositedCount: 0n,
      totalDeposited: 0n,
      admissionHash: f.configured ? tagged("dataset") : zero,
      admissionSource: f.configured ? "Fixture admission dataset" : "",
      owner,
      founder,
      handedOver: f.handedOver,
      proposalCount: f.proposalCount,
      budgetCount: 0n,
      founderAcceptance: zero,
      postCount: f.postCount,
      currentRelease: zero,
      decimals: 18,
      name: "QUORUM",
      symbol: name === "erc20" ? "IMD" : "QRM",
      totalSupply: 10n ** 27n,
      latestRevision: f.postCount,
      revisionAtBlock: f.postCount,
      active: true,
      qualified: true,
      isDeposited: true,
      completedHours: 18n,
      validAgent: true,
      ownerOf: owner,
      getApproved: addresses.QuorumSeats,
      hasVoted: f.voted,
      eligible: true,
      quorum: 5n,
      passed: false,
      workAccepted: true,
      handoverCommitment: tagged("bundle"),
      actionBinding: tagged("binding"),
      proposalCommitment: tagged("commitment"),
      snapshotCount: 0n,
    };
    if (fn === "getSeat")
      return {
        depositor: owner,
        agent: founder,
        version: 1n,
        expires: f.timestamp + 86400n * 30n,
        scopes: 15,
        acceptedConstitution: constants.constitutionHash,
        stakeLimit: constants.stakeAmount,
        activationAt: f.timestamp - 86400n,
        exitAt: 0n,
        generation: 1n,
      };
    if (fn === "lastCreditedHourPlusOne")
      return f.credited ? f.timestamp / 3600n + 1n : 0n;
    if (fn === "attendance") return [f.timestamp / 3600n - 1n, 1n, 1n, 262143];
    if (fn === "getRevision")
      return { blockNumber: f.block - 16n, contentHash: tagged("revision") };
    if (fn === "balanceOf") return 10n ** 30n;
    if (fn === "allowance")
      return name === "permit"
        ? [f.permitAmount, f.permitExpiry, 0]
        : name === "LaunchToken"
          ? constants.stakeAmount
          : f.ercAllowance;
    if (fn === "getSlot0") return [2n ** 96n, 0, 0, 12500];
    if (fn === "quoteExactInputSingle")
      return [args[0].exactAmount * 2n, 120000n];
    if (fn === "getPosts")
      return f.posts.slice(Number(args[0]), Number(args[0] + args[1]));
    if (fn === "getPost") return f.posts[Number(args[0]) - 1] ?? post();
    if (fn === "getProposal")
      return (
        f.proposal ?? {
          proposer: 7n,
          postId: 1n,
          snapshot: 1n,
          workHash: zero,
          kind: 1,
          start: f.timestamp - 100n,
          end: f.timestamp + 172800n,
          executableAt: f.timestamp + 259200n,
          expires: f.timestamp + 1500000n,
          electorate: 10,
          ownerDiversity: 5,
          yes: 0,
          no: 0,
          abstain: 0,
          executed: false,
          commitment: tagged("commitment"),
          constitution: constants.constitutionHash,
          handoverBundle: zero,
          budget: 0n,
          amount: 0n,
        }
      );
    if (fn === "getActions")
      return [
        {
          target: addresses.LaunchToken,
          value: 0n,
          data: "0x",
          expectedReturnHash: zero,
        },
      ];
    if (fn === "getAcceptors") return [];
    if (fn === "liveProposal") return 0n;
    if (fn in constants) return constants[fn];
    if (fn === "post" || fn === "postWithFeedback") return f.postCount + 1n;
    if (
      fn === "proposeMajor" ||
      fn === "proposeSpend" ||
      fn === "proposeHandover"
    )
      return f.proposalCount + 1n;
    if (fn === "approve" || fn === "transfer" || fn === "transferFrom")
      return name === "permit" || name === "nft" ? undefined : true;
    if (fn === "registerWork") return tagged("work");
    if (fn === "snapshot") return [1n, 10, 5];
    return undefined;
  }
  function logFor(name, eventName, args, tx, index = 0) {
    const abi = abis[name],
      event = abi.find((e) => e.type === "event" && e.name === eventName);
    const inputs = event.inputs.filter((i) => !i.indexed);
    return {
      address: addresses[name],
      topics: encodeEventTopics({ abi, eventName, args }),
      data: encodeAbiParameters(
        inputs,
        inputs.map((i) => args[i.name]),
      ),
      blockNumber: toHex(f.block),
      blockHash: tagged("block" + f.block),
      transactionHash: tx,
      transactionIndex: "0x0",
      logIndex: toHex(index),
      removed: false,
    };
  }
  f.rpc = async (method, params = []) => {
    f.requests.push({ method, params });
    if (f.rpcDown)
      throw Object.assign(Error("Fixture RPC offline"), { code: -32000 });
    if (method === "eth_chainId") return "0x1";
    if (method === "net_version") return "1";
    if (method === "eth_blockNumber") return toHex(f.block);
    if (method === "eth_getBlockByNumber")
      return block(params[0] === "latest" ? f.block : BigInt(params[0]));
    if (method === "eth_getBlockByHash") return block();
    if (method === "eth_getCode") return f.missingCode ? "0x" : "0x6001600055";
    if (method === "eth_getBalance") return toHex(100n * 10n ** 18n);
    if (method === "eth_gasPrice" || method === "eth_maxPriorityFeePerGas")
      return "0x3b9aca00";
    if (method === "eth_estimateGas") return "0x30d40";
    if (method === "eth_getTransactionCount") return "0x0";
    if (method === "eth_getLogs") return [];
    if (method === "eth_call") {
      const d = identify(params[0].to, params[0].data);
      if (
        f.revertSimulation &&
        ["recordFeedback", "execute", "vote"].includes(d.functionName)
      )
        throw Object.assign(Error("execution reverted"), {
          code: 3,
          data: encodeErrorResult({
            abi: parseAbi(["error Error(string reason)"]),
            errorName: "Error",
            args: ["FeedbackWrongHour"],
          }),
        });
      const result = read(d.name, d.functionName, d.args);
      return encodeFunctionResult({
        abi: d.abi,
        functionName: d.functionName,
        result,
      });
    }
    if (method === "eth_getTransactionReceipt")
      return f.receipts.get(params[0]) ?? null;
    if (method === "eth_getTransactionByHash") return null;
    throw Object.assign(Error("Unsupported fixture RPC " + method), {
      code: -32601,
    });
  };
  f.wallet = async (method, params = []) => {
    if (method === "eth_chainId") return f.walletChain;
    if (method === "eth_accounts" && !f.connected) return [];
    if (method === "eth_accounts" || method === "eth_requestAccounts") {
      if (f.rejectConnect)
        throw Object.assign(Error("User rejected connection"), { code: 4001 });
      f.connected = true;
      return [f.account];
    }
    if (method === "wallet_switchEthereumChain") {
      f.requests.push({ method, params });
      if (!f.chainAdded)
        throw Object.assign(Error("Unknown chain"), { code: 4902 });
      f.walletChain = params[0].chainId;
      return null;
    }
    if (method === "wallet_addEthereumChain") {
      f.requests.push({ method, params });
      f.chainAdded = true;
      return null;
    }
    if (method === "eth_signTypedData_v4") {
      f.requests.push({ method, params });
      return "0x" + "11".repeat(65);
    }
    if (method === "wallet_getCapabilities") return {};
    if (method === "wallet_requestPermissions")
      return [{ parentCapability: "eth_accounts" }];
    if (method === "eth_sendTransaction") {
      if (f.rejectSend)
        throw Object.assign(Error("User rejected transaction"), { code: 4001 });
      const tx = params[0],
        d = identify(tx.to, tx.data),
        txHash = tagged("test transaction " + f.sent.length),
        logs = [];
      f.sent.push({ tx, ...d });
      if (d.functionName === "approve") {
        if (d.name === "permit") {
          f.permitAmount = d.args[2];
          f.permitExpiry = d.args[3];
        } else f.ercAllowance = d.args[1];
      }
      if (d.functionName === "recordFeedback") f.credited = true;
      if (d.functionName === "post" || d.functionName === "postWithFeedback") {
        f.postCount++;
        const a = d.args;
        f.posts.push({
          ...post(a[6], a[2], a[3], a[4], a[5]),
          seat: a[0],
          version: a[1],
        });
        logs.push(
          logFor(
            "QuorumBoard",
            "Posted",
            {
              postId: f.postCount,
              seat: a[0],
              proposal: a[3],
              kind: a[2],
              parent: a[4],
              commitment: a[5],
              body: a[6],
            },
            txHash,
          ),
        );
      }
      if (d.functionName.startsWith("propose")) f.proposalCount++;
      if (d.functionName.startsWith("vote")) f.voted = true;
      f.receipts.set(txHash, {
        transactionHash: txHash,
        transactionIndex: "0x0",
        blockHash: tagged("block" + f.block),
        blockNumber: toHex(f.block),
        from: f.account,
        to: tx.to,
        cumulativeGasUsed: "0x30d40",
        gasUsed: "0x30d40",
        contractAddress: null,
        logs,
        logsBloom: "0x" + "0".repeat(512),
        status: "0x1",
        effectiveGasPrice: "0x3b9aca00",
        type: "0x2",
      });
      return txHash;
    }
    return f.rpc(method, params);
  };
  return f;
}
export async function installFixture(page, f) {
  await page.exposeFunction("__quorumWallet", async ({ method, params }) => {
    try {
      return { result: await f.wallet(method, params) };
    } catch (e) {
      return { error: { message: e.message, code: e.code, data: e.data } };
    }
  });
  await page.route(
    /^https:\/\/(ethereum-rpc\.publicnode\.com|eth\.drpc\.org)/,
    async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
          },
        });
      const body = request.postDataJSON();
      const response = async (q) => {
        try {
          return {
            jsonrpc: "2.0",
            id: q.id,
            result: await f.rpc(q.method, q.params),
          };
        } catch (e) {
          return {
            jsonrpc: "2.0",
            id: q.id,
            error: { code: e.code ?? -32000, message: e.message, data: e.data },
          };
        }
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(
          Array.isArray(body)
            ? await Promise.all(body.map(response))
            : await response(body),
        ),
      });
    },
  );
  await page.addInitScript(() => {
    const listeners = {};
    const provider = {
      isMetaMask: false,
      request: async (args) => {
        const r = await window.__quorumWallet(args);
        if (r.error) {
          const e = new Error(r.error.message);
          Object.assign(e, r.error);
          throw e;
        }
        if (args.method === "wallet_switchEthereumChain")
          (listeners.chainChanged ?? []).forEach((fn) =>
            fn(args.params[0].chainId),
          );
        return r.result;
      },
      on: (event, fn) => {
        (listeners[event] ??= []).push(fn);
      },
      removeListener: (event, fn) => {
        listeners[event] = (listeners[event] ?? []).filter((x) => x !== fn);
      },
    };
    window.ethereum = provider;
    window.__fixtureEmit = (event, data) =>
      (listeners[event] ?? []).forEach((fn) => fn(data));
    const detail = {
      info: {
        uuid: "a9064445-07a8-401e-8d59-83fa4054f387",
        name: "Fixture Wallet",
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
        rdns: "test.fixture.wallet",
      },
      provider,
    };
    window.addEventListener("eip6963:requestProvider", () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", { detail }),
      ),
    );
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", { detail }),
    );
  });
}
