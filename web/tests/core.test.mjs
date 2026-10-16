import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  decodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toHex,
} from "viem";
import {
  amount,
  uint,
  address,
  hash,
  boundedText,
  executionReady,
  message,
} from "../src/lib.ts";
import {
  encodeSwap,
  minimumOutput,
  slippageBasisPoints,
  poolId,
} from "../src/swap-core.ts";
import { parseArgument } from "../src/abi-input.ts";
const h = JSON.parse(
    await readFile(
      new URL("../deployment-input.json", import.meta.url),
      "utf8",
    ),
  ),
  key = h.poolKey;
test("strict human token units reject precision loss, zero and scientific notation", () => {
  assert.equal(amount("1.000000000000000001", 18), 1000000000000000001n);
  for (const x of ["0", "-1", "1e3", "1.0000001", "Infinity"])
    assert.throws(() => amount(x, 6));
});
test("uint and address input validation reject overflow and unknown destinations", () => {
  assert.equal(uint("18446744073709551615", 64), 2n ** 64n - 1n);
  assert.throws(() => uint("18446744073709551616", 64));
  assert.throws(() => address(""));
  assert.throws(() => hash("0x123"));
  assert.throws(() => uint("-1"));
});
test("messages are limited by UTF-8 bytes, including Chinese", () => {
  assert.equal(boundedText("字".repeat(682)).length, 682);
  assert.throws(() => boundedText("字".repeat(683)));
  assert.throws(() => boundedText(""));
});
test("slippage preserves exact basis points and rounds minimum output down", () => {
  assert.equal(slippageBasisPoints("0.29"), 29);
  assert.equal(slippageBasisPoints("0.01"), 1);
  assert.equal(minimumOutput(10001n, 50), 9950n);
  for (const value of ["0", "5.01", "0.001", "NaN"])
    assert.throws(() => slippageBasisPoints(value));
});
for (const extended of [false, true])
  for (const input of [key.currency0, key.currency1])
    test(`swap encoding matches v4 router; extended=${extended}, direction=${input}`, () => {
      const result = encodeSwap(key, input, 1000n, 900n, extended);
      assert.equal(result.commands, "0x10");
      const [actions, params] = decodeAbiParameters(
        parseAbiParameters("bytes,bytes[]"),
        result.inputs[0],
      );
      assert.equal(actions, "0x060c0f");
      const schema = `((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,${extended ? "uint256 minHopPriceX36," : ""}bytes hookData)`;
      const [swap] = decodeAbiParameters(parseAbiParameters(schema), params[0]);
      assert.equal(swap.poolKey.hooks.toLowerCase(), key.hooks);
      assert.equal(swap.poolKey.fee, key.fee);
      assert.equal(swap.poolKey.tickSpacing, key.tickSpacing);
      assert.equal(swap.zeroForOne, input === key.currency0);
      assert.equal(swap.amountOutMinimum, 900n);
      assert.equal(swap.hookData, "0x");
      if (extended) assert.equal(swap.minHopPriceX36, 0n);
      const [currency, settle] = decodeAbiParameters(
        parseAbiParameters("address,uint256"),
        params[1],
      );
      assert.equal(currency.toLowerCase(), input);
      assert.equal(settle, 1000n);
      const [output, min] = decodeAbiParameters(
        parseAbiParameters("address,uint256"),
        params[2],
      );
      assert.equal(
        output.toLowerCase(),
        input === key.currency0 ? key.currency1 : key.currency0,
      );
      assert.equal(min, 900n);
    });
test("swap never accepts an input outside the attested pool or a uint128 overflow", () => {
  assert.throws(() => encodeSwap(key, h.contracts[1].address, 1n, 1n));
  assert.throws(() => encodeSwap(key, key.currency0, 2n ** 128n, 1n));
  assert.match(poolId(key), /^0x[0-9a-f]{64}$/);
});
test("execution respects vote, timelock, work, bootstrap and exact expiry boundaries", () => {
  const p = {
    executed: false,
    end: 100n,
    executableAt: 200n,
    expires: 300n,
    kind: 1,
  };
  assert.equal(executionReady(p, 199n, true, true, true), false);
  assert.equal(executionReady(p, 200n, true, true, true), true);
  assert.equal(executionReady(p, 300n, true, true, true), true);
  assert.equal(executionReady(p, 301n, true, true, true), false);
  for (const args of [
    [false, true, true],
    [true, false, true],
    [true, true, false],
  ])
    assert.equal(executionReady(p, 220n, ...args), false);
  assert.equal(
    executionReady({ ...p, kind: 2 }, 220n, true, true, false),
    true,
  );
  assert.equal(
    executionReady({ ...p, executed: true }, 220n, true, true, true),
    false,
  );
});
test("ABI forms handle exact tuple arrays and reject malformed values", () => {
  const p = {
    type: "tuple[]",
    name: "calls",
    components: [
      { type: "address", name: "target" },
      { type: "uint256", name: "value" },
      { type: "bytes", name: "data" },
    ],
  };
  const result = parseArgument(
    p,
    JSON.stringify([{ target: key.hooks, value: "123", data: "0x0102" }]),
  );
  assert.equal(result[0].value, 123n);
  assert.equal(result[0].target.toLowerCase(), key.hooks);
  assert.throws(() => parseArgument({ type: "bool" }, "yes"));
  assert.throws(() => parseArgument({ type: "bytes4" }, "0x01"));
  assert.throws(() => parseArgument({ type: "int8" }, "128"));
});
test("wallet rejection is actionable and does not claim success", () => {
  assert.match(message({ code: 4001 }), /declined/);
  assert.match(message({ code: 4001 }), /Nothing was confirmed/);
});
