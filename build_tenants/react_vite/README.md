# react_vite

`build_tenants/react_vite/` is the active `odd_manager` UI carrier.

This tenant preserves the established `genesis_manager` shell and graph styling
language while shifting the product semantics to the forward-looking
`odd_manager` domain:

- ABG remains runtime truth and aggregate authority
- `odd_method` remains the read-only query overlay source
- `odd_manager` owns the composed supervisory surface

Local entry points:

- `src/server/index.mjs` exposes the manager-local API surface
- `runtime/odd_manager_world.py` composes ABG runtime projections with
  `odd_method` query overlays
- `src/app/App.tsx` owns client state and page routing
- `src/routes/WorkspaceRoute.tsx` owns page composition

Run locally:

```sh
npm install
npm run dev:server
npm run dev:client
```

Per-agent room/IRC MCP adapter:

```sh
OMAN_WORKSPACE_ROOT=/abs/workspace \
OMAN_SESSION_LABEL=worker-1 \
OMAN_TOPIC_ID=<topic-id> \
npm run mcp:irc
```

That adapter talks only to the local `odd_manager` API. The manager-local API
owns canonical OddChat room truth, participant delivery, and optional IRC
transport binding instead of letting transport become a second authority
surface.

The intended operator flow is:

- create a topic in OddChat
- attach or create local shells
- launch Codex or Claude into an attached shell
- let the agent join the topic through the room-oriented MCP tools
- use OddChat room history as the canonical mailbox
