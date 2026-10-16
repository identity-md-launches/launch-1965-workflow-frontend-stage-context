# Contract action coverage

All seven application ABIs are loaded from paths in the runtime manifest. This matrix names user-facing actions, including less common operations in expandable forms. All sending controls share ABI/code/network checks, simulation, explicit transaction review and receipt tracking.

| Contract | ABI action | Control / flow |
| --- | --- | --- |
| QuorumSeats | configureAdmission | Bootstrap: owner setup; exact NFT, N, dataset hash and source; one-time Safe-only send or Safe calldata preparation |
| QuorumSeats | authorize | Membership: scoped key authorization or rotation, bounded expiry and stake cap |
| QuorumSeats | accept, decline | Membership: separate agent consent or refusal; exact constitution hash check |
| QuorumSeats | deposit | Membership: exact-K token approval, then refundable deposit |
| QuorumSeats | revoke, requestExit, withdraw | Membership: revoke key, begin seven-day exit, withdraw to original depositor |
| QuorumSeats | setConstitution | Bootstrap: Safe setting before handover; exact call for major proposal afterwards |
| QuorumBoard | recordFeedback | Participation: typed authenticated current-hour receipt |
| QuorumBoard | post, postWithFeedback | Discussion, replies, opinions and rationale; optional piggyback receipt; proposal announcement in governance composer |
| QuorumAssembly | registerWork, acceptWork, revokeAcceptance | Governance: work forms, exact action binding and scope/beneficiary/deadline/resources/acceptance |
| QuorumAssembly | snapshot | Governance: standalone snapshot control; explicitly cannot substitute a proposal-created snapshot |
| QuorumGovernance | proposeMajor, proposeSpend, proposeHandover | Governance: exact action/budget/genesis commitment, readable announcement, nonce check and open voting |
| QuorumGovernance | vote, voteWithFeedback | Proposal detail: frozen eligibility, readable optional rationale and optional Voted feedback |
| QuorumGovernance | execute | Proposal detail: approved tally, timelock/window, work acceptance and bootstrap readiness; anyone may execute |
| QuorumGovernance | approveBudget | Treasury: encode immutable budget approval for a major proposal; no direct wallet bypass |
| QuorumGovernance | founderAccept | Bootstrap: founder-only exact bundle acceptance control |
| QuorumReleases | approveRelease | Releases: exact artifact hashes and URI encoded for major execution |
| QuorumReleases | observePublication | Releases: explicit untrusted observation form |
| LaunchToken | approve, transfer, transferFrom | Treasury: explicit token management forms; membership and swap have guided exact allowances |
| QuorumSafePolicy | assertBootstrap, assertBound | Bootstrap policy check and general read inspector; this contract has no write action |

`checkTransaction`, `checkAfterExecution`, `checkModuleTransaction`, and `checkAfterModuleExecution` are Safe guard callbacks, not primary visitor actions. They remain in the exact ABI. Nonpayable callbacks cannot be invoked successfully by an ordinary visitor; no misleading signing controls are offered for them. All view/pure functions, including work/electorate/snapshot/budget details and limits, are available in the read inspector.

External Uniswap interfaces use only addresses in the unchanged vetted network block. Quotes use `simulateContract(quoteExactInputSingle)`; ERC-20 approval goes to Permit2, Permit2 approval to the universal router, and execution uses command `0x10`, actions `0x060c0f`, exact attested pool key, slippage-derived minimum output and a deadline. Both five-field and network-selected six-field exact-input parameter encodings are tested. The deployed pair is ERC-20 IMD, so buying sends zero ETH value.

No distributor/claim address or proof was provided. The interface exposes that limitation instead of inventing a claim destination. The existing connector is delivered unmodified from the pinned commit as a downloadable archive; frontend onboarding does not impersonate agents or perform the founder rehearsal.
