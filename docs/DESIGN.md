# QUORUM interface design

This document is intentionally under `docs/`: the assignment's explicit write budget forbids a root `DESIGN.md`. It describes the implemented frontend, not a proposed redesign.

## Overview

QUORUM is a bilingual assembly console for existing IMD seat owners and their independently consenting agents. The requested dark terminal/geometric-agent character is carried by a restrained green palette, a geometric Q mark, a line-drawn assembly mark, numbered navigation and monospace identifiers. Body prose stays in a system sans-serif for readability.

The participation control comes before mission details. Desktop uses a left navigation rail, primary task panel and secondary assembly summary. Mobile uses a compact native navigation selector. There are no fabricated participants, counters, prices, success states or background animations.

## Colors

Canonical definitions are in `web/src/style.css`, `:root`. Components use semantic variables:

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#0c1110` | Page and input background |
| `--surface` | `#141c18` | Task panels and dialogs |
| `--hover` | `#202d25` | Hover and selected navigation |
| `--text` | `#eef3ed` | Primary text |
| `--muted` | `#abb9af` | Secondary text and data |
| `--line` | `#34483a` | Structural dividers and outlines |
| `--accent` | `#c4f58a` | Main action, links and credited hours |
| `--accent-hover` | `#d8ffad` | Hovered main action |
| `--ink` | `#182511` | Text on the accent fill |
| `--warning` | `#f4ce8a` | Configuration or network notice |
| `--error` | `#ffaba4` | Action failures |
| `--focus` | `#d5f9b2` | Two-pixel keyboard focus outline |

Status is always accompanied by text, not just color. The app is deliberately dark-only, as requested; no unused theme toggle is shown. Measured contrast and the actual review results are recorded in `docs/frontend/VALIDATION.md`.

## Typography

The body stack is `Inter, Segoe UI, Noto Sans SC, PingFang SC, Arial, sans-serif`. These are system candidates; no downloaded Inter font is claimed. Identifiers, hashes, encoded data and navigation numbers use `SFMono-Regular, Consolas, Liberation Mono, monospace`. All assets are local; there is no font CDN.

Six sizes are used across the responsive system: 14, 16, 20, 24, 36 and 48 CSS pixels. Body line-height is 1.55, long constitution prose 1.8 (1.75 on small screens), heading line-height 1.1–1.4. Weights are 400, 600 and 700; the main headline is 700. The desktop headline is 48px, changing to 36px at 900px. Section titles use 24px, with compact mobile panel headings at 20px. Inputs remain 16px to avoid mobile focus zoom.

Display tracking is `-.045em`; smaller headings use `-.02em`. The attendance denominator resets tracking to zero instead of inheriting the larger number's pixel spacing. Data uses tabular numerals. Long values wrap with `overflow-wrap:anywhere`; no critical address, amount, hash or message is ellipsized. Discussion seat metadata also uses `min-width:0` and `max-width:100%` on its flex child so a complete uint256 ID wraps at 320 and 390px. Long prose is capped at 74ch. Chinese translation is informational; consent binds the exact English constitution file bytes.

## Layout

Use the existing `.page-heading`, `.panel`, `.section`, `.overview-grid`, `.two-columns`, `.three-columns`, `.form-grid` and `.row` primitives. Common gaps and padding are 8, 12, 16, 20, 24, 28, 32, 40 and 56px. Related controls use 8–12px gaps; separate sections use 24–40px.

The overall desktop shell is at most 1680px wide, with a 240px rail and a flexible workspace; main content is capped at 1280px. At 1150px, the rail narrows to 200px and panels stack earlier. At 900px, the rail is replaced by a labeled native select. At 640px, task grids become one column, main gutters are 16px, panel padding is 20px × 16px, and dialogs become bottom sheets with safe-area padding. At 359px the brand and header utility spacing tighten. No horizontal scrolling is used for navigation.

The main action, attendance state and wallet control were inspected at 390px. Reflow tests cover 320, 390 and 1440px, both languages, full addresses, large token balances and transaction data. Native 200% browser zoom and physical devices remain separate unperformed checks.

## Elevation & Depth

