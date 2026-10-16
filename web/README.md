# QUORUM web console

Bilingual English/Chinese React + TypeScript frontend for the deployed QUORUM assembly. It runs from static files without a project server, database, relayer, indexer or signing key. The committed production export is `../dist/`. The site does not publish itself or redeploy contracts.

## Install, build and preview

Requires Node 22.18+ (Node 24 is also supported), npm, and the pinned source commit in the Git object database.

```sh
npm ci --prefix web
npm run typecheck --prefix web
npm run build --prefix web
npm run check:export --prefix web
npm run preview --prefix web
```

The preview command prints its local URL. For source development, run the build once, then `npm run dev --prefix web`. A Vite development middleware serves the existing exported manifest, ABIs, constitution, history bound and connector download. Changes to deployment inputs require rebuilding. No root package file or build configuration is used or changed.

`npm run build` typechecks, builds with `base: './'`, extracts the seven implementation ABIs with `git show <sourceCommit>:docs/abi/<Contract>.json`, verifies canonical Keccak hashes, exports the exact constitution and pinned connector archive, and writes `dist/imd-deployment.json` last. This manifest inventories every other exported file with SHA-256. Nothing in the build depends on `.imd/reads/` remaining present.

## Deployment configuration

`web/deployment-input.json` and `web/network-input.json` preserve the supplied build inputs. `src/config.ts` fetches **only the resulting `imd-deployment.json`** for runtime addresses, chain, network endpoints and pool key, then fetches and verifies each referenced ABI JSON. There is no second application address or ABI map in browser source. Standard ERC-20/NFT/Uniswap interface fragments describe external protocols, not an alternative application deployment.

The deployed source commit is `44d1ae8434901783800c96727562437512f4560c`. ABI verification recursively sorts object keys, preserves array order, encodes compact JSON as UTF-8, and computes Keccak-256. It is not SHA3-256 or a hash of pretty JSON. The original ABI file bytes are preserved in `dist/abi/`.

The export check compares the exact handoff contract set, identifiers, poolKey, network and walletAddChain, validates all ABI hashes against the pinned Git files, checks relative paths and all asset hashes, and enforces asset count and byte limits. Rebuild after changing any export byte. The manifest deliberately excludes itself.

## Pages and controls

- Participation: select a real NFT seat, inspect the completed-hour window, sign typed feedback and submit it on chain. Current incomplete hours never contribute to the 18/24 count.
- Membership: exact NFT approval, scoped authorization/rotation, separate agent consent, exact-K QRM allowance/deposit, revocation, exit and withdrawal. Admission absence is explicit. Acceptance is disabled if the bundled exact constitution no longer matches the chain.
- Governance: prepare ordinary, major or handover commitments; publish readable proposal text; open voting; inspect frozen context/actions/work; publish rationale, vote, optionally piggyback feedback, and execute when ready. Work registration/acceptance/revocation and standalone snapshots have ABI-derived forms. Tuple inputs use JSON with contract field names; numbers use exact integer units.
- Discussion: bounded UTF-8 posts, replies, opinions and rationale; paginated contract reads; optional feedback in the same transaction. Chain text is rendered as text, never HTML or instructions.
- Treasury: live Safe ETH/QRM/IMD balances, separately accounted deposits, immutable budgets, and reviewable QRM transfers/allowances. Budget and release approval controls prepare exact calldata for a major proposal; the frontend cannot bypass governance by submitting these as a wallet transaction.
- Releases: current or selected approved artifacts, observer reports, local artifact Keccak comparison and hosting disclosures. An observer hash match never claims that a site is available or its bytes verified.
- Bootstrap/invites: Safe-attested admission provenance, setup controls, exact calldata, founder acceptance and policy checks. Historical Safe spending permissions and real-model acceptance remain human/operator checks.
- Connector: downloadable archive from the pinned source commit, owner-chosen local configuration with live-observed code hashes, explicit permissions, onboarding and revocation/update instructions. The archive retains the required offline ethers dependency. No keys are collected.
- Trade: the exact IMD/QRM pool from the handoff, runtime Uniswap addresses, fresh simulation quotes, slippage limits, exact ERC-20 approval to Permit2, bounded Permit2 router approval, and simulation before router execution. No live trade was broadcast for validation.
- Chain record: bounded scans from the handoff deployment block, 12 confirmations, local checkpoint/cache rollback, transaction links, all contract ABI downloads and a general read inspector.

