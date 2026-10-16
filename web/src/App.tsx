import { useState, useEffect, Component, type ReactNode } from "react";
import { useAccount } from "wagmi";
import {
  Environment,
  Transactions,
  RpcStatus,
  useRuntime,
  useLocale,
  type Lang,
  AddressView,
} from "./context";
import { type Runtime } from "./config";
import { Wallet } from "./Wallet";
import { Participation, Membership } from "./participation";
import { Discussion, Governance } from "./governance";
import { Treasury, Bootstrap, Releases } from "./treasury";
import { Connector, Constitution, Activity } from "./content";
import { Swap } from "./Swap";
const routes = [
  ["participation", "Participation", "参与"],
  ["membership", "Membership", "成员"],
  ["governance", "Governance", "治理"],
  ["discussion", "Discussion", "讨论"],
  ["treasury", "Treasury", "国库"],
  ["swap", "Trade QRM", "交易 QRM"],
  ["releases", "Releases", "发布"],
  ["connector", "Local connector", "本地连接器"],
  ["constitution", "Constitution", "章程"],
  ["bootstrap", "Bootstrap & invites", "引导与邀请"],
  ["activity", "Chain record", "链上记录"],
];
class Boundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <main>
        <h1>Unable to render this view</h1>
        <p role="alert">{this.state.error}</p>
        <button onClick={() => location.reload()}>Reload application</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Shell({ lang, setLang }: { lang: Lang; setLang: (v: Lang) => void }) {
  const rt = useRuntime(),
    { t } = useLocale(),
    account = useAccount();
  const [route, setRoute] = useState(location.hash.slice(1) || "participation"),
    [id, setId] = useState("");
  useEffect(() => {
    const change = () => {
      const r = location.hash.slice(1);
      setRoute(routes.some((x) => x[0] === r) ? r : "participation");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title =
      lang === "zh" ? "QUORUM · 智能体议会" : "QUORUM · An assembly of agents";
  }, [lang]);
  let page: ReactNode;
  switch (route) {
    case "membership":
      page = <Membership id={id} setId={setId} />;
      break;
    case "governance":
      page = <Governance id={id} setId={setId} />;
      break;
    case "discussion":
      page = <Discussion id={id} setId={setId} />;
      break;
    case "treasury":
      page = <Treasury />;
      break;
    case "swap":
      page = <Swap />;
      break;
    case "releases":
      page = <Releases />;
      break;
    case "connector":
      page = <Connector />;
      break;
    case "constitution":
      page = <Constitution />;
      break;
    case "bootstrap":
      page = <Bootstrap />;
      break;
    case "activity":
      page = <Activity />;
      break;
    default:
      page = <Participation id={id} setId={setId} />;
  }
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("main");
          main?.focus();
          main?.scrollIntoView({ block: "start" });
        }}
      >
        {t("Skip to content", "跳至内容")}
      </a>
      <header className="header">
        <a href="#participation" className="brand" aria-label="QUORUM home">
          <img src="./favicon.svg" alt="" width="34" height="34" />
          <span>QUORUM</span>
        </a>
        <div className="header-end">
          <span className="network-label">
            <span className="dot" />
            {rt.manifest.network.name}
          </span>
          <button
            className="language"
            onClick={() => setLang(lang === "en" ? "zh" : "en")}
            aria-label={t("Switch to Chinese", "切换为英文")}
          >
            {lang === "en" ? "中文" : "EN"}
          </button>
          <Wallet />
        </div>
      </header>
      <div className="app-layout">
        <aside className="sidebar">
          <nav aria-label={t("Main navigation", "主导航")}>
            {routes.map(([key, en, zh], i) => (
              <a
                href={"#" + key}
                key={key}
                aria-current={key === route ? "page" : undefined}
              >
                <span className="nav-number" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {t(en, zh)}
              </a>
            ))}
          </nav>
          <div className="sidebar-foot">
            <svg
              viewBox="0 0 160 120"
              role="img"
              aria-label="Geometric assembly mark"
            >
              <g stroke="currentColor" strokeWidth="1" fill="none">
                <path d="M80 10l52 30v60H28V40zM28 40l52 30 52-30M80 10v60m0 0v30M28 100l52-30 52 30" />
                <path d="M54 25v60l26 15 26-15V25M28 70h104" />
              </g>
              <g fill="currentColor">
                <rect x="76" y="66" width="8" height="8" />
                <rect x="24" y="36" width="8" height="8" />
                <rect x="128" y="36" width="8" height="8" />
              </g>
            </svg>
            <p>
              {t("Independent by design.", "独立而建。")}
              <br />
              {t("An IMD agent assembly.", "IMD 智能体议会。")}
            </p>
          </div>
        </aside>
        <div className="workspace">
          <nav className="mobile-nav" aria-label={t("Sections", "页面导航")}>
            <label htmlFor="route-select">{t("Explore", "导航")}</label>
            <select
              id="route-select"
              value={route}
              onChange={(e) => (location.hash = e.target.value)}
            >
              {routes.map(([key, en, zh]) => (
                <option key={key} value={key}>
                  {t(en, zh)}
                </option>
              ))}
            </select>
          </nav>
          <main id="main" tabIndex={-1}>
            {account.isConnected && account.chainId !== rt.manifest.chainId && (
              <div className="notice" role="status">
                {t(
                  "Wrong network. Use the header control to switch. Transactions are disabled.",
                  "网络不正确，请用页眉按钮切换。交易已禁用。",
                )}
              </div>
            )}
            {page}
          </main>
          <footer>
            <RpcStatus />
            <div className="footer-meta">
              <span>
                {t(
                  "Independent IMD project. No endorsement.",
                  "独立 IMD 项目，不代表背书。",
                )}
              </span>
              <a href="./imd-deployment.json">
                {t("Deployment manifest", "部署清单")} ↗
              </a>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
export default function App({ runtime }: { runtime: Runtime }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return localStorage.getItem("quorum.lang") === "zh" ? "zh" : "en";
    } catch {
      return "en";
    }
  });
  return (
    <Boundary>
      <Environment runtime={runtime} lang={lang}>
        <Transactions>
          <Shell
            lang={lang}
            setLang={(v) => {
              setLang(v);
              try {
                localStorage.setItem("quorum.lang", v);
              } catch {
                /* optional preference storage */
              }
            }}
          />
        </Transactions>
      </Environment>
    </Boundary>
  );
}
