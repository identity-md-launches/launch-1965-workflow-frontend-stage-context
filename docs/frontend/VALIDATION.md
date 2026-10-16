# Frontend validation

This is worker-produced evidence for the QUORUM frontend, not independent certification, founder acceptance or a publication attestation. Validation took place on 2026-10-16. No private key was used and no live transaction was broadcast.

## Delivered scope

Vite/React/TypeScript source, pinned npm lockfile and frontend build scripts are under `web/`; the complete relative-base static export is under `dist/`. Documentation and retained evidence are under `docs/`. Deployed Solidity, root build configuration, existing connector source and existing ABI exports were not changed. `web/.gitignore` is the explicitly allowed ignore file and excludes dependency/cache directories at every nesting level.

The assignment simultaneously requests a root `DESIGN.md` and forbids writes outside its explicit path budget. The narrower write restriction takes precedence: the design document is delivered as [`docs/DESIGN.md`](../DESIGN.md). It contains the implemented tokens, typography, components, responsive behavior and usage rules.

## Build and integrity checks

Run from the repository root:

```sh
npm ci --prefix web
npm run typecheck --prefix web
npm run build --prefix web
npm test --prefix web
npm run check:export --prefix web
```

Dependencies were installed on the worker using the npm registry. Installation is not needed to serve the export. Build and standalone typecheck passed. Twelve unit tests passed with no failures. The retained command summary in `checks.json` identifies the final manifest digest and export size.

The build extracts all seven ABI JSON arrays from deployed source commit `44d1ae8434901783800c96727562437512f4560c` using Git, verifies the handoff's canonical Keccak-256 hashes, and preserves the original ABI file bytes. Build inputs in `web/deployment-input.json` and `web/network-input.json` were byte-compared with the supplied pinned handoffs. The export checker verifies the exact launch, chain, source and attestation identifiers; complete contract set; pool key; unchanged network/add-chain objects; allowed top-level keys; relative paths; asset inventory; ABI hashes; and every asset SHA-256.

`imd-deployment.json` is written after the static export and excludes itself from its asset list. It is the configuration fetched by the app at runtime. The app also fetches and verifies the referenced ABI arrays before enabling wallet controls. There is no independently maintained application address/ABI map. All swap protocol targets come from the manifest's network block.

The required downloadable connector archive is generated from the pinned source commit and retains its offline ethers runtime. It is not an npm registry or a dependency cache. Frontend node_modules, browser binaries, OS libraries and test caches are not deliverables.

## Interaction checks

`web/tests/browser.mjs` serves the production export under `/preview/`, uses a named EIP-6963/EIP-1193 fixture and intercepts RPC at the network boundary. It tests actual rendered controls and ABI-encoded requests. Fixture accounts and simulated receipts exist only in test code and are not bundled into the site. See [`browser-results.json`](browser-results.json).

Nineteen grouped checks passed:

- The 390 × 844 first screen contains the product, wallet control, attendance state and feedback button. The feedback button starts at y=714.94 and ends at y=759.33 CSS pixels.
- Disconnected actions are disabled. Named extension discovery hides the generic injected row. Escape closes the wallet dialog and restores focus. Rejected connection recovers.
- An unknown wallet chain takes switch → code 4902 → exact `wallet_addEthereumChain` parameters → switch. Transaction controls require the correct chain.
- A connected seat populates authoritative state and the previous 24 completed-hour display. Feedback typed data binds the configured chain, seat, authorization version, chain hour and confirmed content revision. Duplicate hourly feedback is disabled after a receipt.
- Simulation failures show the contract reason without sending; signing rejection returns the action to an available state without claiming success.
- Readable discussion is published and reloaded. Proposal preparation rejects a competing nonce, publishes its readable announcement, then opens voting with the exact commitment. Frozen eligible voting works once, and premature execution is disabled.
- The IMD buy flow quotes by simulation, approves exactly the input amount to Permit2, approves the configured router through Permit2, simulates execution and submits the correct router request with zero native ETH value. Four pure encoding tests independently decode both trade directions and both five/six-field router formats.
- Event scans start at the deployment block and keep each range within 1,000 blocks. Source review also covers the bounded four-batch cursor, 12-confirmation boundary, 16 checkpoints, 256-event cache and reorg rollback.
- All 11 routes reflow at 320, 390 and 1440 widths, including large balances, full addresses and transaction data. Chinese routes also reflow at 390.
- Tampered ABIs prevent initialization. Missing deployed code disables transactions. The phone picker offers four app-browser links and Coinbase Smart Wallet.
- WebKit separately connects, reads the seat, signs fixture feedback, reviews and confirms it, and checks 390-pixel reflow.

