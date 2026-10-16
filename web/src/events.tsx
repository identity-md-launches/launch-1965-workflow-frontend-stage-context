import { useEffect, useState } from "react";
import { decodeEventLog, type Hex } from "viem";
import { useRuntime, useLocale, Data, ErrorNote } from "./context";
import { json } from "./lib";
type Entry = {
  block: string;
  tx: Hex;
  index: number;
  event: string;
  args: Record<string, unknown>;
};
type Cache = {
  cursor: string;
  checkpoints: { block: string; hash: Hex }[];
  logs: Entry[];
};
export function EventHistory({
  name,
  approvedHash,
}: {
  name: string;
  approvedHash?: Hex;
}) {
  const rt = useRuntime(),
    { t } = useLocale(),
    key = `quorum.events.v1:${rt.manifest.chainId}:${rt.contract(name).address}:${rt.manifest.sourceCommit}`;
  const empty = (): Cache => ({
    cursor: String(rt.deploymentBlock),
    checkpoints: [],
    logs: [],
  });
  const [cache, setCache] = useState<Cache>(empty),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [note, setNote] = useState("");
  useEffect(() => {
    setError(undefined);
    setNote("");
    try {
      const raw = localStorage.getItem(key),
        v = raw ? JSON.parse(raw) : null;
      setCache(
        v &&
          /^\d+$/.test(v.cursor) &&
          BigInt(v.cursor) >= rt.deploymentBlock &&
          Array.isArray(v.logs) &&
          Array.isArray(v.checkpoints)
          ? v
          : empty(),
      );
    } catch {
      setCache(empty());
    }
  }, [key]);
  async function load() {
    setBusy(true);
    setError(undefined);
    try {
      let c: Cache = structuredClone(cache);
      const latest = await rt.client.getBlockNumber();
      const confirmed = latest > 12n ? latest - 12n : 0n;
      let reorg = false;
      while (c.checkpoints.length) {
        const cp = c.checkpoints.at(-1)!;
        const block = await rt.client.getBlock({
          blockNumber: BigInt(cp.block),
        });
        if (block.hash === cp.hash) break;
        reorg = true;
        c.checkpoints.pop();
      }
      if (reorg) {
        const checkpoint = c.checkpoints.at(-1);
        c.cursor = checkpoint
          ? String(BigInt(checkpoint.block) + 1n)
          : String(rt.deploymentBlock);
        c.logs = c.logs.filter((l) => BigInt(l.block) < BigInt(c.cursor));
        setNote(
          t(
            "Reorg detected. Rolled back cached events to a valid checkpoint.",
            "检测到重组，缓存事件已回滚至有效检查点。",
          ),
        );
      }
      let batches = 0;
      while (BigInt(c.cursor) <= confirmed && batches < 4) {
        const from = BigInt(c.cursor),
          to = from + 999n > confirmed ? confirmed : from + 999n;
        const logs = await rt.client.getLogs({
          address: rt.contract(name).address,
          fromBlock: from,
          toBlock: to,
        });
        const block = await rt.client.getBlock({ blockNumber: to });
        for (const log of logs) {
          try {
            const d = decodeEventLog({
              abi: rt.abis[name],
              data: log.data,
              topics: log.topics,
            }) as any;
            c.logs.push({
              block: String(log.blockNumber),
              tx: log.transactionHash,
              index: log.logIndex,
              event: d.eventName,
              args: JSON.parse(json(d.args)),
            });
          } catch {
            /* ABI-unknown events are not presented as decoded state */
          }
        }
        c.cursor = String(to + 1n);
        c.checkpoints.push({ block: String(to), hash: block.hash });
        c.checkpoints = c.checkpoints.slice(-16);
        c.logs = c.logs.slice(-256);
        batches++;
      }
      setCache(c);
      try {
        localStorage.setItem(key, json(c));
      } catch {
        setNote(
          t(
            "Browser storage unavailable; events are retained only in memory.",
            "浏览器存储不可用，事件仅保留在内存。",
          ),
        );
      }
      if (!reorg)
        setNote(
          BigInt(c.cursor) > confirmed
            ? t(
                "Caught up to the 12-confirmation boundary.",
                "已同步至 12 确认边界。",
              )
            : t(
                "More history remains. Continue with the next bounded batch.",
                "仍有更多历史，请继续读取下一批。",
              ),
        );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section">
      <div className="section-head">
        <h2>{t("Confirmed event history", "已确认事件历史")}</h2>
        <button disabled={busy} onClick={load}>
          {busy
            ? t("Reading…", "正在读取…")
            : t("Load next batch", "读取下一批")}
        </button>
      </div>
      <p className="muted">
        {name} · {t("Next block", "下一块")} {cache.cursor} ·{" "}
        {t(
          "Up to 4 × 1,000 blocks per request; latest 256 events cached locally.",
          "每次最多读取 4 × 1,000 块，本地缓存最近 256 个事件。",
        )}
      </p>
      <p role="status">{note}</p>
      <ErrorNote error={error} />
      {cache.logs.length === 0 && (
        <p className="empty">
          {t(
            "No events loaded. This is not a claim that the chain has no events.",
            "尚未加载事件，这不代表链上没有事件。",
          )}
        </p>
      )}
      {[...cache.logs].reverse().map((log) => (
        <article className="feed-row" key={log.tx + log.index}>
          <div className="row">
            <strong>{log.event}</strong>
            <span>#{log.block}</span>
            <a
              href={`${rt.manifest.network.explorer}/tx/${log.tx}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("Transaction receipt", "交易收据")} ↗
            </a>
          </div>
          {log.event === "PublicationObserved" && (
            <p className="notice">
              {approvedHash && log.args.publishedHash === approvedHash
                ? t(
                    "Observer-reported hash matches this approval. Hosting and artifact bytes have not been verified.",
                    "观察者报告的哈希与本批准一致，尚未验证托管和制品字节。",
                  )
                : t(
                    "Untrusted publication observation. Compare its exact bytes to the approved artifact.",
                    "未经验证的发布观察，请对比其准确字节与获批制品。",
                  )}
            </p>
          )}
          <Data value={log.args} />
        </article>
      ))}
      <button
        className="small"
        onClick={() => {
          localStorage.removeItem(key);
          setCache(empty());
          setNote(
            t(
              "Local cache cleared. Chain state is unchanged.",
              "本地缓存已清除，链上状态不变。",
            ),
          );
        }}
      >
        {t("Reset local history cache", "重置本地历史缓存")}
      </button>
    </section>
  );
}
