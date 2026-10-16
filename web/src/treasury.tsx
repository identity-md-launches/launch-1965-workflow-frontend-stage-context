import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatEther, formatUnits, erc20Abi, keccak256 } from "viem";
import {
  useRuntime,
  useRead,
  useOverview,
  useLocale,
  AddressView,
  Data,
  ErrorNote,
  Field,
} from "./context";
import { ContractForm, Inspector } from "./tools";
import { ZERO_HASH, ZERO_ADDRESS } from "./config";
import { uint, hash } from "./lib";
import { EventHistory } from "./events";
export function Treasury() {
  const rt = useRuntime(),
    read = useRead(),
    o = useOverview().data,
    { t } = useLocale();
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["treasury", o?.owner, page, o?.budgetCount?.toString()],
    enabled: !!o,
    queryFn: async () => {
      const [eth, qrm, imd] = await Promise.all([
        rt.client.getBalance({ address: o!.owner }),
        read("LaunchToken", "balanceOf", [o!.owner]),
        rt.client.readContract({
          address: rt.manifest.network.pairToken.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [o!.owner],
        }),
      ]);
      const budgets = await Promise.all(
        Array.from(
          {
            length: Math.max(
              0,
              Math.min(10, Number(o!.budgetCount) - page * 10),
            ),
          },
          async (_, i) => {
            const id = BigInt(page * 10 + i + 1),
              b = await read("QuorumGovernance", "budgets", [id]);
            let symbol = "ETH",
              decimals = 18;
            if (b[0] !== ZERO_ADDRESS) {
              [symbol, decimals] = await Promise.all([
                rt.client.readContract({
                  address: b[0],
                  abi: erc20Abi,
                  functionName: "symbol",
                }),
                rt.client.readContract({
                  address: b[0],
                  abi: erc20Abi,
                  functionName: "decimals",
                }),
              ]);
            }
            return {
              id,
              asset: b[0],
              recipient: b[1],
              cap: b[2],
              spent: b[3],
              expires: b[4],
              purpose: b[5],
              symbol,
              decimals,
            };
          },
        ),
      );
      return { eth, qrm, imd, budgets };
    },
    refetchInterval: 30000,
  });
  return (
    <>
      <div className="page-heading">
        <h1>{t("Fund shared work.", "资助共同工作。")}</h1>
        <p>
          {t(
            "The existing Safe is the treasury and payer. Refundable stakes remain separate.",
            "现有 Safe 是国库及付款方，可退还质押独立保管。",
          )}
        </p>
      </div>
      {o && <AddressView value={o.owner} />}
      <ErrorNote error={q.error} />
      <div className="three-columns balances">
        <div>
          <h2>{t("Treasury ETH", "国库 ETH")}</h2>
          <strong>{q.data ? formatEther(q.data.eth) : "…"} ETH</strong>
        </div>
        <div>
          <h2>{t("Treasury tokens", "国库代币")}</h2>
          <strong>
            {q.data ? formatUnits(q.data.qrm, Number(o?.decimals ?? 18)) : "…"}{" "}
            QRM
          </strong>
          <p>
            {q.data
              ? formatUnits(q.data.imd, rt.manifest.network.pairToken.decimals)
              : "…"}{" "}
            {rt.manifest.network.pairToken.symbol}
          </p>
        </div>
        <div>
          <h2>{t("Refundable deposits", "可退还质押")}</h2>
          <strong>
            {o ? formatUnits(o.totalDeposited, Number(o.decimals)) : "…"} QRM
          </strong>
          <p>{t("Excluded from spendable treasury.", "不计入可支出国库。")}</p>
        </div>
      </div>
      <p className="muted">
        {t(
          "USD values are unavailable. Low treasury pauses paid work. Fees, donations and approved revenue fund development; no returns or founder top-ups are promised.",
          "暂无美元估值。国库不足则暂停付费工作。费用、捐款和获批收入用于开发，不承诺收益或创始人补资。",
        )}
      </p>
      <section className="section">
        <h2>{t("Approved budgets", "已批准预算")}</h2>
        {q.data?.budgets.length === 0 && (
          <p className="empty">
            {t(
              "No approved budgets. Spending caps require a major proposal.",
              "暂无已批准预算，支出上限需重大提案。",
            )}
          </p>
        )}
        {q.data?.budgets.map((b) => (
          <article className="feed-row" key={String(b.id)}>
            <h3>
              {t("Budget", "预算")} #{String(b.id)}
            </h3>
            <p>
              {formatUnits(b.spent, b.decimals)} /{" "}
              {formatUnits(b.cap, b.decimals)} {b.symbol} ·{" "}
              {t("spent / cap", "已支出 / 上限")}
            </p>
            <AddressView value={b.recipient} />
            <p>
              {t("Expires", "到期")}:{" "}
              {new Date(Number(b.expires) * 1000).toLocaleString()}
            </p>
            <Data value={{ asset: b.asset, purpose: b.purpose }} />
          </article>
        ))}
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            {t("Previous", "上一页")}
          </button>
          <button
            disabled={!o || (page + 1) * 10 >= Number(o.budgetCount)}
            onClick={() => setPage(page + 1)}
          >
            {t("Next", "下一页")}
          </button>
        </div>
        <ContractForm
          names={["QuorumGovernance"]}
          functions={["approveBudget"]}
          title={t("Prepare a major budget approval", "准备重大预算批准")}
        />
        <ContractForm
          names={["LaunchToken"]}
          functions={["transfer", "approve", "transferFrom"]}
          title={t(
            "Manage QRM transfers and allowances",
            "管理 QRM 转账与额度",
          )}
        />
      </section>
    </>
  );
}
export function Bootstrap() {
  const rt = useRuntime(),
    read = useRead(),
    o = useOverview().data,
    { t } = useLocale();
  const [inviteCopied, setInviteCopied] = useState(false);
  const [check, setCheck] = useState<unknown>(),
    [error, setError] = useState<unknown>();
  return (
    <>
      <div className="page-heading">
        <h1>{t("Recruit, then hand over.", "先招募，再交接。")}</h1>
        <p>
          {t(
            "Deployment and IMD completion do not transfer authority.",
            "部署及 IMD 完成不代表控制权转移。",
          )}
        </p>
      </div>
      <div className="notice">
        <strong>
          {o?.handedOver
            ? t("Governance authority", "治理控制权")
            : t("Bootstrap privileges", "引导阶段权限")}
        </strong>
        <p>
          {t(
            "Before handover the founder controls the Safe 1/1, treasury spending and configuration. Stakes cannot be confiscated. Ordinary and major treasury execution is blocked until handover.",
            "交接前创始人以 1/1 控制 Safe、国库支出及配置，无法没收质押。交接前普通和重大提案无法执行国库操作。",
          )}
        </p>
      </div>
      {o && (
        <dl>
          <dt>{t("Safe owner / treasury", "Safe 所有者 / 国库")}</dt>
          <dd>
            <AddressView value={o.owner} />
          </dd>
          <dt>{t("Founder", "创始人")}</dt>
          <dd>
            <AddressView value={o.founder} />
          </dd>
          <dt>{t("Fixed connected seats N", "固定连接席位 N")}</dt>
          <dd>{String(o.connectedAtAdmission)}</dd>
          <dt>{t("Admission source", "准入来源")}</dt>
          <dd>{o.admissionSource || t("Not configured", "未配置")}</dd>
          <dt>{t("Admission dataset hash", "准入数据集哈希")}</dt>
          <dd className="hash">{o.admissionHash}</dd>
          <dt>{t("Canonical NFT", "规范 NFT")}</dt>
          <dd>
            {o.nft === ZERO_ADDRESS ? (
              t("Not configured", "未配置")
            ) : (
              <AddressView value={o.nft} />
            )}
          </dd>
        </dl>
      )}
      <ol className="steps">
        <li>
          {t(
            "Verify the canonical NFT, fixed admission count, source and dataset hash. The Safe configures admission once.",
            "核验规范 NFT、固定准入数量、来源及数据集哈希，由 Safe 一次性配置。",
          )}
        </li>
        <li>
          {t(
            "Complete independent review and the founder-run real-model rehearsal. Audit historical Safe approvals and external spending rights.",
            "完成独立审查及创始人真实模型演练，审核 Safe 历史批准和外部支出权。",
          )}
        </li>
        <li>
          {t(
            "Clear the fallback handler and other modules or guards; enable only this governor module. Verify exact Safe 1.5.0 policy.",
            "清除回退处理器及其他模块或守卫，仅启用本治理模块，验证准确 Safe 1.5.0 策略。",
          )}
        </li>
        <li>
          {t(
            "The founder accepts the exact code/configuration/constitution commitment. Recruit at least 10 active seats across 5 owner addresses.",
            "创始人接受准确代码、配置和章程承诺，招募至少 10 个活跃席位及 5 个所有者地址。",
          )}
        </li>
        <li>
          {t(
            "At least two-thirds of the entire frozen genesis electorate approve. After the 72h vote and 48h delay, anyone may execute the handover.",
            "冻结创世选民总数至少三分之二赞成。72 小时投票和 48 小时延迟后，任何人可执行交接。",
          )}
        </li>
      </ol>
      <button
        onClick={async () => {
          setError(undefined);
          setCheck(undefined);
          try {
            const bundle = await read("QuorumGovernance", "handoverCommitment");
            await read(
              "QuorumSafePolicy",
              o?.handedOver ? "assertBound" : "assertBootstrap",
              o?.handedOver
                ? [rt.contract("QuorumGovernance").address]
                : [rt.contract("QuorumGovernance").address, false],
            );
            setCheck({
              policy:
                "Onchain configuration check passed; historical permissions and independent acceptance remain separate.",
              bundle,
            });
          } catch (e) {
            setError(e);
          }
        }}
      >
        {t("Check Safe policy and commitment", "检查 Safe 策略与承诺")}
      </button>
      <ErrorNote error={error} />
      {check !== undefined && <Data value={check} />}
      <ContractForm
        names={["QuorumSeats", "QuorumGovernance"]}
        functions={["configureAdmission", "setConstitution", "founderAccept"]}
        title={t(
          "Owner setup and founder acceptance",
          "所有者设置及创始人接受",
        )}
      />
      <p>
        {t(
          "The NFT, N and registration evidence are Safe-attested inputs, not a decentralized proof of offchain connectivity. No claim contract or allocation proof is included in this handoff; this site cannot claim the swarm allocation.",
          "NFT、N 及注册证据为 Safe 背书的输入，并非链下连接的去中心化证明。本交接未提供领取合约或分配证明，本站无法领取群体分配。",
        )}
      </p>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              location.href.split("#")[0] + "#membership",
            );
            setInviteCopied(true);
          } catch (e) {
            setError(e);
          }
        }}
      >
        {inviteCopied
          ? t("Invitation link copied", "邀请链接已复制")
          : t("Copy invitation link", "复制邀请链接")}
      </button>
      <p className="muted">
        {t(
          "An invitation does not enroll anyone. Owners and agents must opt in separately.",
          "邀请不会自动使任何人加入，所有者与智能体须分别自愿选择。",
        )}
      </p>
      <a className="text-link" href="#membership">
        {t("Invite someone to join", "邀请成员加入")} ↗
      </a>
    </>
  );
}
export function Releases() {
  const rt = useRuntime(),
    read = useRead(),
    o = useOverview().data,
    { t } = useLocale();
  const [id, setId] = useState(""),
    selected = id || o?.currentRelease;
  const q = useQuery({
    queryKey: ["release", selected],
    enabled: !!selected && selected !== ZERO_HASH,
    queryFn: async () => {
      const r = await read("QuorumReleases", "getRelease", [hash(selected!)]);
      if (!r.approvedAt)
        throw Error("No approved release exists for this hash.");
      return r;
    },
  });
  return (
    <>
      <div className="page-heading">
        <h1>{t("Approve the exact artifact.", "批准准确制品。")}</h1>
        <p>
          {t(
            "Approval, publication and availability are distinct facts.",
            "批准、发布和可用性是不同事实。",
          )}
        </p>
      </div>
      <section className="panel">
        <h2>{t("Approved release", "已批准发布")}</h2>
        <Field
          label={t(
            "Release ID (blank = current)",
            "发布编号（空白使用当前发布）",
          )}
          value={id}
          onChange={setId}
        />
        <ErrorNote error={q.error} />
        {selected === ZERO_HASH ? (
          <p className="empty">
            {t(
              "No approved release is recorded yet. This export is not founder acceptance or a governance-approved release.",
              "尚无已批准发布记录。本导出不代表创始人接受或治理批准发布。",
            )}
          </p>
        ) : q.data ? (
          <>
            <Data value={{ releaseId: selected, ...q.data }} />
            <ArtifactComparison
              key={`${selected}:${q.data.siteHash}`}
              siteHash={q.data.siteHash}
            />
            <p>
              {t(
                "Compare the exact artifact defined by the release manifest. A CID string, directory name or publication observation is not the artifact bytes. Files stay in this browser.",
                "对比发布清单定义的准确制品。CID 字符串、目录名或发布观察不是制品字节。文件仅在浏览器处理。",
              )}
            </p>
          </>
        ) : (
          <p>{t("Reading approval…", "正在读取批准…")}</p>
        )}
      </section>
      <ContractForm
        names={["QuorumReleases"]}
        functions={["approveRelease", "observePublication"]}
        title={t(
          "Prepare approval or report publication",
          "准备批准或报告发布",
        )}
      />
      <EventHistory name="QuorumReleases" approvedHash={q.data?.siteHash} />
      <section className="section">
        <h2>{t("Hosting and control", "托管与控制")}</h2>
        <p>
          {t(
            "Initial IPFS/ENS naming is controlled by IMD; compatible eth.limo gateways are external dependencies. Independent mirrors are possible. Pinning is not a permanence guarantee. An assembly-owned ENS name can be proposed later.",
            "初始 IPFS/ENS 命名由 IMD 控制，兼容的 eth.limo 网关为外部依赖。可建立独立镜像。固定不保证永久存储，议会自有 ENS 名称可日后提议。",
          )}
        </p>
        <a href="./imd-deployment.json" download>
          {t("Download deployment and asset manifest", "下载部署及资产清单")}
        </a>
      </section>
      <Inspector />
    </>
  );
}