The final Chromium interaction run reports no page exceptions or failed local asset responses. The unit suite additionally covers strict token precision, integer bounds, UTF-8 message sizes, exact basis-point slippage, malformed ABI tuple inputs, foreign pool currencies, uint128 swap limits, and execution/timelock/expiry/work/bootstrap boundaries.

On this worker, Chromium and WebKit were installed outside the repository. WebKit's required shared libraries were also extracted outside the repository and used by its local launcher. Its host-package heuristic was skipped because those libraries were not system-installed; the actual WebKit browser launched and completed the interaction test. This is not a claim of physical Safari/iOS coverage.

## Better Interface review

Applied the pinned Better Interface contents/workflow and the core principles of all six domains while building. Used the pinned design-critic reference for measurable bars. Source review, rendered checks, fixes and remaining limits are distinguished below.

| Domain | Coverage and result |
| --- | --- |
| Accessibility | Semantic main/navigation landmarks, native controls, explicit labels/help relationships, visible focus, native dialogs, keyboard dismissal/focus return, textual states, reduced motion and disabled prerequisites. Axe scanned 11 routes in English and Chinese with details expanded, plus the Chinese wallet dialog: 23 scans, zero reported violations. Keyboard dialog behavior was exercised in both browser flows. |
| Layout | Participation before mission details; stable desktop rail; compact mobile navigation; wrapping amounts/addresses/calldata; modal safe areas. All route overflow checks passed at 320/390/1440; the pinned probe found no entry-page overlap, clipped text or floating control covering text. |
| Writing | Five-word headline and one descriptive line. Instructions sit beside actions. Configuration absence, chain errors, untrusted observations, current vs historical constitution, refundable deposits and unavailable USD context are explicit. Chinese labels and explanatory content cover every primary route. |
| Typography | System sans-serif prose, monospace identifiers, at most six source sizes and three weights, headline heaviest, body line-height 1.55. Probe observed five sizes per entry-page viewport including one-offs, two family stacks and three weights. Small attendance text no longer inherits display tracking. |
| Colors | Semantic dark-green tokens and visible text alongside status colors. Probe measured all entry-page solid-background text at or above 4.5:1, or 3:1 for large text. No gradient text. Automated contrast has the limitations below. |
| UI | Single wallet entry, distinct approval steps, action-local loading/rejection, review before signing, simulation after review, persistent transaction receipt journal, bounded history and visible read freshness. Main controls are at least 44px high. Three entry-page auxiliary targets are below the 44px comfort target but satisfy the probe's 24px/spacing rule. |

The pinned probe was run from the repository root after the final build:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/quorum-browsers \
IMD_PLAYWRIGHT="$PWD/web/node_modules/playwright/index.mjs" \
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

Result: **16/16 checks passed**. Full measurement output is retained as [`taste.json`](taste.json). Screenshots of the final 390 and 1440 entry pages, the Chinese fixture page and the mobile wallet picker were opened and visually inspected. The first-screen product and action placement was confirmed on the 390 screenshot, not inferred only from source. Representative images are in [`screenshots/`](screenshots/); their fixture/live-read distinction is recorded in `screenshots/README.md`.

### Findings and repairs

References below point to the repaired source, not an obsolete build.

