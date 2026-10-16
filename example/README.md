# react-clear-browser-cache example

A Vite app wired to the package in the parent directory through the pnpm
workspace. It is also the app the Playwright suite in `../e2e` runs against.

```bash
pnpm install
pnpm build           # build the library first; the example imports dist/
pnpm example:dev
```

Query parameters configure the boundary, so one build covers every scenario:

| Parameter         | Effect                                              |
| :---------------- | :-------------------------------------------------- |
| `auto=1`          | Reload as soon as a new build is found.             |
| `duration`        | Polling interval in ms.                             |
| `prompt=1`        | Show the built-in `UpdatePrompt` dialog.            |
| `promptOnError=1` | Prompt instead of reloading on a stale-chunk error. |

## GitHub Pages demo

`pnpm demo:dev` and `pnpm demo:build` set `VITE_DEMO=1`, which swaps the entry
for `src/demo`: a playground with a **Deploy new version** button, live boundary
props, the tab's state and an event log. A fetch shim stands in for the server,
since Pages serves static files only. `e2e/demo.spec.ts` covers it under the
same `/react-clear-browser-cache/` sub-path that Pages uses.
