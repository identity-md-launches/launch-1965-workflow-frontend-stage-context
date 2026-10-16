# Rendered evidence

Screenshots are observations of the final production export, not design mockups. They were opened and visually inspected during worker validation.

- `entry-390.png`: pinned design probe, 390 × 844 CSS-pixel entry viewport (device scale 2). No wallet connected. Product, wallet control, completed-hour state and primary feedback action are on the first screen. Revision probe ran with external requests blocked; unknown chain and seat state remain unknown.
- `entry-1440.png`: the same probe at 1440 × 900, with external requests blocked and unknown chain state. No transaction sent.
- `chinese-fixture-390.png`: full-page Chinese rendering after mocked interaction tests. **Seat 7, its 18/24 attendance, account connection, proposal and receipt are test fixtures**, not claims about live membership or execution. The fixture exists only in `web/tests/`.
- `mobile-wallets-390.png`: mobile user-agent wallet sheet at 390 × 844, without an injected extension. Links and Coinbase Smart Wallet were rendered; external wallet apps and passkey creation were not opened.

Revision-specific fixtures (all test data, not assertions about existing live posts or releases):

- `discussion-320.png` and `discussion-390.png`: complete seat ID `2^256 - 2` wraps without horizontal scrolling.
- `validation-zh-390.png`: invalid seat ID `abc` produces the Chinese recovery message.
- `admission-error-390.png`: both RPC hosts aborted; Chinese admission read-error notice with disabled enrollment.
- `release-b-390.png`: release B displays its own approved hash after comparing an A artifact; the prior verdict and file selection have cleared.

Images document layout at those viewports. They do not establish screen-reader accessibility, physical-device behavior or live transaction correctness. See [the validation report](../VALIDATION.md) for performed checks and limitations.