| Finding | Repair and verification |
| --- | --- |
| Stage numbers overlapped adjacent stage prose. | `web/src/style.css:481`: numbers use normal block flow. Final probe reports no text overlaps. |
| Attendance denominator inherited display tracking at a small size. | `web/src/style.css:383`: reset letter spacing. Final tracking check passes. |
| A full address in constitution prose widened the 320px page to 379px. | `web/src/style.css:125`: prose wraps unbroken values. All-route 320/390 tests now pass. |
| Mobile navigation was outside a landmark. | `web/src/App.tsx:178`: labeled native `nav`. All 23 axe scans report no violations. |
| Field help was included in the control's accessible name. | `web/src/context.tsx:321`: explicit `aria-labelledby`, separate `aria-describedby`. Input selection and accessibility scans pass. |
| Transaction review originally exposed an entire ABI object. | `web/src/context.tsx:604`: review now shows the human summary, target, function, arguments and calldata. Browser signing flows exercise the review. |
| Proposal nonce or swap quote could become stale during review. | `web/src/governance.tsx:494`, `web/src/Swap.tsx:376`, `web/src/context.tsx:492`: recheck commitments/quote just before sending and re-simulate after review. Competing-nonce and simulation-error browser cases pass. |
| A receipt timeout could otherwise look like a failed transaction. | `web/src/context.tsx:418`: retain the pending hash across navigation/reload, lock further signing and expose explicit receipt reconciliation. Full timeout/replacement behavior is source-reviewed, not claimed as live-tested. |
| Skip-to-content hash conflicted with hash routing; wallet ordering differed from the pinned guide. | `web/src/App.tsx:107`: focus/scroll main without changing the route. `web/src/Wallet.tsx:146`: discovered browser wallets precede Coinbase. The close button has a Chinese accessible label. Keyboard skip navigation and wallet order are exercised in the final browser suite. |

No observed entry-screen or repeated design failure remains after these repairs. The report is not an assertion that every possible state or accessibility condition has been tested.

## Live read-only observation

`npm run check:rpc --prefix web` queried the configured public Ethereum RPC, confirmed chain 1 and nonempty code at all seven addresses, and recorded code hashes and contract reads. The result in [`rpc-read.json`](rpc-read.json) is a point-in-time worker observation. At block 26204699, admission was unconfigured, the deposited-seat and proposal counts were zero, authority was still bootstrap, and there was no approved release. The UI exposes owner setup and disabled prerequisites instead of treating these as missing requester values.

The exact attested IMD/QRM pool had initialized StateView data. `eth_call` simulation of the configured quoter for 1 IMD returned an output and gas estimate. This is evidence of a successful read/quote, not an executed swap, a guaranteed price, a liquidity assurance or investment guidance. Zero approvals/swaps/other transactions were broadcast.

## Limitations and handoff

- Actual browser extensions, mobile wallet app launches, Coinbase passkey enrollment, hardware wallets, real signatures, funded approvals/swaps, NFT transfers, membership deposits/withdrawals, Safe-owner transactions, live governance execution and handover were not performed. Membership/admin/work/release forms were inspected and use common simulation/review guards, but their complete success paths were not all browser-automated.
- The founder's real-model connector rehearsal and independent contract/security review remain outside this frontend assignment. Existing pinned connector code is delivered unchanged; no simulated agent is represented as a participant. Mocks cannot satisfy the workflow's production handover acceptance.
- No screen reader session, physical device, native 200% browser zoom, forced-colors OS session or complete manual WCAG audit was performed. Axe marks six route scans incomplete for dynamic contrast or `aria-prohibited-attr` review; these are recorded in `accessibility-results.json`, not silently treated as passes. Entry-page measured contrast and keyboard checks do not certify every form state.
- Browser fixtures cover bounded history reads, but do not exhaust deep reorganizations, pending replacement/cancellation, long network outages, transaction timeout reconciliation or every account-change race. Receipts use one confirmation; history uses twelve. Neither is absolute finality.
- Generic advanced contract fields retain ABI names and atomic units. The Chinese constitution is informational; consent binds the exact English file bytes. A future onchain constitution hash mismatch disables acceptance until the approved exact text is supplied.
- No claim/distributor contract or proof was supplied, so the site does not invent an allocation claim action. No external ENS resolver, USD oracle or unlisted swap router was added.
- Public RPC, wallet-vendor services and eventual IPFS/ENS hosting remain external dependencies. The observed Coinbase SDK host is disclosed; there is no project API, backend or relay ID. Rabby's app-browser URL was checked against its [official universal-link handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts); physical app opening remains untested.
- IPFS pinning, ENS/site naming, immutable/named asset fetch verification and publication RPC checks belong to the publisher/control plane and were not performed here. A published URL/CID is not required for worker delivery. Relative Open Graph images are intentional until that origin exists; pinning is not a permanent-storage promise.

See [`ACTION-COVERAGE.md`](ACTION-COVERAGE.md) for the complete action mapping, [`../../web/README.md`](../../web/README.md) for rebuild/publication instructions and [`../DESIGN.md`](../DESIGN.md) for the implemented design system.
