# Frontend revision validation

All four reports reproduced against the unchanged accepted `dist/` before implementation edits. Each is fixed. This report covers the revision only; it is worker evidence, not independent certification or production handover acceptance. Contract code, ABIs, addresses, deployment inputs, dependencies and design tokens are unchanged.

## Reproduction and repair

| Finding | Reproduction on accepted export | Targeted repair and recheck |
| --- | --- | --- |
| `ecc4b4077536a9c18b40b39e08d0ad22df1baad17f79df75017a88148afad119` | A fixture post with seat `2^256 - 2` made document width 622px at both 320 and 390px. Metadata right edge was 622.28125px. | `web/src/style.css:615`: allow the metadata span to shrink and wrap anywhere, bounded to its parent width. Full ID remains present. Recheck: document widths 320/390px, metadata right edges 304/374px; English and Chinese both fit. Screenshots inspected at both widths. |
| `1b82242af6f218eef7ac82286dad88a78f19e90030a8c1764dddcb2ca5a6f782` | Aborting both configured RPC hosts on a fresh `#membership` load displayed “Admission is not configured” before any successful overview. | `web/src/participation.tsx:342,387`: distinguish pending, failed and successfully read admission. Show setup only after a successful zero-hash result. Enrollment requires a successful nonzero-hash read. Tests cover loading, English/Chinese error, disabled actions, authoritative zero and recovery to configured state. |
| `d638a3b2fed460bb02612977ee4c8a46e29ba44e868b3a44402e0468a39f937a` | Chinese Participation, token ID `abc`, then load seat: “Enter a non-negative whole number.” | `web/src/context.tsx:253`, `web/src/lib.ts:107`, `web/src/error-messages.ts`: shared errors use the current locale. Authored validation, wallet rejection and known contract recovery messages are translated. Unrecognized diagnostics remain separate under 技术详情. Browser recheck shows “请输入非负整数。”; switching back restores the existing English text; wallet rejection is Chinese. Unit tests cover numeric bounds, address/hash/ABI input, nested ABI reverts and unknown diagnostics. |
| `0f49450d31d1e83236b5094fa23765ad8ae2dbe71f9dabe3a0d24c2bebb1b3bb` | Fixture releases use the review's exact A/B IDs and site hashes. File bytes `Approved release A artifact\n` matched A; selecting B retained the A success sentence. | `web/src/treasury.tsx:392,433`: the comparison component is keyed by release ID and siteHash. Both file selection and verdict reset when either changes. Pending reads are invalidated on unmount or another file selection. Browser checks cover selecting B, mismatching A against B, current-release updates, same-ID hash updates, release changes during hashing and overlapping file reads. |

Structured measurements are in [revision-results.json](revision-results.json). “Passed” in its **before** section means the reported defect was successfully reproduced, not that the old behavior was correct. The **after** section tests the repaired behavior.

## Commands and outcomes

- `npm ci --prefix web --cache test/scratch/npm-cache --no-audit --no-fund`: dependencies installed from the unchanged lockfile. Existing dependency peer/deprecation warnings were reported; no dependency update was made.
- `npm run typecheck --prefix web`: passed.
- `npm run build --prefix web`: passed; TypeScript, static Vite export, seven pinned implementation ABI hashes and final manifest generation. Existing dependency annotation warnings were non-fatal.
- `npm test --prefix web`: 18/18 tests passed (12 existing, six error-localization tests).
- `node web/tests/revision.mjs`: 5/5 grouped Chromium regression checks passed; no page exceptions or failed local resources.
- `node web/tests/browser.mjs`: all 18 Chromium groups passed, including wallet rejection, switch/add/switch, simulated feedback/post/proposal/vote/swap flows and all-route reflow. The full command exited 1 because its final WebKit step could not launch: the supplied installation has no WebKit executable. No WebKit result is claimed for this revision.
- `node web/tests/audit.mjs`: 23 axe scans, zero violations; six scans retain incomplete rules for manual review.
- `IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste --offline`: 16/16 checks passed at 320, 390 and 1440px. External requests were blocked. The entry screen and repaired states were visually inspected from actual Chromium screenshots.
- `npm run check:export --prefix web`: passed. The 25 assets total 1,775,272 bytes, plus the manifest. Pinned input copies were byte-compared with the supplied deployment/network handoffs. All seven ABI hashes and every exported asset SHA-256 match. No address, chain, poolKey or network changes.

The browser commands above used the supplied Playwright installation without downloading browsers. A temporary loader remapped the scripts' `playwright` import. To repeat with that installation, create the following under `test/scratch/use-provided-playwright.mjs`:

```js
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'playwright') return nextResolve('file:///opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs', context);
  return nextResolve(specifier, context);
} });
```

Then run each script with:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node --import ./test/scratch/use-provided-playwright.mjs web/tests/revision.mjs
```

`npm run test:revision --prefix web` uses the ordinary project Playwright installation when its matching browser is available. `--reproduce` is only for the original accepted export: it intentionally asserts the old defects.

## Better Interface coverage

| Domain | Revision coverage |
| --- | --- |
| Accessibility | Native fields and details; localized persistent alerts; pending admission status; existing keyboard dialog/Escape/focus checks passed. 23 automated axe scans passed with the reported incomplete rules. No screen-reader session. |
| Layout | Full uint256 metadata at 320/390, both languages; existing all-route tests at 320/390/1440; repaired release and admission screens inspected. No clipped seat identity or horizontal overflow in the checked states. |
| Writing | Unknown admission is no longer asserted to be unconfigured. Recovery follows the selected language. A release comparison says only what the currently displayed approval supports. |
| Typography | Existing type scale, weights and families retained. Wrapping added only to the post metadata flex child. Probe passes; the whole ID stays selectable and readable. |
| Colors | Existing semantic tokens retained. Probe measured entry-page text above its contrast thresholds. No unmeasured claims about every dynamic state. |
| UI | Main participation control and wallet remain on the 390px first screen. Admission state gates enrollment. Release changes clear stale file state; out-of-order reads cannot restore stale success. |

## Limits and delivery

No live-chain transaction, wallet signature, funded swap, real mobile wallet, Coinbase passkey flow, publication or founder rehearsal was performed. All new boundary-state evidence is mocked at the RPC/wallet boundary. The existing `rpc-read.json` remains the prior round's dated observation; it was not refreshed for this UI-only revision. WebKit, physical devices, screen readers and native browser zoom were not verified here.

The final export and runtime `imd-deployment.json` are delivered together in the working tree. Local staging was attempted but Git could not create `.git/index.lock` because its filesystem is read-only. No commit was created in this revision; the submission worker must commit these files together. The publisher handles IPFS/ENS after delivery. `docs/DESIGN.md` remains the design document because the explicit write scope excludes a root `DESIGN.md`. `.imd-responses.json` provides the four requested verdicts under the revision's explicit exception. No unrelated source or protected root configuration was edited.
