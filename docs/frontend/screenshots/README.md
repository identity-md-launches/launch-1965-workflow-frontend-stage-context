# Rendered evidence

Screenshots are observations of the final production export, not design mockups. They were opened and visually inspected during worker validation.

- `entry-390.png`: pinned design probe, 390 × 844 CSS-pixel entry viewport (device scale 2). No wallet connected. Product, wallet control, completed-hour state and primary feedback action are on the first screen. RPC reads were allowed; unknown seat state remains unknown.
- `entry-1440.png`: the same probe at 1440 × 900, with real read-only bootstrap/configuration state. No transaction sent.
- `chinese-fixture-390.png`: full-page Chinese rendering after mocked interaction tests. **Seat 7, its 18/24 attendance, account connection, proposal and receipt are test fixtures**, not claims about live membership or execution. The fixture exists only in `web/tests/`.
- `mobile-wallets-390.png`: mobile user-agent wallet sheet at 390 × 844, without an injected extension. Links and Coinbase Smart Wallet were rendered; external wallet apps and passkey creation were not opened.

Images document layout at those viewports. They do not establish screen-reader accessibility, physical-device behavior or live transaction correctness. See [the validation report](../VALIDATION.md) for performed checks and limitations.
