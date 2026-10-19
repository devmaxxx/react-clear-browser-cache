# Changelog

## 1.0.1

- The package ships its MIT `LICENSE`, and its author, homepage and issue links are up to date.
- The README opens with the new logo, and its images load on npmjs.com too.
- Releases are published from GitHub Actions through npm Trusted Publishing, with a provenance statement.

## 1.0.0

### Breaking changes

- React 18 or newer is required.
- The package ships ESM and CommonJS builds through `exports`; deep imports into `dist/` no longer resolve.
- The stored version is saved only when the cache is cleared, so `isLatestVersion` stays `false` until the reload.
- `lazyRetry(fn, 0)` makes one attempt instead of retrying forever.
- `debug` receives `error: unknown` and always receives `state`.

See [Upgrading from 0.x](README.md#upgrading-from-0x).

### Features

- `onUpdate` (`'prompt' | 'reload' | 'flag'`) decides what a check that finds a newer build does. `auto` still works and is deprecated.
- `prompt` asks the user to reload with your own component, which receives `UpdatePromptProps`; `promptOnChunkError` asks before reloading for a chunk error too.
- `reloadWhenHidden` reloads into a new build when the tab goes to the background, and checks once on the way.
- `canReload` holds back reloads the user did not start.
- `blocking={false}` renders the app before the first check.
- A tab that gets focus back after a whole `duration` checks at once.
- Next.js support: the bundle is marked `'use client'`, renders on the server and hydrates without a mismatch; Turbopack chunk errors are recognised.
- `defaultErrorCheckers` and `isCacheError` are exported.

### Fixes

- `lazyRetry` no longer retries forever on `0`, and keeps its result type.
- Chunk errors from Vite, mini-css-extract-plugin, native dynamic `import()` in every major browser, and chunks answered with HTML are recognised; 0.2 knew only webpack and one SyntaxError form.
