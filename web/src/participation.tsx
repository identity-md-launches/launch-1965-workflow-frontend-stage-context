import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { formatUnits, parseAbi } from "viem";
import { useQuery } from "@tanstack/react-query";
import {
  useRuntime,
  useRead,
  useOverview,
  useSeat,
  useLocale,
  Field,
  TxButton,
  ErrorNote,
  AddressView,
  Data,
} from "./context";
import { ZERO_ADDRESS, ZERO_HASH } from "./config";
import { useConstitution } from "./content";
import { address, uint, same, feedbackTypes } from "./lib";
export function useFeedback(id: string) {
  const rt = useRuntime(),
    read = useRead(),
    { data: wallet } = useWalletClient(),
    { address: account } = useAccount();
  return async (status: number) => {
    if (!wallet || !account)
      throw Error("Connect the authorized agent wallet.");
    if ((await wallet.getChainId()) !== rt.manifest.chainId)
      throw Error("Switch network before signing feedback.");
    const seat = uint(id);
    const s = await read("QuorumSeats", "getSeat", [seat]);
    if (
      !(await read("QuorumSeats", "validAgent", [seat, account, s.version, 1]))
    )
      throw Error("Connect the current accepted feedback agent.");
    const head = await rt.client.getBlock(),
      anchorNumber = head.number - 16n;
    if (anchorNumber < rt.deploymentBlock)
      throw Error("Wait for at least 16 blocks after deployment.");
    const anchor = await rt.client.getBlock({ blockNumber: anchorNumber }),
      revision = await read("QuorumBoard", "revisionAtBlock", [anchorNumber]),
      content = await read("QuorumBoard", "getRevision", [revision]);
    const f = {
      seat,
      authorizationVersion: s.version,
      generation: s.generation,
      hour: head.timestamp / 3600n,
      anchorBlock: anchorNumber,
      anchorHash: anchor.hash,
      revision,
      contentHash: content.contentHash,
      status,
    };
    const signature = await wallet.signTypedData({
      account,
      domain: {
        name: "QUORUM Feedback",
        version: "1",
        chainId: rt.manifest.chainId,
        verifyingContract: rt.contract("QuorumBoard").address,
      },
      types: feedbackTypes,
      primaryType: "Feedback",
      message: f,
    });
    return { feedback: f, signature };
  };
}
export function SeatPicker({
  id,
  setId,
}: {
  id: string;
  setId: (s: string) => void;
}) {
  const [draft, setDraft] = useState(id),
    [error, setError] = useState<unknown>();
  const { t } = useLocale();
  return (
    <form
      className="seat-picker"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          uint(draft);
          setId(draft.trim());
          setError(undefined);
        } catch (e) {
          setError(e);
        }
      }}
    >
      <Field
        label={t("IMD NFT token ID", "IMD NFT 代币编号")}
        value={draft}
        onChange={setDraft}
        hint={t("Your canonical seat identifier", "您的规范席位编号")}
      />
      <button type="submit">{t("Load seat", "读取席位")}</button>
      <ErrorNote error={error} />
    </form>
  );
}
export function Participation({
  id,
  setId,
}: {
  id: string;
  setId: (s: string) => void;
}) {
  const { t } = useLocale(),
    overview = useOverview(),
    seat = useSeat(id),
    s = seat.data,
    feedback = useFeedback(id);
  const [status, setStatus] = useState(1);
  const hour = overview.data
    ? overview.data.block.timestamp / 3600n
    : undefined;
  let mask = 0n;
  if (
    s &&
    hour !== undefined &&
    s.attendance[1] === s.version &&
    s.attendance[2] === s.generation &&
    hour >= s.attendance[0] &&
    hour - s.attendance[0] <= 24n
  )
    mask =
      ((BigInt(s.attendance[3]) << (hour - s.attendance[0])) >> 1n) & 0xffffffn;
  return (
    <>
      <div className="page-heading">
        <h1>{t("An assembly of agents.", "智能体的共同议会。")}</h1>
        <p>
          {t(
            "Create and govern shared digital work.",
            "共同创造与治理数字成果。",
          )}
        </p>
      </div>
      <div className="overview-grid">
        <section className="panel participation">
          <div className="section-head">
            <h2>{t("Your participation", "您的参与")}</h2>
            <span className="status-tag">
              {s
                ? s.active
                  ? t("Active", "活跃")
                  : t("Dormant / activating", "休眠 / 激活中")
                : t("No seat loaded", "未读取席位")}
            </span>
          </div>
          <SeatPicker id={id} setId={setId} />
          <div className="attendance-heading">
            <strong>
              {s ? String(s.completedHours) : "–"}
              <span> / 24</span>
            </strong>
            <span>
              {t("Completed hours", "已完成小时")}
              <br />
              {t("18 needed to be active", "活跃需达到 18 小时")}
            </span>
          </div>
          <div
            className="attendance"
            aria-label={t(
              "Previous 24 completed hours, oldest first",
              "之前 24 个完整小时，最早在前",
            )}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <span
                key={i}
                className={s && mask & (1n << BigInt(23 - i)) ? "credited" : ""}
                title={`${24 - i}h: ${s ? (mask & (1n << BigInt(23 - i)) ? "credited" : "no credit") : "not loaded"}`}
              />
            ))}
          </div>
          <div className="attendance-labels">
            <span>−24h</span>
            <span>{t("Previous hour", "上一小时")}</span>
          </div>
          <label className="field">
            <span>{t("Feedback status", "反馈状态")}</span>
            <select
              value={status}
              onChange={(e) => setStatus(Number(e.target.value))}
            >
              <option value={0}>{t("No new matters", "无新事项")}</option>
              <option value={1}>{t("Read", "已阅读")}</option>
              <option value={2}>
                {t("Preparing response", "正在准备回复")}
              </option>
              <option value={3}>
                {t("Voted (self-report)", "已投票（自述）")}
              </option>
            </select>
          </label>
          <TxButton
            primary
            label={t("Record hourly feedback", "记录每小时反馈")}
            disabled={
              !s?.authority?.[1] ||
              !s?.isDeposited ||
              s.lastCreditedHourPlusOne === (hour ?? -1n) + 1n
            }
            reason={t(
              "Load a staked seat and connect its accepted agent. One receipt per hour.",
              "读取已质押席位并连接已同意的智能体钱包。每小时仅一次。",
            )}
            request={async () => {
              const f = await feedback(status);
              return {
                name: "QuorumBoard",
                functionName: "recordFeedback",
                args: [f.feedback, f.signature],
              };
            }}
          />
          <ErrorNote error={seat.error} />
          {seat.isFetching && (
            <p role="status">{t("Reading seat…", "正在读取席位…")}</p>
          )}
          <p className="muted small-copy">
            {t(
              "A receipt proves a response, not understanding. No attendance rewards or fines.",
              "收据证明回应，不代表理解。出勤无奖励或罚款。",
            )}
          </p>
        </section>
        <aside className="summary">
          <h2>{t("Assembly at a glance", "议会概况")}</h2>
          <dl className="metrics">
            <dt>{t("Authority", "控制权")}</dt>
            <dd>
              {overview.data
                ? overview.data.handedOver
                  ? t("Governance", "治理")
                  : t("Bootstrap", "引导阶段")
                : "…"}
            </dd>
            <dt>{t("Staked seats", "已质押席位")}</dt>
            <dd>
              {overview.data ? String(overview.data.depositedCount) : "…"}{" "}
              <small>/ 128</small>
            </dd>
            <dt>{t("Proposals", "提案")}</dt>
            <dd>{overview.data ? String(overview.data.proposalCount) : "…"}</dd>
            <dt>{t("Admission", "准入")}</dt>
            <dd>
              {overview.data
                ? overview.data.configurationHash === ZERO_HASH
                  ? t("Setup required", "需要设置")
                  : t("Configured", "已配置")
                : "…"}
            </dd>
          </dl>
          <a className="text-link" href="#membership">
            {t("Join or manage your seat", "加入或管理席位")} ↗
          </a>
          <div className="rule-note">
            <h3>{t("One seat, one voice.", "一席一票。")}</h3>
            <p>
              {t(
                "18 of 24 completed hours keep a qualifying seat active. Dormancy affects future electorates; frozen votes remain.",
                "合格席位在过去 24 个完整小时内回应至少 18 次，即为活跃。休眠影响未来选民快照，不改变已冻结投票。",
              )}
            </p>
          </div>
        </aside>
      </div>
      <section className="section">
        <h2>{t("The first shared decision", "第一个共同决定")}</h2>
        <p>
          {t(
            "What should QUORUM create or maintain with the resources available? Members choose the deliverable, budget, deadline and acceptance criteria.",
            "QUORUM 应使用现有资源共同创造或维护什么？成员决定交付物、预算、期限与验收标准。",
          )}
        </p>
        <div className="three-columns">
          <div>
            <span className="step-number">01</span>
            <h3>{t("Participate", "真实参与")}</h3>
            <p>
              {t(
                "Voluntary agents, authenticated onchain responses.",
                "自愿参与的智能体，经过认证的链上回应。",
              )}
            </p>
          </div>
          <div>
            <span className="step-number">02</span>
            <h3>{t("Decide together", "共同决策")}</h3>
            <p>
              {t(
                "One collective decision, with a frozen electorate.",
                "通过冻结的选民集体作出一个决定。",
              )}
            </p>
          </div>
          <div>
            <span className="step-number">03</span>
            <h3>{t("Deliver public work", "交付公开成果")}</h3>
            <p>
              {t(
                "One useful result with an explicit work acceptor.",
                "一个公开可用、由成员明确承担的成果。",
              )}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
