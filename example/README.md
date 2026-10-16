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