function ArtifactComparison({ siteHash }: { siteHash: string }) {
  const { t } = useLocale();
  const [artifactHash, setArtifactHash] = useState(""),
    [error, setError] = useState<unknown>();
  const request = useRef(0);
  // Releases keys this component by release ID and siteHash: a new approval
  // clears both the native file input and its verdict. Invalidate pending reads
  // on unmount, and let only the most recently selected file finish.
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  return (
    <>
      <label className="field">
        <span>
          {t(
            "Compare a downloaded site artifact (Keccak-256)",
            "对比下载的网站制品（Keccak-256）",
          )}
        </span>
        <input
          type="file"
          onChange={async (e) => {
            const current = ++request.current;
            setError(undefined);
            setArtifactHash("");
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              if (f.size > 32 * 1024 * 1024)
                throw Error("Select an artifact no larger than 32 MiB.");
              const bytes = await f.arrayBuffer();
              if (request.current !== current) return;
              setArtifactHash(keccak256(new Uint8Array(bytes)));
            } catch (e) {
              if (request.current === current) setError(e);
            }
          }}
        />
      </label>
      <p className="hash" role="status">
        {artifactHash &&
          `${artifactHash} · ${
            artifactHash === siteHash
              ? t("Matches approved site hash", "匹配获批网站哈希")
              : t("Does not match approved site hash", "不匹配获批网站哈希")
          }`}
      </p>
      <ErrorNote error={error} />
    </>
  );
}
