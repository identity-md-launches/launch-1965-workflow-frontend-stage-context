// Recovery text authored by this app. Provider/contract diagnostics that are not
// recognized stay available separately; do not guess a translation of raw errors.
const chinese: Record<string, string> = {
  "Enter a valid EVM address with a valid checksum or lowercase letters.":
    "请输入有效的 EVM 地址，使用正确的校验和或全部小写字母。",
  "Enter a non-negative whole number.": "请输入非负整数。",
  "Enter a complete 32-byte hash (0x plus 64 hexadecimal characters).":
    "请输入完整的 32 字节哈希（0x 加 64 个十六进制字符）。",
  "Enter complete hexadecimal bytes, starting with 0x.":
    "请输入以 0x 开头的完整十六进制字节。",
  "Enter an amount greater than zero.": "请输入大于零的金额。",
  "Expected a signed integer.": "请输入整数，可使用负号。",
  "Signed integer exceeds its range.": "整数超出允许范围，请减小数值。",
  "Use true or false.": "请输入 true 或 false。",
  "Request declined in your wallet. Nothing was confirmed. You can retry.":
    "钱包中已拒绝请求，未确认任何操作。您可以重试。",
  "Request failed. Check your connection and retry.":
    "请求失败，请检查连接后重试。",
  "The Safe must configure admission before joining.":
    "加入前，Safe 必须先配置准入。",
  "Connect the NFT owner and approve this exact NFT to the seat vault.":
    "请连接 NFT 所有者钱包，并将此指定 NFT 批准给席位金库。",
  "Use the current authorized agent key. Check expiry and NFT approval.":
    "请使用当前获授权的智能体密钥，并检查到期时间及 NFT 批准状态。",
  "This seat already has feedback for the current chain hour.":
    "此席位在当前链上小时已有反馈，请等待下一小时。",
  "The hour changed. Prepare fresh feedback.": "小时已更替，请重新准备反馈。",
  "An active seat is required to open a proposal.": "发起提案需要活跃席位。",
  "Voting, timelock, acceptance or execution conditions are not satisfied.":
    "投票、时间锁、工作接受或执行条件尚未满足，请检查提案状态。",
  "Treasury execution is unavailable until the explicit governance handover.":
    "明确完成治理交接前，无法执行金库操作。",
  "The exact work needs a current eligible acceptor.":
    "此项确切工作需要一位当前合格的承担者。",
  "Voting has ended or this seat has already voted.":
    "投票已结束，或此席位已经投票。",
  "This seat is not in the frozen electorate.": "此席位不在冻结选民名单中。",
  "The seven-day exit delay has not finished.": "七天退出等待期尚未结束。",
  "This setting requires execution of a major proposal.":
    "此设置需要通过执行重大提案来更改。",
  "Configuration changed. Refresh and review the new handover commitment.":
    "配置已更改，请刷新并审核新的交接承诺。",
  "No approved release exists for this hash.":
    "此哈希没有对应的已批准发布，请检查发布编号。",
  "Select an artifact no larger than 32 MiB.":
    "请选择不超过 32 MiB 的制品文件。",
  "A reply needs its parent post ID.": "回复需要原帖编号。",
  "Provide between 1 and 8 exact actions.": "请提供 1 至 8 个准确操作。",
  "At most 4096 calldata bytes per proposal.":
    "每个提案的调用数据最多为 4096 字节。",
  "Spend amount must be positive.": "支出金额必须大于零。",
  "Prepare a proposal first.": "请先准备提案。",
  "Another proposal consumed this nonce. Prepare again and publish a new announcement.":
    "另一提案已使用此序号，请重新准备并发布新公告。",
  "Authorization changed. Prepare again.": "授权已更改，请重新准备。",
  "Proposal context changed. Prepare again before publishing.":
    "提案上下文已更改，请重新准备后再发布。",
  "No proposal exists with this ID.": "此编号没有对应提案，请检查提案编号。",
  "RPC chain ID does not match the deployment. Transactions are disabled.":
    "RPC 链编号与部署不符，交易已禁用。请检查 RPC 配置。",
  "Finish or reconcile the pending transaction first.":
    "请先完成待处理交易，或核对其收据。",
  "Connect your wallet.": "请连接钱包。",
  "Switch to the configured chain first.": "请先切换到配置的网络。",
  "Contract verification is not complete. Retry the RPC check.":
    "合约验证尚未完成，请重试 RPC 检查。",
  "Review cancelled. Nothing was sent.": "审核已取消，未发送任何交易。",
  "Wallet changed. Review again.": "钱包已更改，请重新审核。",
  "Transaction reverted on chain. No success was recorded.":
    "交易在链上回退，未记录成功状态。请检查交易收据。",
  "No attested pool.": "没有已证明的资金池，请检查部署配置。",
  "Pool does not match the configured token pair.":
    "资金池与配置的代币对不符，请检查部署配置。",
  "A configured Uniswap contract has no code.":
    "配置中的 Uniswap 合约没有代码，请检查网络及配置。",
  "Pair token decimals disagree with the vetted configuration.":
    "配对代币的小数位数与已审核配置不符，请检查配置。",
  "The attested pool is not initialized.": "已证明的资金池尚未初始化。",
  "Wait for pool and token verification.": "请等待资金池及代币验证完成。",
  "Amount exceeds the pool input bound.":
    "金额超出资金池输入上限，请减小金额。",
  "Quote expired or input changed. Request a new quote.":
    "报价已过期或输入已更改，请重新获取报价。",
  "Connect the authorized agent wallet.": "请连接已授权智能体的钱包。",
  "Switch network before signing feedback.": "签署反馈前，请先切换网络。",
  "Connect the current accepted feedback agent.":
    "请连接当前已同意的反馈智能体钱包。",
  "Wait for at least 16 blocks after deployment.":
    "请等待部署后至少 16 个区块。",
  "Choose 1–365 days.": "请选择 1 至 365 天。",
  "Use a separate nonzero agent address and at least one scope.":
    "请使用独立且非零的智能体地址，并选择至少一项权限。",
  "Slippage must be 0.01%–5%.": "滑点必须在 0.01% 至 5% 之间。",
  "Quote must return a positive amount.":
    "报价必须返回大于零的金额，请重新获取报价。",
  "Amount is outside uint128.": "金额超出 uint128 范围，请减小金额。",
  "Input is outside the attested pool.":
    "输入代币不属于已证明的资金池，请检查代币选择。",
  "Enter slippage with at most two decimals.": "请输入最多两位小数的滑点。",
  "Constitution could not be loaded.": "无法加载章程，请刷新重试。",
  "RPC must use HTTP(S).": "RPC 地址必须使用 HTTP 或 HTTPS。",
  "Model URL must be HTTPS or local HTTP.":
    "模型地址必须使用 HTTPS 或本地 HTTP。",
  "Enter the model name and your local agent key file path. Never enter the key itself.":
    "请输入模型名称及本地智能体密钥文件路径，切勿输入密钥本身。",
  "Fee limits must be positive integers in wei.":
    "费用上限必须为以 wei 为单位的正整数。",
  "Priority fee must not exceed the fee cap.": "优先费不得超过费用上限。",
  "Gas limit must be 21,000–16,000,000.":
    "Gas 上限必须在 21,000 至 16,000,000 之间。",
  "Voting also needs comment permission to publish rationale.":
    "投票还需要评论权限，以发布投票理由。",
  "Governance requires feedback permission.": "治理操作需要反馈权限。",
  "Load current chain state first.": "请先读取当前链上状态。",
};
const patterns: [RegExp, (match: RegExpMatchArray) => string][] = [
  [
    /^Value exceeds uint(\d+)\.$/,
    (m) => `数值超出 uint${m[1]} 范围，请减小数值。`,
  ],
  [
    /^Use at most (\d+) decimal places\.$/,
    (m) => `请最多使用 ${m[1]} 位小数。`,
  ],
  [
    /^Text must contain 1–(\d+) UTF-8 bytes\.$/,
    (m) => `文本必须包含 1 至 ${m[1]} 个 UTF-8 字节。`,
  ],
  [/^Expected (\d+) bytes\.$/, (m) => `请输入 ${m[1]} 个字节。`],
  [/^(.+): expected an array\.$/, (m) => `${m[1]}：请输入数组。`],
  [
    /^(.+) has no code on the configured chain\.$/,
    (m) => `${m[1]} 在配置的链上没有代码，请检查网络及配置。`,
  ],
  [
    /^(.+) dependency mismatch\.$/,
    (m) => `${m[1]} 的依赖合约不符，请检查部署配置。`,
  ],
  [
    /^(.+): no deployed code$/,
    (m) => `${m[1]} 没有已部署代码，请检查网络及配置。`,
  ],
  [
    /^Confirmed receipt did not include (.+)\. Refresh onchain state\.$/,
    (m) => `已确认收据不包含 ${m[1]}，请刷新链上状态。`,
  ],
  [
    /^This seat already has live proposal #(\d+)\. Inspect it before opening another\.$/,
    (m) => `此席位已有进行中的提案 #${m[1]}，请先查看该提案。`,
  ],
];
export function chineseRecovery(text: string): string | undefined {
  if (chinese[text]) return chinese[text];
  for (const [pattern, translate] of patterns) {
    const match = text.match(pattern);
    if (match) return translate(match);
  }
}
