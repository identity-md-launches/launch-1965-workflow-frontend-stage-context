import {
  encodeAbiParameters,
  parseAbiParameters,
  parseAbi,
  keccak256,
  type Address,
  type Hex,
} from "viem";
export const quoterAbi = parseAbi([
  "function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)",
]);
export const routerAbi = parseAbi([
  "function execute(bytes commands,bytes[] inputs,uint256 deadline) payable",
]);
export const permitAbi = parseAbi([
  "function allowance(address owner,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)",
  "function approve(address token,address spender,uint160 amount,uint48 expiration)",
]);
export const stateAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)",
]);
export type PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};
const keyTuple =
  "(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)";
export const poolId = (key: PoolKey) =>
  keccak256(encodeAbiParameters(parseAbiParameters(keyTuple), [key]));
export function minimumOutput(quoted: bigint, slippageBps: number) {
  if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 500)
    throw Error("Slippage must be 0.01%–5%.");
  if (quoted <= 0n) throw Error("Quote must return a positive amount.");
  return (quoted * BigInt(10000 - slippageBps)) / 10000n;
}
export function encodeSwap(
  key: PoolKey,
  input: Address,
  amount: bigint,
  min: bigint,
  extended = false,
) {
  if (amount <= 0n || amount >= 2n ** 128n)
    throw Error("Amount is outside uint128.");
  const zeroForOne = input.toLowerCase() === key.currency0.toLowerCase();
  if (!zeroForOne && input.toLowerCase() !== key.currency1.toLowerCase())
    throw Error("Input is outside the attested pool.");
  const output = zeroForOne ? key.currency1 : key.currency0;
  const first = encodeAbiParameters(
    parseAbiParameters(
      `(${keyTuple} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,${extended ? "uint256 minHopPriceX36," : ""}bytes hookData)`,
    ),
    [
      {
        poolKey: key,
        zeroForOne,
        amountIn: amount,
        amountOutMinimum: min,
        ...(extended ? { minHopPriceX36: 0n } : {}),
        hookData: "0x",
      },
    ],
  );
  const settle = encodeAbiParameters(parseAbiParameters("address,uint256"), [
      input,
      amount,
    ]),
    take = encodeAbiParameters(parseAbiParameters("address,uint256"), [
      output,
      min,
    ]);
  return {
    commands: "0x10" as Hex,
    inputs: [
      encodeAbiParameters(parseAbiParameters("bytes,bytes[]"), [
        "0x060c0f",
        [first, settle, take],
      ]),
    ],
    output,
  };
}

export function slippageBasisPoints(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw Error("Enter slippage with at most two decimals.");
  const [whole, part = ""] = value.split(".");
  const bps = Number(whole) * 100 + Number(part.padEnd(2, "0"));
  if (bps < 1 || bps > 500) throw Error("Slippage must be 0.01%–5%.");
  return bps;
}