The interface uses flat tonal surfaces and one-pixel structural borders. There are no box shadows, gradient text or nested ornamental cards. The modal backdrop is `#000a`; a native `<dialog>` provides top-layer elevation and background inertness. The transaction journal stays in normal document flow rather than covering content.

## Shapes

Buttons use a 6px radius; inputs use 5px; panels use 10px; desktop dialogs use 12px. Mobile dialog top corners use 16px. The Q mark and assembly illustration are authored SVG geometry. Wallet marks are bundled local assets with their source attribution in `docs/frontend/RainbowKit-LICENSE.txt`.

## Components

| Component / source | Purpose and behavior |
| --- | --- |
| `Wallet` / `web/src/Wallet.tsx` | One connect control; named EIP-6963 rows; mobile app-browser links; Coinbase passkey option; per-row pending/error state; account details and disconnect; chain switch/add/switch fallback. |
| `Dialog` / `web/src/context.tsx` | Native modal with visible title, close button, backdrop dismissal, Escape, focus containment and focus return. Bottom sheet at 640px. |
| `Field` / `web/src/context.tsx` | Labeled input/textarea with an explicit accessible name and separate `aria-describedby` help. No placeholder-only fields. |
| `TxButton`, `Transactions` / `web/src/context.tsx` | Local action progress and errors; shared protection against concurrent signing; chain/ABI/code/wallet readiness gates; simulation, fee estimate, readable review and receipt journal. Review shows target, function, arguments and calldata, not the entire ABI. |
| `AddressView`, `Data`, `ErrorNote` / `web/src/context.tsx` | Full checksummed addresses with explorer/copy controls; wrapping exact values; persistent errors in the selected locale. Unrecognized diagnostics remain in a separate native technical-details disclosure. |
| `SeatPicker`, `Participation` / `web/src/participation.tsx` | Explicit seat selection, 24 completed-hour cells, onchain count, status and feedback action. Unknown state is visibly unknown. |
| `Membership` / `web/src/participation.tsx` | Admission loading and read failure are distinct from a successfully read zero configuration hash. Enrollment stays disabled until admission is verified. |
| `ArtifactComparison` / `web/src/treasury.tsx` | Local file comparison is keyed by release ID and approved site hash. Changing either clears the file and verdict; obsolete pending reads are discarded. The hash verdict follows the selected language. |
| `ContractForm`, `Inspector` / `web/src/tools.tsx` | ABI-derived exact argument fields, inspectable calldata and contract reads. Privileged budget/release actions are prepared for major proposals, not bypassed. |
| `EventHistory` / `web/src/events.tsx` | User-triggered bounded log batches, visible cursor and confirmation boundary, local reorg-aware cache. |

Buttons are at least 44px high, wallet rows at least 52px; auxiliary copy/refresh buttons are 32px high with spacing. Primary emphasis is reserved for connection or the current main action. Disabled controls use a dashed border and explain prerequisites. Hover, pressed and `:focus-visible` states share the same tokens. Motion is limited to 120ms color transitions and a 0.96 pressed scale, only when reduced motion is not requested. Forced-colors mode retains system focus visibility.

## Do's and Don'ts

- Add a route using the existing shell, one `h1`, descriptive section headings and the established layout primitives.
- Use the runtime manifest and fetched ABI registry for every application contract. Never add a parallel deployment map to a component.
- Use `TxButton` for signing flows and state the human consequence in the review summary. Keep owner-only and governance-only calls gated.
- Preserve exact address/hash/calldata access. Wrap long data; do not crop it to make a screenshot fit.
- Keep the primary control above explanatory sections on mobile. Do not add a marketing hero that pushes it out of view.
- Show unknown, unconfigured, reverted and pending states honestly. An observer report, an RPC observation or a mock test is not approval or finality.
- Reuse tokens and the existing type scale. Do not add extra fonts, decorative labels or endless motion.

Design guidance: Jakub Krehel's Better Interface at `267330e1adfc66a718fb65fa6918c1f06d0a689e` (MIT); documentation method: Paul Bakaus's Impeccable at `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` (Apache-2.0). The pinned imported licenses are retained under `docs/frontend/`.
