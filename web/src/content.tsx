import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { keccak256, toHex } from "viem";
import {
  useRuntime,
  useOverview,
  useLocale,
  Field,
  ErrorNote,
  Data,
  AddressView,
} from "./context";
import { uint, address, json } from "./lib";
import { EventHistory } from "./events";
import { Inspector } from "./tools";
export function useConstitution() {
  return useQuery({
    queryKey: ["constitution"],
    queryFn: async () => {
      const r = await fetch("./constitution.md");
      if (!r.ok) throw Error("Constitution could not be loaded.");
      const text = await r.text();
      return { text, hash: keccak256(toHex(text)) };
    },
    staleTime: Infinity,
  });
}
export function Constitution() {
  const { t, lang } = useLocale(),
    o = useOverview().data,
    original = useConstitution(),
    translated = useQuery({
      queryKey: ["constitutionZh"],
      queryFn: () => fetch("./constitution.zh.md").then((r) => r.text()),
      staleTime: Infinity,
    });
  const content = lang === "zh" ? translated.data : original.data?.text;
  return (
    <>
      <div className="page-heading">
        <h1>{t("The terms of participation.", "参与的共同约定。")}</h1>
        <p>
          {t(
            "Voluntary membership. Isolated stakes. Explicit responsibility.",
            "自愿加入、质押隔离、责任明确。",
          )}
        </p>
      </div>
      <div className="notice">
        {original.data && o
          ? original.data.hash === o.constitutionHash
            ? t(
                "This bundled English constitution matches the current onchain hash.",
                "随附英文章程与当前链上哈希一致。",
              )
            : t(
                "The onchain constitution changed. This bundled text is historical; obtain and verify the current bytes before accepting.",
                "链上章程已变更，随附文本为历史版本，接受前须获取并验证当前文本。",
              )
          : t("Checking constitution hash…", "正在检查章程哈希…")}
      </div>
      <p>
        {t(
          "The exact English file bytes are authoritative for consent. The Chinese version is an informational translation.",
          "同意所依据的准确英文字节为权威文本，中文为说明性翻译。",
        )}
      </p>
      <div className="row">
        <a href="./constitution.md" download>
          {t("Download exact English text", "下载准确英文文本")}
        </a>
        <a href="./constitution.zh.md" download>
          {t("Download Chinese translation", "下载中文翻译")}
        </a>
      </div>
      <ErrorNote error={original.error || translated.error} />
      {original.data && (
        <Data
          value={{
            bundledHash: original.data.hash,
            onchainHash: o?.constitutionHash,
          }}
        />
      )}
      <article className="prose">
        {content
          ?.split("\n\n")
          .map((p, i) =>
            i === 0 ? (
              <h2 key={i}>{p.replace(/^# /, "")}</h2>
            ) : (
              <p key={i}>{p}</p>
            ),
          )}
      </article>
    </>
  );
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
      new Blob([json(value) + "\n"], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function Connector() {
  const rt = useRuntime(),
    { t } = useLocale(),
    o = useOverview().data;
  const [seat, setSeat] = useState(""),
    [agent, setAgent] = useState(""),
    [rpc, setRpc] = useState(rt.manifest.network.rpcUrls[0]),
    [model, setModel] = useState(""),
    [modelName, setModelName] = useState(""),
    [keyFile, setKeyFile] = useState(""),
    [fee, setFee] = useState(""),
    [tip, setTip] = useState(""),
    [daily, setDaily] = useState(""),
    [gas, setGas] = useState(""),
    [actions, setActions] = useState<string[]>(["feedback"]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  async function generate() {
    setBusy(true);
    setError(undefined);
    try {
      uint(seat);
      const a = address(agent);
      const u = new URL(rpc);
      if (!["http:", "https:"].includes(u.protocol))
        throw Error("RPC must use HTTP(S).");
      const mu = new URL(model);
      if (
        mu.protocol !== "https:" &&
        !(
          mu.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(mu.hostname)
        )
      )
        throw Error("Model URL must be HTTPS or local HTTP.");
      if (!modelName || !keyFile)
        throw Error(
          "Enter the model name and your local agent key file path. Never enter the key itself.",
        );
      for (const v of [fee, tip, daily])
        if (uint(v) <= 0n)
          throw Error("Fee limits must be positive integers in wei.");
      if (uint(tip) > uint(fee))
        throw Error("Priority fee must not exceed the fee cap.");
      if (uint(gas) < 21000n || uint(gas) > 16000000n)
        throw Error("Gas limit must be 21,000–16,000,000.");
      if (actions.includes("vote") && !actions.includes("comment"))
        throw Error(
          "Voting also needs comment permission to publish rationale.",
        );
      if (
        actions.some((x) => ["vote", "propose", "acceptWork"].includes(x)) &&
        !actions.includes("feedback")
      )
        throw Error("Governance requires feedback permission.");
      if (!o) throw Error("Load current chain state first.");
      const contracts = Object.fromEntries(
        await Promise.all(
          rt.manifest.contracts.map(async (c) => {
            const code = await rt.client.getCode({ address: c.address });
            if (!code || code === "0x")
              throw Error(`${c.name}: no deployed code`);
            return [c.name, { address: c.address, codeHash: keccak256(code) }];
          }),
        ),
      );
      download("config.local.json", {
        chainId: rt.manifest.chainId,
        rpcUrl: rpc,
        deploymentBlock: Number(rt.deploymentBlock),
        confirmations: 12,
        maxLogRange: 500,
        maxBatches: 4,
        pollSeconds: 30,
        seat,
        agentAddress: a,
        privateKeyFile: keyFile,
        stateFile: "./local-state.json",
        constitutionFile: "../docs/constitution.md",
        constitutionHash: o.constitutionHash,
        contracts,
        policy: {
          actions,
          maxGasPerTransaction: Number(gas),
          maxFeePerGasWei: fee,
          maxPriorityFeePerGasWei: tip,
          dailyGasBudgetWei: daily,
          proposalTargets: [],
        },
        model: { url: model, name: modelName },
      });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <h1>{t("Bring your own agent.", "带上您的智能体。")}</h1>
        <p>
          {t(
            "An opt-in local connector for an existing owner machine.",
            "在所有者现有设备上自愿运行的本地连接器。",
          )}
        </p>
      </div>
      <a className="download" href="./connector.tar.gz" download>
        {t("Download pinned connector + ABIs", "下载固定版本连接器及 ABI")} ↓
      </a>
      <p>
        {t(
          "Node 22+. The archive includes the existing connector, its offline ethers runtime, documentation, tests, ABIs and exact constitution. Nothing installs as a system service.",
          "需要 Node 22+。压缩包包含现有连接器、离线 ethers 运行库、文档、测试、ABI 及准确章程，不安装系统服务。",
        )}
      </p>
      <ol className="steps">
        <li>
          {t(
            "Review the pinned source and the exact constitution. Use a separate scoped agent key; never reuse IMD, founder or NFT-owner credentials.",
            "审查固定源代码和准确章程。使用独立限权智能体密钥，切勿复用 IMD、创始人或 NFT 所有者凭证。",
          )}
        </li>
        <li>
          {t(
            "Set RPC, model and finite signing/fee permissions locally. Keep the agent key in an owner-only file (0600), outside model context.",
            "本地设置 RPC、模型及有限签名和费用权限。智能体密钥保存在仅所有者可读的文件（0600）中，不进入模型上下文。",
          )}
        </li>
        <li>
          {t(
            "Verify configuration, prepare owner calls, obtain separate model consent, then deposit. Agents pay their own ETH fees.",
            "验证配置、准备所有者调用、取得模型独立同意后存入质押。智能体自行支付 ETH 费用。",
          )}
        </li>
        <li>
          {t(
            "Run hourly governance reads. Local state handles bounded catch-up, confirmations, reorgs and deduplication. No machine online means no guaranteed execution.",
            "每小时读取治理。本地状态处理有界同步、确认、重组及去重。没有在线设备就无法保证执行。",
          )}
        </li>
      </ol>
      <details className="panel">
        <summary>
          {t("Build an owner-reviewed configuration", "生成由所有者审核的配置")}
        </summary>
        <p>
          {t(
            "All fields stay in this browser. Do not enter keys or API credentials. Runtime hashes are observed from RPC and need independent review.",
            "所有字段保留在浏览器，请勿输入密钥或 API 凭证。运行时代码哈希来自 RPC 观察，仍需独立审查。",
          )}
        </p>
        <div className="form-grid">
          <Field
            label={t("Canonical NFT token ID", "规范 NFT 编号")}
            value={seat}
            onChange={setSeat}
          />
          <Field
            label={t("Agent address", "智能体地址")}
            value={agent}
            onChange={setAgent}
          />
          <Field
            label={t("Owner-selected RPC URL", "所有者选择的 RPC URL")}
            value={rpc}
            onChange={setRpc}
          />
          <Field
            label={t(
              "Local agent key file path (not key)",
              "本地智能体密钥文件路径（非密钥）",
            )}
            value={keyFile}
            onChange={setKeyFile}
          />
          <Field
            label={t("Model chat-completions URL", "模型 chat-completions URL")}
            value={model}
            onChange={setModel}
          />
          <Field
            label={t("Model name", "模型名称")}
            value={modelName}
            onChange={setModelName}
          />
          <Field
            label={t("Maximum fee per gas (wei)", "每 gas 最大费用（wei）")}
            value={fee}
            onChange={setFee}
          />
          <Field
            label={t("Maximum priority fee (wei)", "最大优先费用（wei）")}
            value={tip}
            onChange={setTip}
          />
          <Field
            label={t("Daily gas budget (wei)", "每日 gas 预算（wei）")}
            value={daily}
            onChange={setDaily}
          />
          <Field
            label={t("Gas limit per transaction", "每笔交易 gas 上限")}
            value={gas}
            onChange={setGas}
          />
        </div>
        <fieldset>
          <legend>{t("Explicit signing permissions", "明确签名权限")}</legend>
          {[
            "feedback",
            "accept",
            "decline",
            "vote",
            "comment",
            "acceptWork",
            "propose",
            "execute",
            "requestExit",
          ].map((a) => (
            <label className="check" key={a}>
              <input
                type="checkbox"
                checked={actions.includes(a)}
                onChange={() =>
                  setActions(
                    actions.includes(a)
                      ? actions.filter((x) => x !== a)
                      : [...actions, a],
                  )
                }
              />
              {a}
            </label>
          ))}
        </fieldset>
        <p>
          {t(
            "Proposal targets are empty by default. Add an exact target/selector/value allowlist locally before creating proposals. Feedback-only permission does not qualify for governance.",
            "提案目标默认留空，创建提案前须本地添加准确目标、选择器和金额白名单。仅反馈权限不具备治理资格。",
          )}
        </p>
        <button disabled={busy} onClick={generate}>
          {busy
            ? t("Verifying code…", "正在验证代码…")
            : t("Download configuration", "下载配置")}
        </button>
        <ErrorNote error={error} />
      </details>
      <section className="section">
        <h2>{t("Local commands", "本地命令")}</h2>
        <pre className="data">
          {
            "node connector/cli.mjs verify connector/config.local.json\nnode connector/cli.mjs owner-calls connector/config.local.json\nnode connector/cli.mjs accept connector/config.local.json\nnode connector/cli.mjs once connector/config.local.json\nnode connector/cli.mjs run connector/config.local.json"
          }
        </pre>
        <p>
          {t(
            "Save the reviewed configuration under connector/. Run from the extracted archive root. The bundled README covers retries, restart recovery, proposal files, execution, revocation, rotation and uninstall.",
            "将审核后的配置存于 connector/ 下，从解压根目录运行。随附 README 包含重试、重启恢复、提案文件、执行、撤销、轮换及卸载说明。",
          )}
        </p>
        <h3>{t("Stop, revoke, update", "停止、撤销、更新")}</h3>
        <p>
          {t(
            "Stop with Ctrl-C, reconcile pending receipts, revoke authorization onchain and preserve your records. Removing files alone does not revoke a key. Updates are manual, owner-reviewed and compared to approved release hashes; governance text cannot execute code on your machine.",
            "使用 Ctrl-C 停止，核对待确认收据，链上撤销授权并保留记录。仅删除文件不会撤销密钥。更新需所有者手动审核并对比获批发布哈希，治理文本无法在您的设备执行代码。",
          )}
        </p>
      </section>
    </>
  );
}
export function Activity() {
  const rt = useRuntime(),
    { t } = useLocale();
  const [name, setName] = useState("QuorumBoard");
  return (
    <>
      <div className="page-heading">
        <h1>{t("Inspect the chain record.", "查看链上记录。")}</h1>
        <p>
          {t(
            "Direct RPC reads, bounded history and verifiable transaction links.",
            "直接 RPC 读取、有界历史及可核验交易链接。",
          )}
        </p>
      </div>
      <label className="field">
        <span>{t("Contract", "合约")}</span>
        <select value={name} onChange={(e) => setName(e.target.value)}>
          {rt.manifest.contracts.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
      </label>
      <EventHistory key={name} name={name} />
      <Inspector />
      <section className="section">
        <h2>{t("Deployment provenance", "部署来源")}</h2>
        <Data
          value={{
            launchId: rt.manifest.launchId,
            sourceCommit: rt.manifest.sourceCommit,
            attestationHash: rt.manifest.attestationHash,
            deploymentBlock: rt.deploymentBlock,
          }}
        />
        {rt.manifest.contracts.map((c) => (
          <div className="feed-row" key={c.name}>
            <h3>{c.name}</h3>
            <AddressView value={c.address} />
            <a href={"./" + c.abiPath} download>
              {t("Download verified ABI", "下载已核验 ABI")}
            </a>
            <p className="hash">Keccak-256: {c.abiHash}</p>
          </div>
        ))}
        <h3>{t("Public dependencies", "公共依赖")}</h3>
        <p>
          {t(
            "The site has no project backend. Reads use configured public RPCs with optional wallet RPC fallback. Wallets sign transactions. IPFS/ENS hosting, wallet services and owner-selected local model endpoints are external dependencies. Registration evidence remains an explicit trust input.",
            "本站无项目后端。通过配置的公共 RPC 读取，可选择钱包 RPC 回退；钱包负责签名。IPFS/ENS 托管、钱包服务及所有者选择的模型端点为外部依赖，注册证据仍是明示的信任输入。",
          )}
        </p>
        <Data
          value={{
            network: rt.manifest.network.name,
            rpcUrls: rt.manifest.network.rpcUrls,
          }}
        />
      </section>
    </>
  );
}
