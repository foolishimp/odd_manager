# runtime

`runtime/odd_manager_world.py` is the tenant-local composition helper for the
React/Vite carrier.

It does not replace ABG runtime authority and it does not move domain ownership
into the UI tenant. Its job is narrower:

- bootstrap imports for the managed workspace, `odd_manager`, and `odd_method`
- replay ABG event truth into runtime aggregates
- call the `odd_method` query library for read-only domain overlays
- derive manager-local graph and workorder projections for the UI

Supported commands:

- `world`
- `surface --relative-path <path>`
- `command gaps|iterate|start [--auto]`
