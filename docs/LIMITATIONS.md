# Limitations

Weave is a complete client-side planning canvas with a deliberately small boundary.

- The Lisbon sample is a checked-in, deterministic example. It demonstrates the registered tools and visible product flow without claiming live recommendations, current prices, or local expertise.
- A custom goal starts as a real card immediately. Building a fuller custom plan requires direct editing or a compatible browser host calling the page's site tools.
- There are no accounts, shared workspaces, cloud sync, or cross-device storage. Closing or refreshing the tab clears the current board.
- All data stays in the page. Weave does not send the board to a server, load external data, or collect personal information.
- Export creates a local Markdown or JSON download. It does not publish, email, or sync the plan.
- Direct `file://` use relies on the local polyfill and is not discoverable by ChatGPT. Native site-tool discovery requires a supported browser host and the deployed HTTPS page.
- The layout is deterministic and intentionally hand-written. It handles a focused planning board well, but very large boards may require horizontal scrolling and do not use automatic collision optimization.
- `clearBoard` is the only destructive registered tool. It requires both `confirm: true` in the call and a separate visible approval on the page.
- WebMCP is still evolving. Registration is isolated behind one wrapper so the browser contract can be updated without changing the planning model.

The sample contains no real bookings, identities, personal data, or external claims.
