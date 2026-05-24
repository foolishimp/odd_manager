# runtime

The React/Vite tenant runtime is Node-owned. Projection logic lives in
`src/server/manager-world-service.mjs`; runtime adapters in this folder are
Node entrypoints for auxiliary local tools.

It does not replace ABG runtime authority and it does not move domain ownership
into the UI tenant. Its job is narrower:

- read specification, runtime, and record surfaces from the managed workspace
- project ABG event truth into runtime aggregates when event surfaces exist
- derive manager-local graph and workorder projections for the UI

Manager world API commands:

- `/api/world`
- `/api/surface?relativePath=<path>`
- `/api/commands/run` for local `gaps` projection

Traversal commands are not implemented through a tenant-local compatibility
helper. Execution belongs behind the configured domain/runtime service
boundary.

Additional local runtime entrypoints:

- `odd_manager_irc_mcp.mjs`

`odd_manager_irc_mcp.mjs` is a per-agent stdio MCP adapter for the local
`odd_manager` API.

Its primary product-facing surface is now room-oriented:

- `room_join`
- `room_status`
- `room_read`
- `room_wait`
- `room_send`
- `room_leave`

It also retains low-level `irc_*` tools for transport binding and debugging.

It does not connect to IRC directly. Instead it talks to the manager-local API
so `odd_manager` retains control over room truth, participant membership,
transport behavior, attribution, and replay.

Run it with:

```sh
OMAN_WORKSPACE_ROOT=/abs/workspace \
OMAN_SESSION_LABEL=worker-1 \
OMAN_TOPIC_ID=<topic-id> \
npm run mcp:irc
```

Optional environment:

- `OMAN_MCP_GATEWAY_URL` defaults to `http://127.0.0.1:4173`
- `OMAN_SESSION_ID` can be used instead of `OMAN_SESSION_LABEL`
- `OMAN_ROOM_ID` binds directly to a room if you do not want topic lookup
- `OMAN_AGENT_PROVIDER` labels the participant, for example `codex` or
  `claude`
- `OMAN_IRC_HOST`, `OMAN_IRC_PORT`, `OMAN_IRC_TLS`, `OMAN_IRC_INSECURE_TLS`,
  and `OMAN_IRC_PASSWORD` provide gateway-side connection defaults