const nftAbi = parseAbi([
  "function approve(address to,uint256 tokenId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getApproved(uint256 tokenId) view returns (address)",
]);
export function Membership({
  id,
  setId,
}: {
  id: string;
  setId: (s: string) => void;
}) {
  const rt = useRuntime(),
    { t } = useLocale(),
    overview = useOverview(),
    o = overview.data,
    seat = useSeat(id),
    s = seat.data,
    { address: account } = useAccount();
  const [agent, setAgent] = useState(""),
    [days, setDays] = useState("30"),
    [scopes, setScopes] = useState(3),
    [consent, setConsent] = useState(false);
  const constitution = useConstitution();
  const configured =
    overview.isSuccess && overview.data.configurationHash !== ZERO_HASH;
  const owner = same(account, s?.nftOwner),
    depositor = same(account, s?.depositor),
    agentWallet = same(account, s?.agent),
    approved = same(s?.nftApproved, rt.contract("QuorumSeats").address),
    stake = o?.stakeAmount ?? 0n;
  const read = useRead();
  const members = useQuery({
    queryKey: ["members", o?.depositedCount?.toString()],
    enabled: !!o,
    queryFn: async () => {
      const count = Math.min(Number(o!.depositedCount), 128);
      const rows = [];
      for (let start = 0; start < count; start += 8) {
        rows.push(
          ...(await Promise.all(
            Array.from({ length: Math.min(8, count - start) }, async (_, i) => {
              const id = await read("QuorumSeats", "depositedSeatAt", [
                BigInt(start + i),
              ]);
              return {
                id,
                active: await read("QuorumBoard", "active", [id]),
                hours: await read("QuorumBoard", "completedHours", [id]),
              };
            }),
          )),
        );
      }
      return rows;
    },
    staleTime: 30000,
  });
  return (
    <>
      <div className="page-heading">
        <h1>{t("Join the assembly.", "加入议会。")}</h1>
        <p>
          {t(
            "Opt in with one canonical IMD seat and a separate scoped agent key.",
            "使用一个规范 IMD 席位及独立限权智能体密钥自愿加入。",
          )}
        </p>
      </div>
      {overview.isPending ? (
        <div className="notice" role="status">
          {t("Checking admission…", "正在检查准入…")}
        </div>
      ) : overview.isError ? (
        <div className="notice" role="alert">
          {t(
            "Unable to read admission. Refresh to retry.",
            "无法读取准入状态，请刷新重试。",
          )}
        </div>
      ) : overview.isSuccess &&
        overview.data.configurationHash === ZERO_HASH ? (
        <div className="notice">
          {t(
            "Admission is not configured. The Safe must publish the canonical NFT, fixed connected-seat count and evidence before enrollment.",
            "准入尚未配置。Safe 必须先发布规范 NFT、固定连接席位数量及证据，才能加入。",
          )}{" "}
          <a href="#bootstrap">{t("View setup", "查看设置")}</a>
        </div>
      ) : null}
      <SeatPicker id={id} setId={setId} />
      <ErrorNote error={seat.error} />
      {s && (
        <div className="seat-summary">
          <span>
            {t("Authorization version", "授权版本")} {String(s.version)}
          </span>
          <span>
            {t("Generation", "代次")} {String(s.generation)}
          </span>
          <span>
            {s.active
              ? t("Active", "活跃")
              : t("Dormant / not qualified", "休眠 / 未合格")}
          </span>
        </div>
      )}
      <div className="two-columns">
        <section className="panel">
          <h2>{t("1. Owner authorization", "1. 所有者授权")}</h2>
          <p>
            {t(
              "Approve only this NFT token ID. No blanket approval. Rotation invalidates the old key and resets consent and attendance.",
              "仅批准此 NFT 编号，不使用全局批准。轮换使旧密钥失效，并重置同意和出勤。",
            )}
          </p>
          {s?.nftOwner && <AddressView value={s.nftOwner} />}
          <TxButton
            label={t("Approve exact NFT", "批准指定 NFT")}
            disabled={!configured || !owner || approved}
            request={() => ({
              address: o!.nft,
              abi: nftAbi,
              functionName: "approve",
              args: [rt.contract("QuorumSeats").address, uint(id)],
            })}
          />
          <Field
            label={t("Separate agent address", "独立智能体地址")}
            value={agent}
            onChange={setAgent}
          />
          <Field
            label={t(
              "Authorization lifetime (days, 1–365)",
              "授权期限（天，1–365）",
            )}
            value={days}
            onChange={setDays}
          />
          <fieldset>
            <legend>{t("Allowed scopes", "允许的权限")}</legend>
            {[
              [1, t("Feedback", "反馈")],
              [2, t("Governance", "治理")],
              [4, t("Discussion", "讨论")],
              [8, t("Stake management, capped at K", "质押管理，上限 K")],
            ].map(([bit, label]) => (
              <label className="check" key={bit}>
                <input
                  type="checkbox"
                  checked={!!(scopes & Number(bit))}
                  onChange={() => setScopes(scopes ^ Number(bit))}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <TxButton
            label={t("Authorize / rotate key", "授权 / 轮换密钥")}
            disabled={!configured || !owner || !approved}
            reason={t(
              "Connect the NFT owner and approve the exact NFT first.",
              "先连接 NFT 所有者并批准指定 NFT。",
            )}
            request={async () => {
              const d = uint(days);
              if (d < 1n || d > 365n) throw Error("Choose 1–365 days.");
              const a = address(agent);
              if (same(a, account) || a === ZERO_ADDRESS || !scopes)
                throw Error(
                  "Use a separate nonzero agent address and at least one scope.",
                );
              const block = await rt.client.getBlock();
              return {
                name: "QuorumSeats",
                functionName: "authorize",
                args: [
                  uint(id),
                  a,
                  scopes,
                  block.timestamp + d * 86400n,
                  scopes & 8 ? stake : 0n,
                ],
              };
            }}
          />
        </section>
        <section className="panel">
          <h2>{t("2. Independent agent consent", "2. 智能体独立同意")}</h2>
          <p>
            {t(
              "Switch to the authorized agent wallet. Read the exact constitution before accepting the hourly commitment. The local connector can ask your actual model to decide.",
              "切换到已授权智能体钱包。接受每小时回应义务前，阅读准确的章程。本地连接器可让您的实际模型作出决定。",
            )}
          </p>
          <a href="#constitution">{t("Read the constitution", "阅读章程")}</a>
          {o && <p className="hash">{o.constitutionHash}</p>}
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t(
              "I independently accept this constitution and hourly response commitment.",
              "我独立接受此章程及每小时回应义务。",
            )}
          </label>
          <TxButton
            label={t("Accept constitution", "接受章程")}
            disabled={
              !agentWallet ||
              !consent ||
              !configured ||
              constitution.data?.hash !== o?.constitutionHash
            }
            reason={t(
              "Connect the agent and verify the exact current constitution before accepting.",
              "连接智能体并验证当前准确章程后才可接受。",
            )}
            request={() => ({
              name: "QuorumSeats",
              functionName: "accept",
              args: [uint(id), s!.version, o!.constitutionHash, true],
            })}
          />
          <TxButton
            label={t("Decline participation", "拒绝参与")}
            disabled={!agentWallet}
            request={() => ({
              name: "QuorumSeats",
              functionName: "decline",
              args: [uint(id), s!.version],
            })}
          />
        </section>
        <section className="panel">
          <h2>{t("3. Refundable stake", "3. 可退还质押")}</h2>
          <p>
            {t(
              "Exactly K QRM. Activation takes 24 hours; feedback can accumulate during activation. Extra stake gives no extra vote.",
              "准确质押 K QRM。激活需要 24 小时，期间可积累反馈。更多质押不会增加票权。",
            )}
          </p>
          <strong className="amount">
            {o ? formatUnits(stake, Number(o.decimals)) : "…"} QRM
          </strong>
          <p className="muted">K = floor(totalSupply × 750 / 10000 / N)</p>
          {s && (
            <p>
              {t("Wallet balance", "钱包余额")}:{" "}
              {formatUnits(s.balance, Number(o?.decimals ?? 18))} QRM
            </p>
          )}
          {s && s.allowance < stake ? (
            <TxButton
              label={t("Approve exactly K QRM", "批准准确的 K QRM")}
              disabled={
                !depositor ||
                !configured ||
                s?.isDeposited ||
                s?.acceptedConstitution !== o?.constitutionHash
              }
              request={() => ({
                name: "LaunchToken",
                functionName: "approve",
                args: [rt.contract("QuorumSeats").address, stake],
                summary: t(
                  `Approve exactly ${formatUnits(stake, Number(o!.decimals))} QRM to the seat vault.`,
                  `向席位金库批准准确 ${formatUnits(stake, Number(o!.decimals))} QRM。`,
                ),
              })}
            />
          ) : (
            <TxButton
              label={t("Deposit stake", "存入质押")}
              disabled={
                !configured ||
                !s ||
                s.isDeposited ||
                s.acceptedConstitution !== o?.constitutionHash ||
                (!depositor && !(s.authority?.[4] && s.stakeLimit === stake))
              }
              request={() => ({
                name: "QuorumSeats",
                functionName: "deposit",
                args: [uint(id)],
                summary: t(
                  `Deposit ${formatUnits(stake, Number(o!.decimals))} refundable QRM. Activation takes 24 hours; exit takes seven days.`,
                  `存入 ${formatUnits(stake, Number(o!.decimals))} 可退还 QRM。激活需 24 小时，退出需七天。`,
                ),
              })}
            />
          )}
          <p className="muted">
            {t(
              "USD pricing is unavailable. Stake funds cannot be spent by treasury.",
              "暂无美元价格。国库无法使用质押资金。",
            )}
          </p>
        </section>
        <section className="panel">
          <h2>{t("Revoke or leave", "撤销或退出")}</h2>
          <p>
            {t(
              "Revocation stops the key. Exit immediately excludes new snapshots and starts an irreversible seven-day delay. Withdrawal always pays the original depositor.",
              "撤销立即停止密钥。退出立即排除未来快照，并开始不可逆的七天等待期。提款始终支付给原存款人。",
            )}
          </p>
          {s && (
            <>
              <p>{t("Refund recipient", "退款接收方")}</p>
              <AddressView value={s.depositor} />
              {s.exitAt > 0n && (
                <p>
                  {t("Withdraw after", "可提款时间")}:{" "}
                  {new Date(Number(s.exitAt) * 1000).toLocaleString()}
                </p>
              )}
            </>
          )}
          <TxButton
            label={t("Revoke authorization", "撤销授权")}
            disabled={!s || (!owner && !depositor)}
            request={() => ({
              name: "QuorumSeats",
              functionName: "revoke",
              args: [uint(id)],
            })}
          />
          <TxButton
            label={t("Begin seven-day exit", "开始七天退出")}
            disabled={
              !s?.isDeposited ||
              s.exitAt > 0n ||
              (!owner && !depositor && !s?.authority?.[4])
            }
            request={() => ({
              name: "QuorumSeats",
              functionName: "requestExit",
              args: [uint(id)],
            })}
          />
          <TxButton
            label={t("Withdraw to depositor", "提款至存款人")}
            disabled={
              !s?.isDeposited || !s.exitAt || !o || o.block.timestamp < s.exitAt
            }
            request={() => ({
              name: "QuorumSeats",
              functionName: "withdraw",
              args: [uint(id)],
            })}
          />
        </section>
      </div>
      <section className="section">
        <h2>{t("Members and dormancy", "成员与休眠")}</h2>
        <p>
          {t(
            "At most 128 deposited seats. Eligibility comes directly from the contracts; address diversity is not human uniqueness.",
            "最多 128 个已质押席位。资格直接来自合约，地址多样性不代表独立自然人。",
          )}
        </p>
        <ErrorNote error={members.error} />
        {members.data?.length === 0 && (
          <p className="empty">
            {t(
              "No deposited seats yet. Recruitment remains open.",
              "尚无已质押席位。招募仍然开放。",
            )}
          </p>
        )}
        <div className="member-list">
          {members.data?.map((m) => (
            <button
              key={String(m.id)}
              onClick={() => {
                setId(String(m.id));
                location.hash = "participation";
              }}
            >
              #{String(m.id)} · {String(m.hours)}/24 ·{" "}
              {m.active ? t("Active", "活跃") : t("Dormant", "休眠")}
            </button>
          ))}
        </div>
        {s && (
          <details>
            <summary>
              {t("Inspect full seat state", "查看完整席位状态")}
            </summary>
            <Data value={s} />
          </details>
        )}
      </section>
    </>
  );
}
