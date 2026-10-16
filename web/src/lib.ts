import {
  isAddress,
  getAddress,
  parseUnits,
  type Address,
  type Hex,
  BaseError,
  ContractFunctionRevertedError,
} from "viem";
export const json = (value: unknown) =>
  JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
export const same = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const bytes = (s: string) => new TextEncoder().encode(s).length;
export function address(s: string): Address {
  if (!isAddress(s.trim(), { strict: true }))
    throw Error(
      "Enter a valid EVM address with a valid checksum or lowercase letters.",
    );
  return getAddress(s.trim());
}
export function uint(s: string, bits = 256) {
  if (!/^\d+$/.test(s.trim()))
    throw Error("Enter a non-negative whole number.");
  const n = BigInt(s.trim());
  if (n >= 2n ** BigInt(bits)) throw Error(`Value exceeds uint${bits}.`);
  return n;
}
export function hash(s: string): Hex {
  if (!/^0x[\da-fA-F]{64}$/.test(s.trim()))
    throw Error(
      "Enter a complete 32-byte hash (0x plus 64 hexadecimal characters).",
    );
  return s.trim() as Hex;
}
export function hex(s: string): Hex {
  if (!/^0x(?:[\da-fA-F]{2})*$/.test(s.trim()))
    throw Error("Enter complete hexadecimal bytes, starting with 0x.");
  return s.trim() as Hex;
}
export function amount(s: string, decimals: number) {
  if (!/^\d+(\.\d+)?$/.test(s) || Number(s) <= 0)
    throw Error("Enter an amount greater than zero.");
  if ((s.split(".")[1]?.length ?? 0) > decimals)
    throw Error(`Use at most ${decimals} decimal places.`);
  return parseUnits(s, decimals);
}
export function boundedText(s: string, max = 2048) {
  if (bytes(s) === 0 || bytes(s) > max)
    throw Error(`Text must contain 1–${max} UTF-8 bytes.`);
  return s;
}
export function message(e: unknown) {
  const err = e as { code?: number; shortMessage?: string; message?: string };
  if (
    err?.code === 4001 ||
    /user rejected|user denied|request rejected/i.test(err?.message ?? "")
  )
    return "Request declined in your wallet. Nothing was confirmed. You can retry.";
  const reverted =
    e instanceof BaseError
      ? e.walk((x) => x instanceof ContractFunctionRevertedError)
      : undefined;
  const code =
    reverted instanceof ContractFunctionRevertedError
      ? reverted.data?.errorName === "Error"
        ? String(reverted.data.args?.[0] ?? reverted.reason)
        : (reverted.data?.errorName ?? reverted.reason)
      : undefined;
  const known: Record<string, string> = {
    AdmissionNotConfigured: "The Safe must configure admission before joining.",
    OwnerOrApproval:
      "Connect the NFT owner and approve this exact NFT to the seat vault.",
    UnauthorizedAgent:
      "Use the current authorized agent key. Check expiry and NFT approval.",
    AlreadyCredited:
      "This seat already has feedback for the current chain hour.",
    FeedbackWrongHour: "The hour changed. Prepare fresh feedback.",
    ProposerInactive: "An active seat is required to open a proposal.",
    NotExecutable:
      "Voting, timelock, acceptance or execution conditions are not satisfied.",
    BootstrapOnly:
      "Treasury execution is unavailable until the explicit governance handover.",
    WorkAcceptanceRequired: "The exact work needs a current eligible acceptor.",
    VoteClosedOrDuplicate: "Voting has ended or this seat has already voted.",
    NotInElectorate: "This seat is not in the frozen electorate.",
    ExitPending: "The seven-day exit delay has not finished.",
    OnlyMajorExecution: "This setting requires execution of a major proposal.",
    BundleMismatch:
      "Configuration changed. Refresh and review the new handover commitment.",
  };
  return code
    ? (known[code] ??
        `Contract rejected the action: ${code}. Refresh state and review its requirements.`)
    : (
        err?.shortMessage ??
        err?.message ??
        "Request failed. Check your connection and retry."
      ).slice(0, 500);
}
export function executionReady(
  p: {
    executed: boolean;
    end: bigint;
    executableAt: bigint;
    expires: bigint;
    kind: number;
  },
  now: bigint,
  passed: boolean,
  accepted: boolean,
  handedOver: boolean,
) {
  return (
    !p.executed &&
    now >= p.end &&
    now >= p.executableAt &&
    now <= p.expires &&
    passed &&
    accepted &&
    (p.kind === 2 || handedOver)
  );
}
export const feedbackTypes = {
  Feedback: [
    { name: "seat", type: "uint256" },
    { name: "authorizationVersion", type: "uint64" },
    { name: "generation", type: "uint64" },
    { name: "hour", type: "uint64" },
    { name: "anchorBlock", type: "uint64" },
    { name: "anchorHash", type: "bytes32" },
    { name: "revision", type: "uint64" },
    { name: "contentHash", type: "bytes32" },
    { name: "status", type: "uint8" },
  ],
} as const;
