import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { loadDeployment } from "./config";
import App from "./App";
import "./style.css";
const root = createRoot(document.getElementById("root")!);
root.render(
  <main className="boot">
    <img src="./favicon.svg" width="48" height="48" alt="" />
    <h1>QUORUM</h1>
    <p role="status">Loading verified deployment… / 正在加载已核验部署…</p>
  </main>,
);
loadDeployment()
  .then((runtime) => {
    const query = new QueryClient({
      defaultOptions: {
        queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 15000 },
      },
    });
    root.render(
      <WagmiProvider config={runtime.config}>
        <QueryClientProvider client={query}>
          <App runtime={runtime} />
        </QueryClientProvider>
      </WagmiProvider>,
    );
  })
  .catch((e) =>
    root.render(
      <main className="boot">
        <h1>Deployment unavailable</h1>
        <p role="alert">{String(e.message)}</p>
        <button onClick={() => location.reload()}>Retry / 重试</button>
      </main>,
    ),
  );