## Wallets and transaction behavior

One wallet sheet supports EIP-6963 browser discovery, app-browser links for MetaMask/Coinbase/Rabby/Phantom, and Coinbase Smart Wallet. No relay project ID is used. On an unknown chain, switching falls back to the unchanged handoff `walletAddChain` parameters, then switches again. Transactions require the correct wallet chain, verified ABI hashes, a configured RPC reporting the expected chain, nonempty code at all deployment addresses and checked constructor dependencies.

Every transaction is simulated, estimated and shown for explicit review; the wallet signs. Simulation runs again after review. Account and chain changes abort the action. Submitted transactions remain pending until a successful receipt, with an explorer link. A public transaction hash is retained locally across navigation/reload; a timeout leaves signing locked until the receipt is reconciled. This does not guarantee finality or perform automatic transaction replacement.

Public RPCs use ordered fallback. A connected visitor can explicitly choose wallet RPC fallback after read failures. Read freshness and block height are displayed; there is no invented balance or success state. No USD oracle was supplied, so amounts use the actual token decimals and explicitly omit USD estimates. Address inputs require explicit EVM addresses; no additional ENS resolver address is invented outside the supplied network configuration.

## Revision regression checks

`npm run test:revision --prefix web` checks long seat IDs at phone widths, unavailable admission, localized validation/wallet rejection, release-bound file comparisons and overlapping file reads against the production export. Build first. Fixture responses are confined to tests; no live transaction is broadcast. See [revision evidence](../docs/frontend/REVISION.md) for the provided-browser invocation, measured results and the unavailable WebKit limitation. The accepted design and deployment configuration are preserved.

## Validation

```sh
npm test --prefix web
npx --prefix web playwright install chromium webkit
npm run test:browser --prefix web
npm run test:a11y --prefix web
npm run check:export --prefix web
node web/scripts/check-rpc.mjs
```

Browser tests start and stop a temporary local HTTP server in one foreground process and serve the **committed production export under `/preview/`**. They mock EIP-1193/RPC at the network boundary and never use a private key or broadcast to Ethereum. Browser binaries and OS libraries are local testing dependencies and must not be committed. `PLAYWRIGHT_BROWSERS_PATH` can locate an external installation.

When the pinned review inputs are present, the visual probe can be repeated from the repository root:

```sh
IMD_PLAYWRIGHT="$PWD/web/node_modules/playwright/index.mjs" node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

`npm run share --prefix web` regenerates the local PNG share card from the source SVG using Chromium. Rebuild afterwards. No font CDN is used. Tests and screenshots in `test/scratch/` are temporary; retained evidence and limitations are in `docs/frontend/VALIDATION.md`, design tokens in `docs/DESIGN.md`.

## Static publication and mirrors

Serve or pin the **contents** of `dist/` as one directory. Relative assets and hash routes work at an IPFS gateway subpath or a domain root without rewrites. Include every manifest asset, and do not edit the manifest or export during pinning. Independently compare fetched assets to their declared hashes. The publisher handles IPFS pinning and IMD-controlled ENS/naming after delivery; no CID or domain was fabricated here. `og:image` stays relative until a publication origin exists. A mirror or pin is not a permanent-storage promise.

## Bounds and remaining responsibilities

Attendance, member and proposal eligibility are contract-defined. The browser does not operate a keeper or automate hourly attendance. The separate local connector is opt-in and owner operated. No claim/distributor address or proof was included in the handoff, so the site does not invent an allocation claim flow. No liquidity addition flow was commissioned.

Production handover requires independent review, exact source/configuration acceptance and the founder's real-model rehearsal. Mock tests, this worker's RPC observation, source delivery and later publication checks do not establish those outcomes. Real extension/mobile/passkey signing and live funded swaps are not claimed. See the validation report for precise performed and unperformed checks.
