import type { AbiParameter } from "viem";
import { address, uint, hash, hex } from "./lib.ts";
export function parseArgument(param: AbiParameter, value: unknown): any {
  const type = param.type;
  if (type.endsWith("[]")) {
    const array = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(array)) throw Error(`${param.name}: expected an array.`);
    return array.map((v) =>
      parseArgument({ ...param, type: type.slice(0, -2) } as AbiParameter, v),
    );
  }
  if (type === "tuple") {
    const v = typeof value === "string" ? JSON.parse(value) : value;
    const parts = (param as AbiParameter & { components: AbiParameter[] })
      .components;
    return Object.fromEntries(
      parts.map((p, i) => [
        p.name ?? String(i),
        parseArgument(p, Array.isArray(v) ? v[i] : (v as any)?.[p.name!]),
      ]),
    );
  }
  const s = String(value ?? "").trim();
  if (type === "address") return address(s);
  if (type.startsWith("uint")) return uint(s, Number(type.slice(4) || 256));
  if (type.startsWith("int")) {
    if (!/^-?\d+$/.test(s)) throw Error("Expected a signed integer.");
    const n = BigInt(s),
      bits = BigInt(type.slice(3) || 256);
    if (n < -(2n ** (bits - 1n)) || n >= 2n ** (bits - 1n))
      throw Error("Signed integer exceeds its range.");
    return n;
  }
  if (type === "bool") {
    if (s !== "true" && s !== "false") throw Error("Use true or false.");
    return s === "true";
  }
  if (type === "bytes32") return hash(s);
  if (type.startsWith("bytes")) {
    const result = hex(s),
      size = Number(type.slice(5));
    if (size && (result.length - 2) / 2 !== size)
      throw Error(`Expected ${size} bytes.`);
    return result;
  }
  return String(value ?? "");
}
