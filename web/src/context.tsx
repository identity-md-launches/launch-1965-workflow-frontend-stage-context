import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useRef,
} from "react";
import { useAccount, useWalletClient, useConnect, useDisconnect } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPublicClient,
  custom,
  formatEther,
  encodeFunctionData,
  getAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { type Runtime, ZERO_ADDRESS } from "./config";
import { json, message, same, short } from "./lib";

export type Lang = "en" | "zh";
const Context = createContext<Runtime | null>(null);
const Locale = createContext<{
  lang: Lang;
  t: (en: string, zh: string) => string;
}>({ lang: "en", t: (en) => en });
export const useRuntime = () => useContext(Context)!;
export const useLocale = () => useContext(Locale);
export function Environment({
  runtime,
  lang,
  children,
}: {
  runtime: Runtime;
  lang: Lang;
  children: ReactNode;
}) {
  return (
    <Context.Provider value={runtime}>
      <Locale.Provider
        value={{ lang, t: (en, zh) => (lang === "zh" ? zh : en) }}
      >
        {children}
      </Locale.Provider>
    </Context.Provider>
  );
}
export function useRead() {
  const rt = useRuntime();
  return async (
    name: string,
    fn: string,
    args: readonly unknown[] = [],
    blockNumber?: bigint,
  ): Promise<any> =>
    rt.client.readContract({
      ...rt.contract(name),
      functionName: fn,
      args,
      ...(blockNumber ? { blockNumber } : {}),
    });
}
export function useVerification() {
  const rt = useRuntime();
  return useQuery({
    queryKey: ["verification"],
    queryFn: async () => {
      const chainId = await rt.client.getChainId();
      if (chainId !== rt.manifest.chainId)
        throw Error(
          "RPC chain ID does not match the deployment. Transactions are disabled.",
        );
      await Promise.all(
        rt.manifest.contracts.map(async (c) => {
          const code = await rt.client.getCode({ address: c.address });
          if (!code || code === "0x")
            throw Error(`${c.name} has no code on the configured chain.`);
        }),
      );
      const refs = [
        ["QuorumSeats", "token", "LaunchToken"],
        ["QuorumBoard", "seats", "QuorumSeats"],
        ["QuorumAssembly", "board", "QuorumBoard"],
        ["QuorumGovernance", "assemblyBook", "QuorumAssembly"],
        ["QuorumGovernance", "safePolicy", "QuorumSafePolicy"],
        ["QuorumReleases", "governance", "QuorumGovernance"],
      ];
      for (const [name, fn, target] of refs) {
        const v = (await rt.client.readContract({
          ...rt.contract(name),
          functionName: fn,
        })) as string;
        if (!same(v, rt.contract(target).address))
          throw Error(`${name} dependency mismatch.`);
      }
      return true;
    },
    staleTime: 60000,
    refetchInterval: 120000,
    retry: 0,
  });
}
export type Overview = {
  configurationHash: Hex;
  stakeAmount: bigint;
  connectedAtAdmission: bigint;
  nft: Address;
  constitutionHash: Hex;
  depositedCount: bigint;
  totalDeposited: bigint;
  admissionHash: Hex;
  admissionSource: string;
  owner: Address;
  handedOver: boolean;
  founder: Address;
  proposalCount: bigint;
  budgetCount: bigint;
  founderAcceptance: Hex;
  postCount: bigint;
  currentRelease: Hex;
  decimals: number;
  block: { number: bigint; timestamp: bigint; hash: Hex };
};
export function useOverview() {
  const rt = useRuntime(),
    read = useRead();
  return useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const block = await rt.client.getBlock();
      const fields = [
        ["QuorumSeats", "configurationHash"],
        ["QuorumSeats", "stakeAmount"],
        ["QuorumSeats", "connectedAtAdmission"],
        ["QuorumSeats", "nft"],
        ["QuorumSeats", "constitutionHash"],
        ["QuorumSeats", "depositedCount"],
        ["QuorumSeats", "totalDeposited"],
        ["QuorumSeats", "admissionHash"],
        ["QuorumSeats", "admissionSource"],
        ["QuorumSeats", "owner"],
        ["QuorumGovernance", "handedOver"],
        ["QuorumGovernance", "founder"],
        ["QuorumGovernance", "proposalCount"],
        ["QuorumGovernance", "budgetCount"],
        ["QuorumGovernance", "founderAcceptance"],
        ["QuorumBoard", "postCount"],
        ["QuorumReleases", "currentRelease"],
        ["LaunchToken", "decimals"],
      ];
      const values = await Promise.all(
        fields.map(([n, f]) => read(n, f, [], block.number)),
      );
      return {
        ...Object.fromEntries(fields.map(([, f], i) => [f, values[i]])),
        block,
      } as unknown as Overview;
    },
    refetchInterval: 30000,
    retry: 1,
  });
}
export function useSeat(id: string) {
  const rt = useRuntime(),
    read = useRead(),
    { address } = useAccount(),
    overview = useOverview();
  return useQuery({
    queryKey: ["seat", id, address],
    enabled: /^\d+$/.test(id) && !!overview.data,
    queryFn: async () => {
      const seat = BigInt(id),
        s = await read("QuorumSeats", "getSeat", [seat]);
      const fields = [
        ["QuorumSeats", "isDeposited"],
        ["QuorumSeats", "qualified"],
        ["QuorumBoard", "active"],
        ["QuorumBoard", "completedHours"],
        ["QuorumBoard", "lastCreditedHourPlusOne"],
        ["QuorumBoard", "attendance"],
      ];
      const values = await Promise.all(
        fields.map(([n, f]) => read(n, f, [seat])),
      );
      let nftOwner: Address | undefined, nftApproved: Address | undefined;
      if (overview.data?.nft !== ZERO_ADDRESS) {
        const abi = [
          {
            type: "function",
            name: "ownerOf",
            stateMutability: "view",
            inputs: [{ type: "uint256" }],
            outputs: [{ type: "address" }],
          },
          {
            type: "function",
            name: "getApproved",
            stateMutability: "view",
            inputs: [{ type: "uint256" }],
            outputs: [{ type: "address" }],
          },
        ] as Abi;
        [nftOwner, nftApproved] = (await Promise.all(
          ["ownerOf", "getApproved"].map((functionName) =>
            rt.client.readContract({
              address: overview.data!.nft,
              abi,
              functionName,
              args: [seat],
            }),
          ),
        )) as [Address, Address];
      }
      const authority = address
        ? await Promise.all(
            [0, 1, 2, 4, 8].map((scope) =>
              read("QuorumSeats", "validAgent", [
                seat,
                address,
                s.version,
                scope,
              ]),
            ),
          )
        : [false, false, false, false, false];
      const allowance =
        s.depositor !== ZERO_ADDRESS
          ? await read("LaunchToken", "allowance", [
              s.depositor,
              rt.contract("QuorumSeats").address,
            ])
          : 0n;
      const balance = address
        ? await read("LaunchToken", "balanceOf", [address])
        : 0n;
      return {
        ...s,
        ...Object.fromEntries(fields.map(([, f], i) => [f, values[i]])),
        nftOwner,
        nftApproved,
        authority,
        allowance,
        balance,
      };
    },
    refetchInterval: 30000,
    retry: 0,
  });
}
export function ErrorNote({ error }: { error: unknown }) {
  return error ? (
    <p className="error" role="alert">
      {message(error)}
    </p>
  ) : null;
}
export function AddressView({ value }: { value: string }) {
  const { manifest } = useRuntime(),
    { t } = useLocale();
  const [copied, setCopied] = useState(false);
  let a = value;
  try {
    a = getAddress(value);
  } catch {
    /* hashes and incomplete values remain readable */
  }
  return (
    <span className="address">
      <a
        href={`${manifest.network.explorer}/address/${a}`}
        target="_blank"
        rel="noreferrer"
      >
        {a}
      </a>
      <button
        className="small"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(a);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? t("Copied", "已复制") : t("Copy", "复制")}
      </button>
    </span>
  );
}
export function Data({ value }: { value: unknown }) {
  return <pre className="data">{json(value)}</pre>;
}
export function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
  hint?: string;
  required?: boolean;
}) {
  const id = useRef("f-" + crypto.randomUUID());
  return (
    <label className="field" htmlFor={id.current}>
      <span id={id.current + "-label"}>{label}</span>
      {type === "textarea" ? (
        <textarea
          id={id.current}
          aria-labelledby={id.current + "-label"}
          aria-describedby={hint ? id.current + "-hint" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      ) : (
        <input
          id={id.current}
          aria-labelledby={id.current + "-label"}
          aria-describedby={hint ? id.current + "-hint" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          required={required}
          spellCheck={false}
          autoComplete="off"
        />
      )}
      {hint && <small id={id.current + "-hint"}>{hint}</small>}
    </label>
  );
}
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    label = useRef("dialog-" + crypto.randomUUID()),
    { t } = useLocale();
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={label.current}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      onClose={onClose}
    >
      <div className="dialog-body">
        <div className="section-head">
          <h2 id={label.current}>{title}</h2>
          <button
            type="button"
            aria-label={t("Close", "关闭")}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export type Request = {
  name?: string;
  address?: Address;
  abi?: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  summary?: string;
  beforeSend?: () => void | Promise<void>;
};
type TxContextType = {
  send: (req: Request, label: string) => Promise<any>;
  busy: boolean;
};
const TxContext = createContext<TxContextType | null>(null);
export function Transactions({ children }: { children: ReactNode }) {
  const rt = useRuntime(),
    { t } = useLocale(),
    account = useAccount(),
    { data: wallet } = useWalletClient(),
    verify = useVerification(),
    query = useQueryClient();
  const [review, setReview] = useState<{
      label: string;
      req: any;
      gas: bigint;
      fee: bigint;
      resolve: (v: boolean) => void;
    } | null>(null),
    [busy, setBusy] = useState(false);
  const pendingKey = `quorum.pending:${rt.manifest.chainId}:${rt.manifest.launchId}`;
  const [pendingHash, setPendingHash] = useState<Hex | undefined>(() => {
    try {
      const saved = localStorage.getItem(pendingKey);
      return saved && /^0x[0-9a-f]{64}$/i.test(saved)
        ? (saved as Hex)
        : undefined;
    } catch {
      return undefined;
    }
  });
  const [journal, setJournal] = useState<
    { hash: Hex; status: "pending" | "confirmed" | "failed" } | undefined
  >(() => (pendingHash ? { hash: pendingHash, status: "pending" } : undefined));
  const [receiptError, setReceiptError] = useState<unknown>();
  const settleReceipt = async (receipt: any) => {
    setPendingHash(undefined);
    try {
      localStorage.removeItem(pendingKey);
    } catch {
      /* storage is optional */
    }
    setJournal({
      hash: receipt.transactionHash,
      status: receipt.status === "success" ? "confirmed" : "failed",
    });
    await query.invalidateQueries();
  };
  const lock = useRef(false);
  const send = async (req: Request, label: string) => {
    if (lock.current || pendingHash)
      throw Error("Finish or reconcile the pending transaction first.");
    lock.current = true;
    setBusy(true);
    try {
      if (!account.address || !wallet) throw Error("Connect your wallet.");
      if (account.chainId !== rt.manifest.chainId)
        throw Error("Switch to the configured chain first.");
      if (!verify.data || verify.isError)
        throw Error(
          "Contract verification is not complete. Retry the RPC check.",
        );
      const request = {
        ...(req.name
          ? rt.contract(req.name)
          : { address: req.address!, abi: req.abi! }),
        functionName: req.functionName,
        args: req.args ?? [],
        account: account.address,
        value: req.value ?? 0n,
      };
      const { request: simulated } = await rt.client.simulateContract(
        request as any,
      );
      const gas = await rt.client.estimateContractGas(request as any);
      const fee = await rt.client.getGasPrice();
      const agreed = await new Promise<boolean>((resolve) =>
        setReview({
          label: req.summary ?? label,
          req: request,
          gas,
          fee,
          resolve,
        }),
      );
      setReview(null);
      if (!agreed) throw Error("Review cancelled. Nothing was sent.");
      const current = await wallet.getChainId();
      const addresses = await wallet.getAddresses();
      if (
        current !== rt.manifest.chainId ||
        !same(addresses[0], account.address)
      )
        throw Error("Wallet changed. Review again.");
      await req.beforeSend?.();
      // Re-simulate after the review; state may have changed while it was open.
      await rt.client.simulateContract(request as any);
      const hash = await wallet.writeContract({
        ...simulated,
        chain: rt.chain,
        account: account.address,
      } as any);
      setPendingHash(hash);
      setJournal({ hash, status: "pending" });
      setReceiptError(undefined);
      try {
        localStorage.setItem(pendingKey, hash);
      } catch {
        /* still tracked in memory */
      }
      window.dispatchEvent(new CustomEvent("quorum:pending", { detail: hash }));
      const receipt = await rt.client.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 180000,
      });
      await settleReceipt(receipt);
      if (receipt.status !== "success")
        throw Error("Transaction reverted on chain. No success was recorded.");
      return receipt;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <TxContext.Provider value={{ send, busy: busy || !!pendingHash }}>
      {children}
      {journal && (
        <div
          className="transaction-journal"
          data-status={journal.status}
          role="status"
        >
          <strong>
            {journal.status === "confirmed"
              ? t("Transaction confirmed", "交易已确认")
              : journal.status === "failed"
                ? t("Transaction reverted", "交易已回滚")
                : t(
                    "Transaction submitted; confirmation pending",
                    "交易已提交，等待确认",
                  )}
          </strong>
          <a
            href={`${rt.manifest.network.explorer}/tx/${journal.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            {t("View transaction receipt", "查看交易收据")}
          </a>
          <span className="hash">{journal.hash}</span>
          {pendingHash && (
            <>
              <p>
                {t(
                  "Further transactions stay locked until this receipt is reconciled. A timeout is not a failed transaction.",
                  "核对本收据前暂停后续交易。超时不代表交易失败。",
                )}
              </p>
              <button
                disabled={busy}
                onClick={async () => {
                  setReceiptError(undefined);
                  try {
                    const receipt = await rt.client.getTransactionReceipt({
                      hash: pendingHash,
                    });
                    await settleReceipt(receipt);
                  } catch (e) {
                    setReceiptError(e);
                  }
                }}
              >
                {t("Check receipt", "检查收据")}
              </button>
              <ErrorNote error={receiptError} />
            </>
          )}
        </div>
      )}
      <Dialog
        open={!!review}
        onClose={() => review?.resolve(false)}
        title={t("Review transaction", "审核交易")}
      >
        {review && (
          <>
            <p>{review.label}</p>
            <dl>
              <dt>{t("Network", "网络")}</dt>
              <dd>
                {rt.manifest.network.name} · {rt.manifest.chainId}
              </dd>
              <dt>{t("Estimated network fee", "预计网络费")}</dt>
              <dd>{formatEther(review.gas * review.fee)} ETH</dd>
              <dt>{t("Transaction value", "交易金额")}</dt>
              <dd>{formatEther(review.req.value)} ETH</dd>
            </dl>
            <p className="muted">
              {t(
                "Estimate only. Your wallet shows the final fee. USD pricing is unavailable.",
                "仅为估算，最终费用以钱包显示为准。暂无美元价格。",
              )}
            </p>
            <Data
              value={{
                to: review.req.address,
                function: review.req.functionName,
                arguments: review.req.args,
                calldata: encodeFunctionData({
                  abi: review.req.abi,
                  functionName: review.req.functionName,
                  args: review.req.args,
                }),
              }}
            />
            <button className="primary" onClick={() => review.resolve(true)}>
              {t("Confirm in wallet", "在钱包中确认")}
            </button>
          </>
        )}
      </Dialog>
    </TxContext.Provider>
  );
}
export const useTransactions = () => useContext(TxContext)!;
export function TxButton({
  label,
  request,
  disabled = false,
  reason,
  after,
  primary = false,
}: {
  label: string;
  request: () => Request | Promise<Request>;
  disabled?: boolean;
  reason?: string;
  after?: (receipt: any) => void | Promise<void>;
  primary?: boolean;
}) {
  const tx = useTransactions(),
    { t } = useLocale(),
    rt = useRuntime(),
    account = useAccount(),
    { data: readyWallet } = useWalletClient(),
    verify = useVerification();
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(),
    [hash, setHash] = useState<Hex>();
  const [confirmed, setConfirmed] = useState(false);
  const gated =
    !account.address ||
    !readyWallet ||
    account.chainId !== rt.manifest.chainId ||
    !verify.data ||
    verify.isError;
  useEffect(() => {
    const h = (e: Event) => {
      if (pending) setHash((e as CustomEvent).detail);
    };
    window.addEventListener("quorum:pending", h);
    return () => window.removeEventListener("quorum:pending", h);
  }, [pending]);
  return (
    <div className="action">
      <button
        className={primary ? "primary" : ""}
        disabled={disabled || gated || tx.busy}
        onClick={async () => {
          setPending(true);
          setError(undefined);
          setHash(undefined);
          setConfirmed(false);
          try {
            const receipt = await tx.send(await request(), label);
            setHash(receipt.transactionHash);
            setConfirmed(true);
            await after?.(receipt);
          } catch (e) {
            setError(e);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending
          ? t("Review / confirmation pending…", "等待审核 / 确认…")
          : label}
      </button>
      {reason && disabled && <small>{reason}</small>}
      <ErrorNote error={error} />
      {hash && (
        <p role="status">
          <a
            target="_blank"
            rel="noreferrer"
            href={`${rt.manifest.network.explorer}/tx/${hash}`}
          >
            {confirmed
              ? t("Confirmed · view receipt", "已确认 · 查看收据")
              : t("Submitted · view transaction", "已提交 · 查看交易")}
          </a>
        </p>
      )}
    </div>
  );
}
export function RpcStatus() {
  const rt = useRuntime(),
    q = useVerification(),
    overview = useOverview(),
    query = useQueryClient(),
    { connector } = useAccount(),
    { t } = useLocale();
  const [fallback, setFallback] = useState(false);
  return (
    <div className="rpc-status">
      <span className={q.data && !q.error ? "dot good" : "dot"} />
      <span>
        {q.isError || overview.isError
          ? t("RPC unavailable", "RPC 不可用")
          : q.data
            ? t("Contracts verified", "合约已验证")
            : t("Verifying contracts…", "正在验证合约…")}
      </span>
      {overview.data && (
        <span className="mono">#{overview.data.block.number.toString()}</span>
      )}
      <button className="small" onClick={() => query.invalidateQueries()}>
        {t("Refresh", "刷新")}
      </button>
      {(q.isError || overview.isError) && connector && !fallback && (
        <button
          className="small"
          onClick={async () => {
            const provider = await connector.getProvider();
            rt.client = createPublicClient({
              chain: rt.chain,
              transport: custom(provider as any),
            }) as unknown as Runtime["client"];
            setFallback(true);
            await query.invalidateQueries();
          }}
        >
          {t("Use wallet RPC", "使用钱包 RPC")}
        </button>
      )}
      <ErrorNote error={q.error || overview.error} />
    </div>
  );
}
