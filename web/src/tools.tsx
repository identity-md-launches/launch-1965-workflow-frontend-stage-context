import { useState } from "react";
import { useAccount } from "wagmi";
import {
  encodeFunctionData,
  decodeEventLog,
  type AbiFunction,
  type AbiParameter,
} from "viem";
import {
  useRuntime,
  useOverview,
  useLocale,
  Field,
  TxButton,
  Data,
  ErrorNote,
  useRead,
} from "./context";
import { address, uint, hash, hex, same, json } from "./lib";
import { ZERO_HASH } from "./config";
import { parseArgument } from "./abi-input";
const descriptions: Record<string, [string, string]> = {
  configureAdmission: [
    "Safe only, one time. Supply the verified canonical NFT, launch seat count N and admission dataset evidence.",
    "仅 Safe，一次性。提供已验证规范 NFT、启动时席位数 N 及准入数据集证据。",
  ],
  setConstitution: [
    "Safe only. A new constitution requires renewed consent. After handover, include this call in a major proposal.",
    "仅 Safe。新章程需要重新同意。交接后须将本调用纳入重大提案。",
  ],
  founderAccept: [
    "Founder only. Accept the exact current handover commitment after independent review and real-model rehearsal.",
    "仅创始人。独立审查及真实模型演练后，接受准确的当前交接承诺。",
  ],
  approveBudget: [
    "Major execution only. Encode this call for a major proposal; the recipient, asset, cap, purpose and expiry are immutable.",
    "仅重大提案执行。编码后用于重大提案；接收方、资产、上限、目的及到期时间均不可变。",
  ],
  approveRelease: [
    "Major execution only. First four artifact hashes and manifest URI are required; migrationHash may explicitly be zero.",
    "仅重大提案执行。前四项制品哈希及清单 URI 必填；无迁移时 migrationHash 可明确为零。",
  ],
  registerWork: [
    "Publish actionBinding, beneficiary, deadline (Unix seconds), benefit, scope, resources and acceptance. Copy the returned work hash from the receipt.",
    "发布操作绑定、受益人、期限（Unix 秒）、价值、范围、资源及验收标准。从收据复制工作哈希。",
  ],
  acceptWork: [
    "Current active agent accepts responsibility for this exact work hash.",
    "当前活跃智能体接受此准确工作哈希所代表的责任。",
  ],
  revokeAcceptance: [
    "Revoke the acceptance for this work and seat.",
    "撤销此工作与席位的接受记录。",
  ],
  snapshot: [
    "Freeze all currently active qualified seats. Proposal creation takes its own snapshot; this snapshot cannot replace it.",
    "冻结所有当前活跃合格席位。提案创建时自行生成快照，本快照无法替代。",
  ],
  observePublication: [
    "Anyone may report an observed published hash and URI. This does not approve or verify hosting.",
    "任何人可报告观察到的发布哈希及 URI，这不代表批准或托管验证。",
  ],
  transfer: [
    "Send QRM to an explicitly chosen recipient. Amount is in atomic units (18 decimals).",
    "向明确指定的接收方发送 QRM。数量使用最小单位（18 位小数）。",
  ],
  approve: [
    "Grant an explicit QRM allowance. Amount is in atomic units. Review the spender carefully.",
    "授予明确 QRM 额度，数量使用最小单位。仔细审核支出方。",
  ],
  transferFrom: [
    "Transfer using an existing sender-approved allowance. Amount is in atomic units.",
    "使用发送方已批准额度转账，数量使用最小单位。",
  ],
};
const labels: Record<string, string> = {
  configureAdmission: "配置准入",
  setConstitution: "设置章程",
  founderAccept: "创始人接受",
  approveBudget: "批准预算",
  approveRelease: "批准发布",
  registerWork: "登记工作",
  acceptWork: "接受工作",
  revokeAcceptance: "撤销工作接受",
  snapshot: "创建快照",
  observePublication: "报告发布观察",
  transfer: "转账",
  approve: "批准额度",
  transferFrom: "从授权地址转账",
};
function paramsShape(p: AbiParameter): string {
  return p.type.startsWith("tuple")
    ? json(
        (p as any).components.map((c: AbiParameter) => ({
          [c.name ?? "value"]: c.type,
        })),
      )
    : p.type;
}
export function ContractForm({
  names,
  functions,
  title,
}: {
  names: string[];
  functions: string[];
  title: string;
}) {
  const rt = useRuntime(),
    { t, lang } = useLocale(),
    o = useOverview().data,
    { address: account } = useAccount();
  const options = names.flatMap((name) =>
    (
      rt.abis[name].filter(
        (a) => a.type === "function" && functions.includes(a.name),
      ) as AbiFunction[]
    ).map((fn) => ({ name, fn })),
  );
  const [selected, setSelected] = useState(0),
    [values, setValues] = useState<Record<string, string>>({}),
    [encoded, setEncoded] = useState<unknown>(),
    [error, setError] = useState<unknown>(),
    [receipt, setReceipt] = useState<unknown>(),
    [checking, setChecking] = useState(false),
    [checkedAccount, setCheckedAccount] = useState<string>();
  const item = options[selected];
  if (!item) return null;
  const fn = item.fn,
    description = descriptions[fn.name];
  const args = () =>
    fn.inputs.map((p, i) => parseArgument(p, values[String(i)]));
  const ownerOnly = ["configureAdmission", "setConstitution"].includes(fn.name),
    proposalOnly = ["approveBudget", "approveRelease"].includes(fn.name);
  const cannotSend =
    proposalOnly ||
    (ownerOnly &&
      (!same(account, o?.owner) ||
        (fn.name === "configureAdmission" &&
          o?.configurationHash !== ZERO_HASH) ||
        o?.handedOver)) ||
    (fn.name === "founderAccept" &&
      (!same(account, o?.founder) || o?.handedOver));
  return (
    <details className="operation">
      <summary>{title}</summary>
      <label className="field">
        <span>{t("Contract action", "合约操作")}</span>
        <select
          value={selected}
          onChange={(e) => {
            setSelected(Number(e.target.value));
            setValues({});
            setEncoded(undefined);
            setReceipt(undefined);
            setError(undefined);
          }}
        >
          {options.map((x, i) => (
            <option key={x.name + x.fn.name} value={i}>
              {x.name} ·{" "}
              {lang === "zh" ? (labels[x.fn.name] ?? x.fn.name) : x.fn.name}
            </option>
          ))}
        </select>
      </label>
      {description && <p>{t(...description)}</p>}
      {fn.inputs.map((p, i) => (
        <Field
          key={fn.name + i}
          label={`${p.name ?? i} · ${p.type}`}
          value={values[String(i)] ?? ""}
          type={p.type.startsWith("tuple") ? "textarea" : "text"}
          onChange={(v) => {
            setValues({ ...values, [i]: v });
            setEncoded(undefined);
          }}
          hint={
            p.type.startsWith("tuple")
              ? paramsShape(p)
              : p.type.startsWith("uint")
                ? t(
                    "Whole number in contract units; timestamps use Unix seconds.",
                    "合约单位整数，时间戳为 Unix 秒。",
                  )
                : undefined
          }
        />
      ))}
      <div className="row">
        <button
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            setCheckedAccount(undefined);
            setError(undefined);
            try {
              const parsed = args();
              setEncoded({
                target: rt.contract(item.name).address,
                value: "0",
                data: encodeFunctionData({
                  abi: rt.abis[item.name],
                  functionName: fn.name,
                  args: parsed,
                }),
                expectedReturnHash: ZERO_HASH,
              });
              if (account && !cannotSend) {
                await rt.client.simulateContract({
                  ...rt.contract(item.name),
                  functionName: fn.name,
                  args: parsed,
                  account,
                });
                setCheckedAccount(account);
              }
            } catch (e) {
              setError(e);
            } finally {
              setChecking(false);
            }
          }}
        >
          {checking
            ? t("Checking prerequisites…", "正在检查前置条件…")
            : t("Prepare exact calldata", "准备准确调用数据")}
        </button>
        <TxButton
          label={t("Review and submit", "审核并提交")}
          disabled={
            cannotSend ||
            encoded === undefined ||
            !same(checkedAccount, account)
          }
          reason={
            proposalOnly
              ? t(
                  "Add the prepared call to a major proposal.",
                  "将准备的调用加入重大提案。",
                )
              : t(
                  "Prepare calldata to check prerequisites. Owner settings use the Safe.",
                  "先准备调用数据以检查前置条件。所有者设置须通过 Safe。",
                )
          }
          request={() => ({
            name: item.name,
            functionName: fn.name,
            args: args(),
          })}
          after={(r) => {
            setCheckedAccount(undefined);
            setReceipt({
              transactionHash: r.transactionHash,
              logs: r.logs.map((l: any) => {
                try {
                  return decodeEventLog({
                    abi: rt.abis[item.name],
                    data: l.data,
                    topics: l.topics,
                  });
                } catch {
                  return { address: l.address, topics: l.topics, data: l.data };
                }
              }),
            });
          }}
        />
      </div>
      <ErrorNote error={error} />
      {encoded !== undefined && (
        <>
          <p>
            {t(
              "Prepared only. Review and use in the Safe or a proposal action array.",
              "仅已准备，请审核后用于 Safe 或提案操作数组。",
            )}
          </p>
          <Data value={encoded} />
          <button
            onClick={() =>
              navigator.clipboard.writeText(json([encoded])).catch(setError)
            }
          >
            {t("Copy action array", "复制操作数组")}
          </button>
        </>
      )}
      {receipt !== undefined && <Data value={receipt} />}
    </details>
  );
}
export function Inspector() {
  const rt = useRuntime(),
    read = useRead(),
    { t } = useLocale();
  const options = rt.manifest.contracts.flatMap((c) =>
    (
      rt.abis[c.name].filter(
        (a) =>
          a.type === "function" && ["view", "pure"].includes(a.stateMutability),
      ) as AbiFunction[]
    ).map((fn) => ({ name: c.name, fn })),
  );
  const [index, setIndex] = useState(0),
    [values, setValues] = useState<Record<string, string>>({}),
    [data, setData] = useState<unknown>(),
    [error, setError] = useState<unknown>(),
    [loading, setLoading] = useState(false);
  const x = options[index];
  return (
    <details className="operation">
      <summary>{t("Inspect any contract read", "查看任意合约读取")}</summary>
      <label className="field">
        <span>{t("View function", "只读函数")}</span>
        <select
          value={index}
          onChange={(e) => {
            setIndex(Number(e.target.value));
            setValues({});
            setData(undefined);
            setError(undefined);
          }}
        >
          {options.map((x, i) => (
            <option key={i} value={i}>
              {x.name}.{x.fn.name}
            </option>
          ))}
        </select>
      </label>
      {x.fn.inputs.map((p, i) => (
        <Field
          key={i}
          label={`${p.name ?? i} · ${p.type}`}
          value={values[i] ?? ""}
          onChange={(v) => setValues({ ...values, [i]: v })}
          hint={paramsShape(p)}
        />
      ))}
      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(undefined);
          setData(undefined);
          try {
            setData(
              await read(
                x.name,
                x.fn.name,
                x.fn.inputs.map((p, i) => parseArgument(p, values[i])),
              ),
            );
          } catch (e) {
            setError(e);
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? t("Reading…", "正在读取…") : t("Read contract", "读取合约")}
      </button>
      <ErrorNote error={error} />
      {data !== undefined && <Data value={data} />}
    </details>
  );
}
