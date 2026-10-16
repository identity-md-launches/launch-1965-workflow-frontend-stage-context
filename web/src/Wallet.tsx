import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { getAddress } from "viem";
import {
  Dialog,
  ErrorNote,
  useLocale,
  useRuntime,
  AddressView,
} from "./context";
import { short } from "./lib";
import { OPEN_IN } from "./wallet-links";
export function Wallet() {
  const rt = useRuntime(),
    { t } = useLocale(),
    account = useAccount(),
    { connectors, connectAsync, isPending, variables } = useConnect(),
    { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false),
    [error, setError] = useState<unknown>(),
    [switching, setSwitching] = useState(false);
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !(window as any).ethereum;
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  async function switchChain(connector = account.connector) {
    if (!connector) return;
    setSwitching(true);
    setError(undefined);
    try {
      const provider = (await connector.getProvider()) as {
        request: (p: object) => Promise<unknown>;
      };
      const params = {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${rt.manifest.chainId.toString(16)}` }],
      };
      try {
        await provider.request(params);
      } catch (e) {
        const err = e as {
          code?: number;
          message?: string;
          data?: { originalError?: { code?: number } };
        };
        if (
          (err.code === 4902 ||
            err.data?.originalError?.code === 4902 ||
            /unknown chain|unrecognized chain|not added/i.test(
              err.message ?? "",
            )) &&
          rt.manifest.walletAddChain
        ) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [rt.manifest.walletAddChain],
          });
          await provider.request(params);
        } else throw e;
      }
    } catch (e) {
      setError(e);
      setOpen(true);
    } finally {
      setSwitching(false);
    }
  }
  const wrong = account.isConnected && account.chainId !== rt.manifest.chainId;
  return (
    <>
      <button
        className={
          !account.isConnected ? "primary wallet-control" : "wallet-control"
        }
        onClick={() => (wrong ? switchChain() : setOpen(true))}
        disabled={switching}
      >
        {switching
          ? t("Switching…", "正在切换…")
          : wrong
            ? t(
                `Switch to ${rt.manifest.network.name}`,
                `切换到 ${rt.manifest.network.name}`,
              )
            : account.address
              ? short(getAddress(account.address))
              : t("Connect wallet", "连接钱包")}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={
          account.isConnected
            ? t("Connected wallet", "已连接钱包")
            : t("Connect a wallet", "连接钱包")
        }
      >
        <ErrorNote error={error} />
        {account.address ? (
          <>
            <AddressView value={account.address} />
            <p>
              {t("Your keys stay in your wallet.", "密钥保留在您的钱包中。")}
            </p>
            {wrong && (
              <button onClick={() => switchChain()}>
                {t("Switch network", "切换网络")}
              </button>
            )}
            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
            >
              {t("Disconnect", "断开连接")}
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              {t(
                "Choose a browser wallet or a passkey wallet.",
                "选择浏览器钱包或通行密钥钱包。",
              )}
            </p>
            {mobile &&
              OPEN_IN.map((w) => (
                <a
                  className="wallet-row"
                  key={w.id}
                  href={w.href(location.href)}
                >
                  <img
                    src={`./wallets/${w.id}.svg`}
                    width="28"
                    height="28"
                    alt=""
                  />
                  {t("Open in ", "打开 ") + w.name}
                </a>
              ))}
            {[
              ...connectors.filter((c) => c.type === "injected"),
              ...connectors.filter((c) => c.type !== "injected"),
            ]
              .filter(
                (c) =>
                  !(c.id === "injected" && named) &&
                  (!mobile || c.type !== "injected"),
              )
              .map((c) => (
                <button
                  className="wallet-row"
                  key={c.uid}
                  disabled={isPending}
                  onClick={async () => {
                    setError(undefined);
                    try {
                      const result = await connectAsync({ connector: c });
                      setOpen(false);
                      if (result.chainId !== rt.manifest.chainId)
                        await switchChain(c);
                    } catch (e) {
                      setError(e);
                    }
                  }}
                >
                  <img
                    width="28"
                    height="28"
                    alt=""
                    src={
                      c.icon ??
                      (c.id === "coinbaseWalletSDK"
                        ? "./wallets/coinbase.svg"
                        : "./wallets/browser.svg")
                    }
                  />
                  <span>
                    {c.id === "injected"
                      ? t("Browser wallet", "浏览器钱包")
                      : c.id === "coinbaseWalletSDK"
                        ? mobile
                          ? "Coinbase Smart Wallet"
                          : "Coinbase Wallet"
                        : c.name}
                    {isPending && variables?.connector === c
                      ? t(" · opening…", " · 正在打开…")
                      : ""}
                  </span>
                </button>
              ))}
            {!named && !mobile && (
              <p className="muted">
                {t(
                  "No extension detected? Install a wallet, or use Coinbase Smart Wallet.",
                  "未检测到扩展？安装钱包，或使用 Coinbase 智能钱包。",
                )}
              </p>
            )}
          </>
        )}
      </Dialog>
    </>
  );
}
