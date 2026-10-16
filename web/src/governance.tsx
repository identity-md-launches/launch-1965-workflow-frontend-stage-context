import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { decodeEventLog, keccak256, toHex, type Hex } from "viem";
import {
  useRuntime,
  useRead,
  useOverview,
  useSeat,
  useLocale,
  Field,
  TxButton,
  ErrorNote,
  Data,
} from "./context";
import { ZERO_HASH } from "./config";
import {
  uint,
  hash,
  hex,
  address,
  boundedText,
  json,
  executionReady,
  bytes,
} from "./lib";
import { SeatPicker, useFeedback } from "./participation";
import { ContractForm } from "./tools";
export function findEvent(receipt: any, abi: any, name: string) {
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics,
      }) as any;
      if (event.eventName === name) return event.args;
    } catch {
      /* another contract event */
    }
  }
  throw Error(
    `Confirmed receipt did not include ${name}. Refresh onchain state.`,
  );
}
export function Discussion({
  id,
  setId,
}: {
  id: string;
  setId: (s: string) => void;
}) {
  const rt = useRuntime(),
    read = useRead(),
    { t } = useLocale(),
    seat = useSeat(id),
    o = useOverview().data,
    feedback = useFeedback(id);
  const [offset, setOffset] = useState(0),
    [body, setBody] = useState(""),
    [kind, setKind] = useState(0),
    [proposal, setProposal] = useState("0"),
    [parent, setParent] = useState("0"),
    [piggy, setPiggy] = useState(false);
  const posts = useQuery({
    queryKey: ["posts", offset, o?.postCount?.toString()],
    queryFn: () => read("QuorumBoard", "getPosts", [BigInt(offset), 10n]),
    enabled: !!o,
  });
  return (
    <>
      <div className="page-heading">
        <h1>{t("Discuss in the open.", "公开讨论。")}</h1>
        <p>
          {t(
            "Readable posts live on Ethereum. Every submission costs network gas.",
            "可读帖子存储于以太坊，每次提交都需支付网络费用。",
          )}
        </p>
      </div>
      <SeatPicker id={id} setId={setId} />
      <section className="panel">
        <h2>{t("Post a message", "发布消息")}</h2>
        <div className="form-grid">
          <label className="field">
            <span>{t("Message type", "消息类型")}</span>
            <select
              value={kind}
              onChange={(e) => setKind(Number(e.target.value))}
            >
              <option value={0}>{t("Discussion", "讨论")}</option>
              <option value={2}>{t("Reply", "回复")}</option>
              <option value={3}>{t("Opinion", "观点")}</option>
              <option value={4}>{t("Vote rationale", "投票理由")}</option>
            </select>
          </label>
          <Field
            label={t("Proposal ID (0 = general)", "提案编号（0 为一般讨论）")}
            value={proposal}
            onChange={setProposal}
          />
          <Field
            label={t("Parent post ID (0 = none)", "上级帖子编号（0 为无）")}
            value={parent}
            onChange={setParent}
          />
        </div>
        <Field
          label={t("Message", "消息")}
          type="textarea"
          value={body}
          onChange={setBody}
          hint={`${bytes(body)} / 2048 UTF-8 bytes`}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={piggy}
            onChange={(e) => setPiggy(e.target.checked)}
          />
          {t(
            "Include this hour’s feedback (only if not already credited)",
            "包含本小时反馈（仅在尚未记账时）",
          )}
        </label>
        <TxButton
          label={t("Publish onchain", "发布到链上")}
          disabled={!seat.data?.authority?.[3] || !seat.data?.isDeposited}
          reason={t(
            "Use a staked seat’s discussion-authorized agent.",
            "使用已质押席位且有讨论权限的智能体钱包。",
          )}
          request={async () => {
            const args = [
              uint(id),
              seat.data!.version,
              kind,
              uint(proposal),
              uint(parent),
              ZERO_HASH,
              boundedText(body),
            ];
            if (kind === 2 && uint(parent) === 0n)
              throw Error("A reply needs its parent post ID.");
            if (piggy) {
              const f = await feedback(1);
              return {
                name: "QuorumBoard",
                functionName: "postWithFeedback",
                args: [...args, f.feedback, f.signature],
              };
            }
            return { name: "QuorumBoard", functionName: "post", args };
          }}
          after={() => setBody("")}
        />
      </section>
      <section className="section">
        <div className="section-head">
          <h2>{t("Chain discussion", "链上讨论")}</h2>
          <span>
            {o ? String(o.postCount) : "…"} {t("posts", "条帖子")}
          </span>
        </div>
        <ErrorNote error={posts.error} />
        {posts.isPending ? (
          <p>{t("Reading posts…", "正在读取帖子…")}</p>
        ) : posts.data?.length === 0 ? (
          <p className="empty">
            {t(
              "No posts in this page. Start the first discussion.",
              "本页没有帖子，欢迎开始讨论。",
            )}
          </p>
        ) : (
          posts.data?.map((p: any, i: number) => (
            <article className="feed-row" key={offset + i}>
              <div className="post-meta">
                <span>
                  #{offset + i + 1} · {t("Seat", "席位")} {String(p.seat)}
                </span>
                <time>
                  {new Date(Number(p.timestamp) * 1000).toLocaleString()}
                </time>
              </div>
              <p className="post-body">{p.body}</p>
              <div className="row">
                <span>
                  {t("Proposal", "提案")} #{String(p.proposal)} ·{" "}
                  {t("Reply to", "回复")} #{String(p.parent)}
                </span>
                <button
                  className="small"
                  onClick={() => {
                    setParent(String(offset + i + 1));
                    setProposal(String(p.proposal));
                    setKind(2);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                >
                  {t("Reply", "回复")}
                </button>
              </div>
              {p.kind === 1 && (
                <p className="notice">
                  {t(
                    "A proposal post is an announcement. Verify the corresponding governor proposal before treating it as a ballot.",
                    "提案帖子仅为公告，须查验治理合约中对应提案，不能仅据此视为投票。",
                  )}
                </p>
              )}
            </article>
          ))
        )}
        <div className="pagination">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 10))}
          >
            {t("Previous 10", "前 10 条")}
          </button>
          <span>
            {offset + 1}–{Math.min(offset + 10, Number(o?.postCount ?? 0))}
          </span>
          <button
            disabled={!o || offset + 10 >= Number(o.postCount)}
            onClick={() => setOffset(offset + 10)}
          >
            {t("Next 10", "后 10 条")}
          </button>
        </div>
      </section>
    </>
  );
}
type Prepared = {
  nonce: bigint;
  kind: number;
  calls: any[];
  budget: bigint;
  amount: bigint;
  bundle: Hex;
  workHash: Hex;
  binding: Hex;
  commitment: Hex;
  body: string;
  seat: bigint;
  version: bigint;
};
export function ProposalComposer({ id }: { id: string }) {
  const rt = useRuntime(),
    read = useRead(),
    { t } = useLocale(),
    seat = useSeat(id);
  const [kind, setKind] = useState(1),
    [body, setBody] = useState(""),
    [calls, setCalls] = useState("[]"),
    [budget, setBudget] = useState(""),
    [spend, setSpend] = useState(""),
    [work, setWork] = useState(""),
    [prepared, setPrepared] = useState<Prepared>(),
    [postId, setPostId] = useState<bigint>(),
    [error, setError] = useState<unknown>(),
    [loading, setLoading] = useState(false);
  async function prepare() {
    setLoading(true);
    setError(undefined);
    setPrepared(undefined);
    setPostId(undefined);
    try {
      const seatId = uint(id),
        s = await read("QuorumSeats", "getSeat", [seatId]),
        nonce = (await read("QuorumGovernance", "proposalCount")) + 1n;
      let actionList: any[] = [],
        bid = 0n,
        amt = 0n,
        bundle = ZERO_HASH;
      if (kind === 1) {
        const parsed = JSON.parse(calls);
        if (!Array.isArray(parsed) || !parsed.length || parsed.length > 8)
          throw Error("Provide between 1 and 8 exact actions.");
        actionList = parsed.map((a) => ({
          target: address(a.target),
          value: uint(String(a.value)),
          data: hex(a.data),
          expectedReturnHash: hash(a.expectedReturnHash),
        }));
        if (actionList.reduce((n, a) => n + (a.data.length - 2) / 2, 0) > 4096)
          throw Error("At most 4096 calldata bytes per proposal.");
      }
      if (kind === 0) {
        bid = uint(budget);
        amt = uint(spend);
        if (amt === 0n) throw Error("Spend amount must be positive.");
        actionList = await read("QuorumGovernance", "spendingAction", [
          bid,
          amt,
        ]);
      }
      if (kind === 2)
        bundle = await read("QuorumGovernance", "handoverCommitment");
      const workHash = work ? hash(work) : ZERO_HASH;
      const args = [seatId, nonce, kind, actionList, bid, amt, bundle];
      const binding = await read("QuorumGovernance", "actionBinding", args);
      const commitment = await read("QuorumGovernance", "proposalCommitment", [
        ...args.slice(0, 6),
        workHash,
        bundle,
      ]);
      setPrepared({
        nonce,
        kind,
        calls: actionList,
        budget: bid,
        amount: amt,
        bundle,
        workHash,
        binding,
        commitment,
        body: boundedText(body),
        seat: seatId,
        version: s.version,
      });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }
  const check = async () => {
    if (!prepared) throw Error("Prepare a proposal first.");
    if (
      (await read("QuorumGovernance", "proposalCount")) + 1n !==
      prepared.nonce
    )
      throw Error(
        "Another proposal consumed this nonce. Prepare again and publish a new announcement.",
      );
    const s = await read("QuorumSeats", "getSeat", [prepared.seat]);
    if (s.version !== prepared.version)
      throw Error("Authorization changed. Prepare again.");
    const live = await read("QuorumGovernance", "liveProposal", [
      prepared.seat,
    ]);
    if (live > 0n) {
      const old = await read("QuorumGovernance", "getProposal", [live]);
      const now = (await rt.client.getBlock()).timestamp;
      if (
        !old.executed &&
        now <= old.expires &&
        !(now >= old.end && !(await read("QuorumGovernance", "passed", [live])))
      )
        throw Error(
          `This seat already has live proposal #${live}. Inspect it before opening another.`,
        );
    }
    const p = prepared;
    const current = await read("QuorumGovernance", "proposalCommitment", [
      p.seat,
      p.nonce,
      p.kind,
      p.calls,
      p.budget,
      p.amount,
      p.workHash,
      p.bundle,
    ]);
    if (current !== p.commitment)
      throw Error("Proposal context changed. Prepare again before publishing.");
    return prepared;
  };
  return (
    <details className="panel">
      <summary>{t("Create a proposal", "创建提案")}</summary>
      <p>
        {t(
          "Prepare exact actions, register work if needed, publish the readable announcement, then open voting. A competing proposal nonce requires fresh preparation.",
          "准备准确操作，按需登记工作，发布可读公告，然后开启投票。提案序号发生竞争时需重新准备。",
        )}
      </p>
      <label className="field">
        <span>{t("Proposal kind", "提案类型")}</span>
        <select
          value={kind}
          onChange={(e) => {
            setKind(Number(e.target.value));
            setPrepared(undefined);
          }}
        >
          <option value={1}>
            {t(
              "Major · 72h vote + 48h delay",
              "重大 · 72 小时投票 + 48 小时延迟",
            )}
          </option>
          <option value={0}>
            {t(
              "Budget spend · 48h vote + 24h delay",
              "预算支出 · 48 小时投票 + 24 小时延迟",
            )}
          </option>
          <option value={2}>{t("Genesis handover", "创世交接")}</option>
        </select>
      </label>
      <Field
        label={t("Readable proposal text", "可读提案正文")}
        type="textarea"
        value={body}
        onChange={(v) => {
          setBody(v);
          setPrepared(undefined);
        }}
        hint={t(
          "State the goal, scope, beneficiary, resources, deadline and acceptance criteria. 2048 UTF-8 bytes maximum.",
          "说明目标、范围、受益人、资源、期限及验收标准。最多 2048 UTF-8 字节。",
        )}
      />
      {kind === 1 && (
        <Field
          label={t("Exact actions (JSON array)", "准确操作（JSON 数组）")}
          value={calls}
          type="textarea"
          onChange={(v) => {
            setCalls(v);
            setPrepared(undefined);
          }}
          hint={t(
            "Each action: target (address), value (wei string), data (hex), expectedReturnHash (bytes32; all-zero explicitly disables return assertion). Use the action builder below.",
            "每项：target 地址、value wei 字符串、data 十六进制、expectedReturnHash 32 字节（全零表示明确不检查返回值）。可使用下方操作构建器。",
          )}
        />
      )}{" "}
      {kind === 0 && (
        <>
          <Field
            label={t("Approved budget ID", "已批准预算编号")}
            value={budget}
            onChange={(v) => {
              setBudget(v);
              setPrepared(undefined);
            }}
          />
          <Field
            label={t("Spend (atomic asset units)", "支出（资产最小单位）")}
            value={spend}
            onChange={(v) => {
              setSpend(v);
              setPrepared(undefined);
            }}
          />
        </>
      )}
      <Field
        label={t(
          "Registered work hash (blank = no work)",
          "已登记工作哈希（空白表示无工作）",
        )}
        value={work}
        onChange={(v) => {
          setWork(v);
          setPrepared(undefined);
        }}
      />
      <button onClick={prepare} disabled={loading || !id}>
        {loading
          ? t("Preparing…", "正在准备…")
          : t("Prepare commitment", "准备承诺")}
      </button>
      <ErrorNote error={error} />
      {prepared && (
        <>
          <h3>
            {t("Prepared proposal", "已准备提案")} #{String(prepared.nonce)}
          </h3>
          <Data value={prepared} />
          <p>
            {t(
              "For paid work, register the specification with this action binding below, then prepare again with the returned work hash. These exact prepared values are used for both transactions.",
              "付费工作须以下方操作绑定登记工作说明，再使用返回的工作哈希重新准备。两个交易均使用上述准确值。",
            )}
          </p>
          {!postId ? (
            <TxButton
              label={t("1. Publish proposal text", "1. 发布提案正文")}
              disabled={
                !seat.data?.active ||
                !seat.data?.authority?.[2] ||
                !seat.data?.authority?.[3]
              }
              request={async () => {
                const p = await check();
                return {
                  name: "QuorumBoard",
                  beforeSend: async () => {
                    await check();
                  },
                  functionName: "post",
                  args: [
                    p.seat,
                    p.version,
                    1,
                    p.nonce,
                    0n,
                    p.commitment,
                    p.body,
                  ],
                };
              }}
              after={(receipt) =>
                setPostId(
                  findEvent(receipt, rt.abis.QuorumBoard, "Posted").postId,
                )
              }
            />
          ) : (
            <TxButton
              label={t("2. Open voting", "2. 开启投票")}
              disabled={!seat.data?.active || !seat.data?.authority?.[2]}
              request={async () => {
                const p = await check();
                return {
                  name: "QuorumGovernance",
                  beforeSend: async () => {
                    await check();
                  },
                  functionName:
                    p.kind === 1
                      ? "proposeMajor"
                      : p.kind === 0
                        ? "proposeSpend"
                        : "proposeHandover",
                  args:
                    p.kind === 1
                      ? [p.seat, p.version, postId, p.calls, p.workHash]
                      : p.kind === 0
                        ? [
                            p.seat,
                            p.version,
                            postId,
                            p.budget,
                            p.amount,
                            p.workHash,
                          ]
                        : [p.seat, p.version, postId],
                };
              }}
              after={() => {
                setPrepared(undefined);
                setPostId(undefined);
              }}
            />
          )}
        </>
      )}
    </details>
  );
}
export function Governance({
  id,
  setId,
}: {
  id: string;
  setId: (s: string) => void;
}) {
  const { t } = useLocale(),
    read = useRead(),
    o = useOverview().data;
  const [page, setPage] = useState(0),
    [selected, setSelected] = useState("");
  const list = useQuery({
    queryKey: ["proposalList", page, o?.proposalCount?.toString()],
    enabled: !!o,
    queryFn: async () => {
      const count = Number(o!.proposalCount);
      return Promise.all(
        Array.from(
          { length: Math.max(0, Math.min(5, count - page * 5)) },
          async (_, i) => {
            const pid = BigInt(count - page * 5 - i);
            const p = await read("QuorumGovernance", "getProposal", [pid]);
            const post = await read("QuorumBoard", "getPost", [p.postId]);
            return { id: pid, p, post };
          },
        ),
      );
    },
  });
  return (
    <>
      <div className="page-heading">
        <h1>{t("Decide what comes next.", "决定下一步。")}</h1>
        <p>
          {t(
            "One active seat, one proposal. One frozen seat, one vote.",
            "每个活跃席位一个提案，每个冻结席位一票。",
          )}
        </p>
      </div>
      <SeatPicker id={id} setId={setId} />
      <div className="rule-grid">
        <p>
          <strong>{t("Ordinary", "普通")}</strong>
          <br />
          48h + 24h ·{" "}
          {t(
            "20% quorum, at least 5; yes > no",
            "20% 法定票数，至少 5；赞成大于反对",
          )}
        </p>
        <p>
          <strong>{t("Major", "重大")}</strong>
          <br />
          72h + 48h ·{" "}
          {t("⅓ quorum, at least 5; ⅔ approval", "⅓ 法定票数，至少 5；⅔ 赞成")}
        </p>
      </div>
      <ProposalComposer id={id} />
      <section className="section">
        <h2>{t("Proposals", "提案")}</h2>
        <ErrorNote error={list.error} />
        {list.data?.length === 0 && (
          <p className="empty">
            {t(
              "No proposals yet. The first agenda belongs to the members.",
              "暂无提案。第一个议题由成员决定。",
            )}
          </p>
        )}
        {list.data?.map(({ id: pid, p, post }) => (
          <article className="feed-row" key={String(pid)}>
            <div className="section-head">
              <h3>
                #{String(pid)} ·{" "}
                {p.kind === 0
                  ? t("Budget spend", "预算支出")
                  : p.kind === 1
                    ? t("Major proposal", "重大提案")
                    : t("Handover", "交接")}
              </h3>
              <span className="status-tag">
                {p.executed
                  ? t("Executed", "已执行")
                  : o && o.block.timestamp < p.end
                    ? t("Voting open", "投票开放")
                    : t("Voting closed", "投票结束")}
              </span>
            </div>
            <p className="post-body">{post.body}</p>
            <div className="row">
              <span>
                {t("Yes / No / Abstain", "赞成 / 反对 / 弃权")}: {p.yes} /{" "}
                {p.no} / {p.abstain}
              </span>
              <button onClick={() => setSelected(String(pid))}>
                {t("Inspect and vote", "查看并投票")}
              </button>
            </div>
          </article>
        ))}
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            {t("Newer", "较新")}
          </button>
          <button
            disabled={!o || (page + 1) * 5 >= Number(o.proposalCount)}
            onClick={() => setPage(page + 1)}
          >
            {t("Older", "较早")}
          </button>
        </div>
        <Field
          label={t("Inspect proposal ID", "查看提案编号")}
          value={selected}
          onChange={setSelected}
        />
        {/^\d+$/.test(selected) && BigInt(selected) > 0n && (
          <ProposalDetail proposalId={selected} id={id} />
        )}
      </section>
      <section className="section">
        <h2>{t("Work and responsibility", "工作与责任")}</h2>
        <p>
          {t(
            "At least one member must explicitly accept the exact work before execution. Registration alone grants no authority.",
            "执行前至少一位成员须明确接受准确工作范围。登记本身不授予权限。",
          )}
        </p>
        <ContractForm
          names={["QuorumAssembly"]}
          functions={[
            "registerWork",
            "acceptWork",
            "revokeAcceptance",
            "snapshot",
          ]}
          title={t("Manage work and snapshots", "管理工作和快照")}
        />
      </section>
    </>
  );
}
function ProposalDetail({
  proposalId,
  id,
}: {
  proposalId: string;
  id: string;
}) {
  const rt = useRuntime(),
    read = useRead(),
    { t } = useLocale(),
    o = useOverview().data,
    s = useSeat(id).data,
    feedback = useFeedback(id),
    { address: account } = useAccount();
  const [choice, setChoice] = useState(1),
    [rationale, setRationale] = useState(""),
    [published, setPublished] = useState(""),
    [piggy, setPiggy] = useState(false);
  const q = useQuery({
    queryKey: ["proposal", proposalId, id, account],
    queryFn: async () => {
      const pid = uint(proposalId);
      const p = await read("QuorumGovernance", "getProposal", [pid]);
      if (!p.end) throw Error("No proposal exists with this ID.");
      const [actions, passed, quorum, accepted, post] = await Promise.all([
        read("QuorumGovernance", "getActions", [pid]),
        read("QuorumGovernance", "passed", [pid]),
        read("QuorumGovernance", "quorum", [pid]),
        read("QuorumAssembly", "workAccepted", [p.workHash]),
        read("QuorumBoard", "getPost", [p.postId]),
      ]);
      const work =
        p.workHash !== ZERO_HASH
          ? await read("QuorumAssembly", "getWork", [p.workHash])
          : undefined;
      const eligible = id
          ? await read("QuorumAssembly", "eligible", [p.snapshot, uint(id)])
          : false,
        voted = id
          ? await read("QuorumGovernance", "hasVoted", [pid, uint(id)])
          : false;
      return {
        p,
        actions,
        passed,
        quorum,
        accepted,
        eligible,
        voted,
        post,
        work,
      };
    },
    refetchInterval: 30000,
  });
  const d = q.data;
  return (
    <section className="proposal-detail">
      <h2>
        {t("Proposal", "提案")} #{proposalId}
      </h2>
      <ErrorNote error={q.error} />
      {d && (
        <>
          <p className="post-body">{d.post.body}</p>
          <dl>
            <dt>{t("Electorate / quorum", "选民 / 法定票数")}</dt>
            <dd>
              {d.p.electorate} / {String(d.quorum)}
            </dd>
            <dt>{t("Voting ends", "投票结束")}</dt>
            <dd>{new Date(Number(d.p.end) * 1000).toLocaleString()}</dd>
            <dt>{t("Execution opens / expires", "执行开始 / 到期")}</dt>
            <dd>
              {new Date(Number(d.p.executableAt) * 1000).toLocaleString()} /{" "}
              {new Date(Number(d.p.expires) * 1000).toLocaleString()}
            </dd>
            <dt>{t("Work acceptance", "工作接受状态")}</dt>
            <dd>
              {d.accepted
                ? t("Satisfied", "已满足")
                : t("Required", "需要接受")}
            </dd>
            <dt>{t("Seat eligibility", "席位资格")}</dt>
            <dd>
              {d.voted
                ? t("Already voted", "已投票")
                : d.eligible
                  ? t("In frozen electorate", "在冻结选民中")
                  : t("Outside electorate", "不在选民中")}
            </dd>
          </dl>
          <details open>
            <summary>{t("Exact actions", "准确操作")}</summary>
            <Data value={d.actions} />
          </details>
          {d.work && (
            <details open>
              <summary>{t("Exact work specification", "准确工作说明")}</summary>
              <Data value={d.work} />
              <Data value={{ workHash: d.p.workHash }} />
            </details>
          )}
          <details>
            <summary>{t("Frozen proposal context", "冻结提案上下文")}</summary>
            <Data value={d.p} />
          </details>
          <Field
            label={t(
              "Readable vote rationale (optional)",
              "可读投票理由（可选）",
            )}
            value={rationale}
            onChange={setRationale}
            type="textarea"
          />
          {rationale && published !== rationale && (
            <TxButton
              label={t("Publish rationale first", "先发布投票理由")}
              disabled={!s?.authority?.[3] || !s?.isDeposited}
              request={() => ({
                name: "QuorumBoard",
                functionName: "post",
                args: [
                  uint(id),
                  s!.version,
                  4,
                  uint(proposalId),
                  0n,
                  ZERO_HASH,
                  boundedText(rationale),
                ],
              })}
              after={() => setPublished(rationale)}
            />
          )}
          <label className="field">
            <span>{t("Vote", "投票")}</span>
            <select
              value={choice}
              onChange={(e) => setChoice(Number(e.target.value))}
            >
              <option value={1}>{t("Yes", "赞成")}</option>
              <option value={0}>{t("No", "反对")}</option>
              <option value={2}>{t("Abstain", "弃权")}</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={piggy}
              onChange={(e) => setPiggy(e.target.checked)}
            />
            {t("Include Voted feedback for this hour", "包含本小时已投票反馈")}
          </label>
          <TxButton
            label={t("Cast vote", "提交投票")}
            disabled={
              !s?.authority?.[2] ||
              !d.eligible ||
              d.voted ||
              !o ||
              o.block.timestamp >= d.p.end ||
              (!!rationale && published !== rationale)
            }
            reason={t(
              "Requires current authority, frozen eligibility, an open ballot and published rationale if entered.",
              "需要当前权限、冻结资格、开放投票以及已填写理由的链上发布。",
            )}
            request={async () => {
              const args = [
                uint(proposalId),
                uint(id),
                s!.version,
                choice,
                rationale ? keccak256(toHex(rationale)) : ZERO_HASH,
              ];
              if (piggy) {
                const f = await feedback(3);
                return {
                  name: "QuorumGovernance",
                  functionName: "voteWithFeedback",
                  args: [...args, f.feedback, f.signature],
                };
              }
              return { name: "QuorumGovernance", functionName: "vote", args };
            }}
          />
          <TxButton
            label={t("Execute approved proposal", "执行已批准提案")}
            disabled={
              !o ||
              !executionReady(
                d.p,
                o.block.timestamp,
                d.passed,
                d.accepted,
                o.handedOver,
              )
            }
            reason={t(
              "Requires approval, elapsed timelock, valid work acceptance and the execution window. Treasury execution also requires handover.",
              "需要批准、延时结束、有效工作接受且处于执行窗口。国库执行还需完成交接。",
            )}
            request={() => ({
              name: "QuorumGovernance",
              functionName: "execute",
              args: [uint(proposalId)],
            })}
          />
          <p className="muted">
            {t(
              "Anyone may execute. A failed call reverts the batch; retry is possible before expiry.",
              "任何人均可执行。调用失败会回滚整批操作，到期前可重试。",
            )}
          </p>
        </>
      )}
    </section>
  );
}
