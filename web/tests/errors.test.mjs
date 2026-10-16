import test from "node:test";
import assert from "node:assert/strict";
import { BaseError, ContractFunctionRevertedError, encodeErrorResult, parseAbi } from "viem";
import {
  uint,
  address,
  amount,
  hash,
  hex,
  boundedText,
  message,
  errorPresentation,
} from "../src/lib.ts";
import { parseArgument } from "../src/abi-input.ts";
import { slippageBasisPoints } from "../src/swap-core.ts";
const failure = (action) => {
  try {
    action();
    assert.fail("Expected validation to reject input");
  } catch (e) {
    return e;
  }
};

test("invalid seat validation follows locale and retains existing English recovery", () => {
  const error = failure(() => uint("abc"));
  assert.equal(message(error, "zh"), "请输入非负整数。");
  assert.equal(message(error, "en"), "Enter a non-negative whole number.");
});
test("shared form validators provide Chinese recovery with exact numeric limits", () => {
  const cases = [
    [() => uint(String(2n ** 64n), 64), /uint64/],
    [() => address("invalid"), /有效的 EVM 地址/],
    [() => amount("1.001", 2), /2 位小数/],
    [() => amount("0", 18), /大于零/],
    [() => hash("0x1"), /32 字节哈希/],
    [() => hex("0x1"), /完整十六进制字节/],
    [() => boundedText("字".repeat(4), 8), /1 至 8 个 UTF-8 字节/],
    [() => parseArgument({ type: "bytes4" }, "0x00"), /4 个字节/],
    [() => parseArgument({ type: "bool" }, "yes"), /true 或 false/],
    [
      () => parseArgument({ type: "uint256[]", name: "seats" }, "{}"),
      /seats：请输入数组/,
    ],
    [() => slippageBasisPoints("5.01"), /0.01% 至 5%/],
  ];
  for (const [action, expected] of cases) {
    const e = failure(action);
    assert.match(message(e, "zh"), expected);
    assert.notEqual(message(e, "en"), message(e, "zh"));
    assert.equal(errorPresentation(e, "zh").details, undefined);
  }
});
test("wallet rejection recovery is localized without claiming success", () => {
  for (const e of [{ code: 4001 }, new Error("User rejected transaction")]) {
    assert.equal(
      message(e, "zh"),
      "钱包中已拒绝请求，未确认任何操作。您可以重试。",
    );
    assert.match(message(e, "en"), /Nothing was confirmed/);
  }
});
test("nested ABI contract errors retain actionable Chinese recovery", () => {
  const abi = parseAbi([
    "error FeedbackWrongHour()",
    "error AdmissionNotConfigured()",
    "error Error(string reason)",
  ]);
  for (const [errorName, args, expected] of [
    ["FeedbackWrongHour", undefined, "小时已更替，请重新准备反馈。"],
    ["AdmissionNotConfigured", undefined, "加入前，Safe 必须先配置准入。"],
    ["Error", ["FeedbackWrongHour"], "小时已更替，请重新准备反馈。"],
  ]) {
    const e = new BaseError("Simulation failed", {
      cause: new ContractFunctionRevertedError({
        abi,
        functionName: "recordFeedback",
        data: encodeErrorResult({ abi, errorName, args }),
      }),
    });
    assert.equal(message(e, "zh"), expected);
  }
});
test("unrecognized diagnostics remain separate from the Chinese recovery summary", () => {
  const e = new Error("Fixture provider failure: upstream -32000");
  const result = errorPresentation(e, "zh");
  assert.match(result.summary, /请求失败/);
  assert(!result.summary.includes("upstream"));
  assert.equal(result.details, e.message);
  assert.equal(message(e, "en"), e.message);
});
test("malformed JSON has Chinese recovery and retains its parser diagnostic", () => {
  const error = failure(() =>
    parseArgument({ type: "uint256[]", name: "seats" }, "["),
  );
  assert.match(message(error, "zh"), /JSON/);
  assert.equal(errorPresentation(error, "zh").details, error.message);
});
