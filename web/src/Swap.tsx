import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import {
  erc20Abi,
  formatUnits,
  formatEther,
  parseUnits,
  type Address,
} from "viem";
import {
  useRuntime,
  useLocale,
  Field,
  TxButton,
  ErrorNote,
  AddressView,
  Data,
} from "./context";
import { amount, same } from "./lib";
import { ZERO_ADDRESS } from "./config";
import {
  quoterAbi,
  routerAbi,
  permitAbi,
  stateAbi,
  poolId,
  minimumOutput,
  encodeSwap,
  slippageBasisPoints,
} from "./swap-core";
export function Swap() {
  const rt = useRuntime(),
    { t } = useLocale(),
    { address: account } = useAccount();
  const key = rt.manifest.poolKey,
    network = rt.manifest.network;
  const [buy, setBuy] = useState(true),
    [input, setInput] = useState(""),
    [slippage, setSlippage] = useState("0.5"),
    [quote, setQuote] = useState<{
      out: bigint;
      min: bigint;
      amount: bigint;
      at: number;
      block: bigint;
      input: Address;
      slippage: number;
    }>(),
    [error, setError] = useState<unknown>(),
    [quoting, setQuoting] = useState(false);
  const qrm = rt.contract("LaunchToken").address,
    pair = network.pairToken;
  const inAddress = buy ? pair.address : qrm,
    outAddress = buy ? qrm : pair.address;
  const metadata = useQuery({
    queryKey: ["swapMetadata"],
    enabled: !!key,
    queryFn: async () => {
      if (!key) throw Error("No attested pool.");
      if (
        ![key.currency0, key.currency1].some((a) => same(a, qrm)) ||
        ![key.currency0, key.currency1].some((a) => same(a, pair.address))
      )
        throw Error("Pool does not match the configured token pair.");
      await Promise.all(
        [
          network.uniswapV4.quoter,
          network.uniswapV4.universalRouter,
          network.uniswapV4.permit2,
          network.uniswapV4.stateView,
        ].map(async (address) => {
          if (!(await rt.client.getCode({ address })))
            throw Error("A configured Uniswap contract has no code.");
        }),
      );
      const [qrmDecimals, qrmSymbol, pairDecimals, pairSymbol, slot] =
        await Promise.all([
          rt.client.readContract({
            address: qrm,
            abi: rt.abis.LaunchToken,
            functionName: "decimals",
          }),
          rt.client.readContract({
            address: qrm,
            abi: rt.abis.LaunchToken,
            functionName: "symbol",
          }),
          rt.client.readContract({
            address: pair.address,
            abi: erc20Abi,
            functionName: "decimals",
          }),
          rt.client.readContract({
            address: pair.address,
            abi: erc20Abi,
            functionName: "symbol",
          }),
          rt.client.readContract({
            address: network.uniswapV4.stateView,
            abi: stateAbi,
            functionName: "getSlot0",
            args: [poolId(key)],
          }),
        ]);
      if (Number(pairDecimals) !== pair.decimals)
        throw Error(
          "Pair token decimals disagree with the vetted configuration.",
        );
      if (slot[0] === 0n) throw Error("The attested pool is not initialized.");
      return {
        qrmDecimals: Number(qrmDecimals),
        qrmSymbol: String(qrmSymbol),
        pairDecimals,
        pairSymbol,
        slot,
      };
    },
    staleTime: 30000,
    retry: 0,
  });
  const inDecimals = buy
      ? metadata.data?.pairDecimals
      : metadata.data?.qrmDecimals,
    outDecimals = buy
      ? metadata.data?.qrmDecimals
      : metadata.data?.pairDecimals,
    inSymbol = buy ? pair.symbol : "QRM",
    outSymbol = buy ? "QRM" : pair.symbol;
  const allowances = useQuery({
    queryKey: ["swapAllowances", account, inAddress],
    enabled: !!account && !!metadata.data,
    queryFn: async () => {
      const [balance, erc, permit, block] = await Promise.all([
        rt.client.readContract({
          address: inAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [account!],
        }),
        rt.client.readContract({
          address: inAddress,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account!, network.uniswapV4.permit2],
        }),
        rt.client.readContract({
          address: network.uniswapV4.permit2,
          abi: permitAbi,
          functionName: "allowance",
          args: [account!, inAddress, network.uniswapV4.universalRouter],
        }),
        rt.client.getBlock(),
      ]);
      return { balance, erc, permit, now: block.timestamp };
    },
    refetchInterval: 15000,
    retry: 0,
  });
  useEffect(() => {
    setQuote(undefined);
    setError(undefined);
  }, [input, buy, slippage, account]);
  async function getQuote() {
    setQuoting(true);
    setError(undefined);
    setQuote(undefined);
    try {
      if (!key || inDecimals === undefined)
        throw Error("Wait for pool and token verification.");
      const a = amount(input, inDecimals);
      if (a >= 2n ** 128n) throw Error("Amount exceeds the pool input bound.");
      const bps = slippageBasisPoints(slippage);
      const block = await rt.client.getBlock();
      const result = await rt.client.simulateContract({
        address: network.uniswapV4.quoter,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            poolKey: key,
            zeroForOne: same(inAddress, key.currency0),
            exactAmount: a,
            hookData: "0x",
          },
        ],
        ...(account ? { account } : {}),
        blockNumber: block.number,
      });
      const out = result.result[0];
      setQuote({
        out,
        min: minimumOutput(out, bps),
        amount: a,
        at: Date.now(),
        block: block.number,
        input: inAddress,
        slippage: bps,
      });
    } catch (e) {
      setError(e);
    } finally {
      setQuoting(false);
    }
  }
  const validQuote = () => {
    if (
      !quote ||
      Date.now() - quote.at > 60000 ||
      !same(quote.input, inAddress) ||
      quote.amount !== amount(input, inDecimals!)
    )
      throw Error("Quote expired or input changed. Request a new quote.");
    return quote;
  };
  const needErc =
      !!quote && (!allowances.data || allowances.data.erc < quote.amount),
    needPermit =
      !!quote &&
      (!allowances.data ||
        allowances.data.permit[0] < quote.amount ||
        BigInt(allowances.data.permit[1]) <= allowances.data.now + 60n);
  return (
    <>
      <div className="page-heading">
        <h1>{t("Trade the attested pool.", "交易已证明的资金池。")}</h1>
        <p>
          {t(
            "Swap IMD and QRM through the configured Uniswap v4 router.",
            "通过配置的 Uniswap v4 路由交换 IMD 与 QRM。",
          )}
        </p>
      </div>
      <div className="overview-grid">
        <section className="panel swap">
          <h2>{t("Swap tokens", "交换代币")}</h2>
          <div className="segmented">
            <button aria-pressed={buy} onClick={() => setBuy(true)}>
              {t("Buy QRM", "买入 QRM")}
            </button>
            <button aria-pressed={!buy} onClick={() => setBuy(false)}>
              {t("Sell QRM", "卖出 QRM")}
            </button>
          </div>
          <Field
            label={t(`You pay (${inSymbol})`, `支付（${inSymbol}）`)}
            value={input}
            onChange={setInput}
          />
          <p className="muted">
            {t("Balance", "余额")}:{" "}
            {allowances.data && inDecimals !== undefined
              ? formatUnits(allowances.data.balance, inDecimals)
              : "…"}{" "}
            {inSymbol}
          </p>
          <Field
            label={t("Slippage tolerance (%)", "滑点容忍度（%）")}
            value={slippage}
            onChange={setSlippage}
            hint={t(
              "0.01%–5%. Quotes expire after 60 seconds.",
              "0.01%–5%，报价 60 秒后失效。",
            )}
          />
          <button onClick={getQuote} disabled={quoting || !metadata.data}>
            {quoting ? t("Quoting…", "正在报价…") : t("Get quote", "获取报价")}
          </button>
          <ErrorNote error={metadata.error || error || allowances.error} />
          {quote && (
            <>
              <dl>
                <dt>{t("Expected output", "预计获得")}</dt>
                <dd>
                  {formatUnits(quote.out, outDecimals!)} {outSymbol}
                </dd>
                <dt>{t("Minimum received", "最少获得")}</dt>
                <dd>
                  {formatUnits(quote.min, outDecimals!)} {outSymbol}
                </dd>
                <dt>{t("Rate", "汇率")}</dt>
                <dd>
                  1 {inSymbol} ≈{" "}
                  {(
                    Number(formatUnits(quote.out, outDecimals!)) / Number(input)
                  ).toPrecision(6)}{" "}
                  {outSymbol}
                </dd>
                <dt>{t("Quote block", "报价区块")}</dt>
                <dd>{String(quote.block)}</dd>
              </dl>
              {needErc ? (
                <TxButton
                  label={t(
                    `1. Approve ${inSymbol} to Permit2`,
                    `1. 向 Permit2 批准 ${inSymbol}`,
                  )}
                  disabled={!allowances.data}
                  request={() => {
                    const q = validQuote();
                    return {
                      address: inAddress,
                      abi: erc20Abi,
                      functionName: "approve",
                      args: [network.uniswapV4.permit2, q.amount],
                      summary: t(
                        `Approve exactly ${formatUnits(q.amount, inDecimals!)} ${inSymbol} to the configured Permit2 contract.`,
                        `向配置的 Permit2 合约批准准确 ${formatUnits(q.amount, inDecimals!)} ${inSymbol}。`,
                      ),
                    };
                  }}
                  after={() => getQuote()}
                />
              ) : needPermit ? (
                <TxButton
                  label={t(
                    "2. Approve router in Permit2",
                    "2. 在 Permit2 中批准路由",
                  )}
                  request={async () => {
                    const q = validQuote(),
                      block = await rt.client.getBlock();
                    return {
                      address: network.uniswapV4.permit2,
                      abi: permitAbi,
                      functionName: "approve",
                      summary: t(
                        `Allow the configured router to spend ${formatUnits(q.amount, inDecimals!)} ${inSymbol} for one hour.`,
                        `允许配置的路由在一小时内支出 ${formatUnits(q.amount, inDecimals!)} ${inSymbol}。`,
                      ),
                      args: [
                        inAddress,
                        network.uniswapV4.universalRouter,
                        q.amount,
                        Number(block.timestamp + 3600n),
                      ],
                    };
                  }}
                  after={() => getQuote()}
                />
              ) : (
                <TxButton
                  primary
                  label={t("3. Review swap", "3. 审核交换")}
                  disabled={
                    !allowances.data || allowances.data.balance < quote.amount
                  }
                  reason={t(
                    "Insufficient input token balance.",
                    "输入代币余额不足。",
                  )}
                  request={async () => {
                    const q = validQuote();
                    const encoded = encodeSwap(
                      key!,
                      inAddress,
                      q.amount,
                      q.min,
                      network.uniswapV4.extendedSwapParams,
                    );
                    const block = await rt.client.getBlock();
                    return {
                      address: network.uniswapV4.universalRouter,
                      abi: routerAbi,
                      functionName: "execute",
                      summary: t(
                        `Swap ${formatUnits(q.amount, inDecimals!)} ${inSymbol} for at least ${formatUnits(q.min, outDecimals!)} ${outSymbol}.`,
                        `以 ${formatUnits(q.amount, inDecimals!)} ${inSymbol} 换取至少 ${formatUnits(q.min, outDecimals!)} ${outSymbol}。`,
                      ),
                      args: [
                        encoded.commands,
                        encoded.inputs,
                        block.timestamp + 300n,
                      ],
                      value: same(inAddress, ZERO_ADDRESS) ? q.amount : 0n,
                      beforeSend: () => {
                        validQuote();
                      },
                    };
                  }}
                  after={() => setQuote(undefined)}
                />
              )}
            </>
          )}
          <p className="muted">
            {t(
              "Each approval is a separate transaction for the exact amount. The router allowance expires in one hour. No USD price source is configured.",
              "每次批准均为准确数量的独立交易，路由额度一小时后过期。未配置美元价格来源。",
            )}
          </p>
        </section>
        <aside className="summary">
          <h2>{t("Pool details", "资金池详情")}</h2>
          {key && (
            <>
              <dl>
                <dt>{t("Fee", "费用")}</dt>
                <dd>{key.fee / 10000}%</dd>
                <dt>{t("Tick spacing", "价格刻度间距")}</dt>
                <dd>{key.tickSpacing}</dd>
              </dl>
              <h3>{t("Pool hook", "资金池钩子")}</h3>
              <AddressView value={key.hooks} />
              <details>
                <summary>
                  {t("Inspect exact pool and routing", "查看准确资金池及路由")}
                </summary>
                <Data
                  value={{
                    poolKey: key,
                    poolId: poolId(key),
                    ...network.uniswapV4,
                  }}
                />
              </details>
            </>
          )}
          <p>
            {t(
              "The initialization guard is part of the attested pool key. Quotes and swaps preserve that exact key. Trades do not grant membership or voting weight.",
              "初始化守卫是已证明资金池键的一部分，报价和交换保持该键不变。交易不会授予成员或投票资格。",
            )}
          </p>
        </aside>
      </div>
    </>
  );
}
