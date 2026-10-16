# react-clear-browser-cache

> Keep open tabs on your latest React build: notice a deploy, clear Cache Storage and reload, or ask the user first.

[![npm version](https://img.shields.io/npm/v/react-clear-browser-cache.svg)](https://www.npmjs.com/package/react-clear-browser-cache)
[![npm downloads](https://img.shields.io/npm/dm/react-clear-browser-cache.svg)](https://www.npmjs.com/package/react-clear-browser-cache)
[![CI](https://github.com/devmaxxx/react-clear-browser-cache/actions/workflows/ci.yml/badge.svg)](https://github.com/devmaxxx/react-clear-browser-cache/actions/workflows/ci.yml)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-clear-browser-cache.svg)](https://bundlephobia.com/package/react-clear-browser-cache)
![types](https://img.shields.io/npm/types/react-clear-browser-cache.svg)
[![license](https://img.shields.io/npm/l/react-clear-browser-cache.svg)](#license)

Users leave tabs open for days. After you deploy, those tabs still run the old build, and the moment they open a lazy route its chunk is gone from the server: `ChunkLoadError`, a blank screen, a support ticket. This library notices the new build and gets the tab onto it.

**[▶ Try the live demo](https://devmaxxx.github.io/react-clear-browser-cache/)** — deploy a new version in one click and watch an open tab notice it, prompt, clear Cache Storage and reload.

<a href="https://devmaxxx.github.io/react-clear-browser-cache/">
  <img alt="The demo after a deploy: the update prompt asks to reload, the event log shows meta.json returning v2 while the tab still runs v1." src="docs/demo-light.png" width="800" />
</a>

## Features

- **Detects new builds** by polling a tiny `meta.json` that a CLI writes at build time.
- **Recovers from stale-chunk errors** — webpack and Vite chunk failures, native `import()` errors in Chrome, Firefox and Safari, and HTML served in place of a script — and passes every other error on to your own error boundary.
- **Asks or acts:** reload on its own, quietly while the tab is in the background, or show an accessible update prompt (built in, or your own component). A `canReload` guard protects unsaved work.
- **Checks when users return:** a tab that was in the background for a while checks for a new build as soon as it gets focus.
- **Clears Cache Storage** before reloading, so a service worker cannot serve the old build again.
- **`lazyRetry`** for flaky networks: retries a dynamic import before giving up.
- **Small and typed:** React 18 and 19, ESM and CommonJS, TypeScript declarations, no runtime dependencies.

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Update prompt](#update-prompt)
- [API](#api)
- [Recipes](#recipes)
- [Troubleshooting](#troubleshooting)
- [Migrating from 0.2](#migrating-from-02)
- [Contributing](#contributing)
- [License](#license)

## Install

```bash
npm install react-clear-browser-cache
# or
pnpm add react-clear-browser-cache
# or
yarn add react-clear-browser-cache
```

Requires React 18 or newer. The `generate-build-meta` CLI needs Node.js 18.3 or newer.

## Quick start

**1. Write a build version on every build.** Add the CLI as a `prebuild` script:

```json
{
  "scripts": {
    "prebuild": "generate-build-meta"
  }
}
```

It writes `{ "version": "<random uuid>" }` to `./public/meta.json`. Use `--destination <path>` for another location, e.g. `generate-build-meta --destination static/meta.json`. It exits with code 1 when it cannot write the file.

**2. Wrap your app** inside your own error boundary:

```tsx
import { createRoot } from 'react-dom/client';
import {
  ClearBrowserCacheBoundary,
  UpdatePrompt
} from 'react-clear-browser-cache';

import App from './App';
import ErrorBoundary from './ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ClearBrowserCacheBoundary
      duration={60_000}
      fallback='Loading…'
      updatePrompt={UpdatePrompt}
      promptOnError
    >
      <App />
    </ClearBrowserCacheBoundary>
  </ErrorBoundary>
);
```

**3. Deploy.** Tabs with the old build now see a prompt within a minute, or as soon as a lazy chunk fails to load.

Prefer no prompt at all? Set `reloadWhenHidden`: the tab reloads into the new build the moment the user switches away from it. Add `canReload` to hold off while a form has unsaved changes.

```tsx
<ClearBrowserCacheBoundary
  duration={60_000}
  reloadWhenHidden
  canReload={() => !formIsDirty()}
>
```

## How it works

```mermaid
flowchart LR
  A[Mount] --> B{fetch meta.json}
  B -- first visit --> C[store version, render app]
  B -- same version --> C
  B -- newer version --> D[clear Cache Storage, reload]
  C --> E[poll every duration ms while focused]
  E -- newer version --> F{auto?}
  F -- yes --> D
  F -- no --> G[show updatePrompt / isLatestVersion = false]
  C --> H[child throws a stale-chunk error]
  H --> I{newer version?}
  I -- yes --> J[reload, or prompt with promptOnError]
  I -- no --> K[rethrow to your ErrorBoundary]
```

- On mount the boundary shows `fallback` and fetches the meta file; with `blocking={false}` it renders the app at once and checks in the background. A newer build found on mount always reloads straight away.
- Polling runs every `duration` ms, only while the window has focus. A tab that gets focus back after a whole `duration` checks at once. When a check finds a newer build it reloads if `auto` is set; otherwise it shows `updatePrompt`, or just sets `isLatestVersion` to `false` and leaves the reload to you (`clearCacheAndReload`).
- With `reloadWhenHidden`, a tab that knows about a newer build reloads as soon as it goes to the background. `canReload` is asked before this reload and before every `auto` reload; a reload the user clicks is never blocked.
- When a child throws an error that looks like a stale build, the boundary checks the version: if a new build is out it reloads (or prompts, with `promptOnError`); otherwise the error goes on to your `ErrorBoundary`.
- The meta file is fetched with `cache: 'no-store'`. A file that is missing, has no `version`, or is answered with HTML by an SPA fallback is reported to `debug` and otherwise ignored; the app still renders.
- If storage cannot be read (blocked cookies, private mode), the boundary disables itself and just renders the app.

## Update prompt

The built-in `UpdatePrompt` is an unstyled native `<dialog>`: modal, focus on **Reload**, Escape or **Later** dismisses it, focus returns to where it was, and the buttons lock while the page reloads. A dismissed prompt stays hidden until a newer build appears.

Change its text or class, or make it non-modal. Define the wrapper outside your component: a new function on every render remounts the prompt.

```tsx
import {
  UpdatePrompt,
  type UpdatePromptProps
} from 'react-clear-browser-cache';

function AppUpdatePrompt(props: UpdatePromptProps) {
  return (
    <UpdatePrompt
      {...props}
      className='update-dialog'
      title='Update ready'
      reloadLabel='Refresh'
    />
  );
}

<ClearBrowserCacheBoundary
  duration={60_000}
  promptOnError
  updatePrompt={AppUpdatePrompt}
>
  <App />
</ClearBrowserCacheBoundary>;
```

Or bring your own component; it receives [`UpdatePromptProps`](#updatepromptprops):

```tsx
import type { UpdatePromptProps } from 'react-clear-browser-cache';

function UpdateDialog({ reload, dismiss }: UpdatePromptProps) {
  return (
    <Modal open onClose={dismiss}>
      A new version is available.
      <Button onClick={reload}>Refresh</Button>
    </Modal>
  );
}
```

A plain element works too (`updatePrompt={<Banner />}`); it reads `clearCacheAndReload` and `dismissUpdate` from `useClearBrowserCache()`.

## API

### `<ClearBrowserCacheBoundary>`

Error boundary and context provider. Place it inside your own error boundary: it only handles stale-build errors.

| Prop               | Type                            | Default         | Description                                                                                                                           |
| :----------------- | :------------------------------ | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `duration`         | `number`                        | —               | Poll interval in ms. Without it the version is checked on mount and on stale-chunk errors only.                                       |
| `auto`             | `boolean`                       | `false`         | Reload as soon as a poll finds a newer build.                                                                                         |
| `fallback`         | `ReactNode`                     | `null`          | Rendered while the first version check runs, e.g. a preloader.                                                                        |
| `updatePrompt`     | element or component            | —               | Shown when a newer build is found and the page is not reloaded on its own. See [Update prompt](#update-prompt).                       |
| `promptOnError`    | `boolean`                       | `false`         | On a stale-build error, show `updatePrompt` over `fallback` instead of reloading at once.                                             |
| `reloadWhenHidden` | `boolean`                       | `false`         | Reload into a newer build as soon as the tab goes to the background.                                                                  |
| `canReload`        | `() => boolean`                 | —               | Asked before reloads the user did not start (`auto`, `reloadWhenHidden`). Return `false` to keep the page.                            |
| `blocking`         | `boolean`                       | `true`          | Show `fallback` until the first check answers. `false` renders the app at once.                                                       |
| `filename`         | `string`                        | `'meta.json'`   | Meta file to fetch. A bare name is fetched from the site root; a path starting with `/`, `./` or `../`, or a full URL, is used as is. |
| `storageKey`       | `string`                        | `'APP_VERSION'` | Key the current version is stored under.                                                                                              |
| `storage`          | `{ get(key), set(key, value) }` | `localStorage`  | Where the version is kept, e.g. [store](https://www.npmjs.com/package/store).                                                         |
| `errorCheckers`    | `((error) => boolean)[]`        | `[]`            | Extra checks for stale-build errors, added to the defaults. See [`createErrorChecker`](#createerrorcheckername-pattern).              |
| `debug`            | `(params) => void`              | —               | Receives state changes and errors, for logging.                                                                                       |

### `useClearBrowserCache()` and `<ClearBrowserCache>`

Read the boundary's state from any child, by hook or by render prop:

```tsx
import {
  ClearBrowserCache,
  useClearBrowserCache
} from 'react-clear-browser-cache';

function VersionBadge() {
  const { isLatestVersion, clearCacheAndReload } = useClearBrowserCache();
  return isLatestVersion ? null : (
    <button onClick={clearCacheAndReload}>Update</button>
  );
}

<ClearBrowserCache>
  {({ latestVersion }) => <small>{latestVersion}</small>}
</ClearBrowserCache>;
```

| Field                 | Type                  | Description                                                                 |
| :-------------------- | :-------------------- | :-------------------------------------------------------------------------- |
| `loading`             | `boolean`             | A version check is running.                                                 |
| `isLatestVersion`     | `boolean`             | The running build is the latest one.                                        |
| `latestVersion`       | `string`              | Version from the most recent meta file.                                     |
| `disabled`            | `boolean`             | Storage failed, so the boundary stopped checking and only renders children. |
| `clearCacheAndReload` | `() => Promise<void>` | Clear Cache Storage, store the latest version and reload.                   |
| `dismissUpdate`       | `() => void`          | Hide the update prompt until a newer build is found.                        |

### `<UpdatePrompt>`

The built-in dialog. Takes `UpdatePromptProps` plus `title`, `message`, `reloadLabel`, `dismissLabel`, `className` and `modal` (default `true`).

### `UpdatePromptProps`

| Prop            | Type                  | Description                                                                                         |
| :-------------- | :-------------------- | :-------------------------------------------------------------------------------------------------- |
| `latestVersion` | `string`              | The new build's version.                                                                            |
| `reason`        | `'poll' \| 'error'`   | `'error'` when part of the app failed to load; the boundary shows `fallback` behind the prompt.     |
| `reload`        | `() => Promise<void>` | Clear Cache Storage and reload the page.                                                            |
| `dismiss`       | `() => void`          | Hide until a newer build is found. For `reason: 'error'` the error goes on to your `ErrorBoundary`. |

### `lazyRetry(fn, retries = 2, interval = 1000)`

Calls `fn`, and while it rejects calls it again up to `retries` more times, `interval` ms apart.

```tsx
import { lazy } from 'react';
import { lazyRetry } from 'react-clear-browser-cache';

const Settings = lazy(() => lazyRetry(() => import('./Settings'), 2, 1000));
```

### `createErrorChecker(name, pattern)`

Builds an error checker that matches an error's `name` and a `RegExp` on its message:

```tsx
import { createErrorChecker } from 'react-clear-browser-cache';

const errorCheckers = [
  createErrorChecker('Error', /Failed to load module script/)
];
```

Recognised out of the box: webpack `ChunkLoadError` and CSS chunk errors, Vite CSS preload errors, native `import()` failures in Chrome, Firefox and Safari, and `SyntaxError: Unexpected token '<'`.

## Recipes

**App under a sub-path (Vite `base`, GitHub Pages).** Point `filename` at the base URL:

```tsx
<ClearBrowserCacheBoundary filename={`${import.meta.env.BASE_URL}meta.json`}>
```

**Version from your CI instead of a random UUID.** Any JSON with a `version` string works, e.g. `echo "{\"version\":\"$GITHUB_SHA\"}" > public/meta.json`.

**Reload on the next route change.** A route change replaces the screen anyway, so it is a quiet moment to switch builds:

```tsx
function ReloadOnNavigate() {
  const { isLatestVersion, clearCacheAndReload } = useClearBrowserCache();
  const location = useLocation(); // react-router

  useEffect(() => {
    if (!isLatestVersion) clearCacheAndReload();
  }, [location.pathname]);

  return null;
}
```

**Show the update somewhere other than a dialog.** Leave `updatePrompt` out and render a banner from `isLatestVersion` with the hook.

## Troubleshooting

<details>
<summary>The app never notices a new build</summary>

Open `meta.json` in the browser. It must be the JSON file, not your `index.html`: an SPA fallback that rewrites unknown paths to `index.html` hides a missing file (`debug` reports it). Check that the `prebuild` script ran in CI, and that `duration` is set if you expect polling.

</details>

<details>
<summary>It reloads, but the old build comes back</summary>

Something in front of the browser cached the HTML. Serve `index.html` and `meta.json` with `Cache-Control: no-cache`; hashed assets can stay immutable.

</details>

<details>
<summary>A chunk error still reaches my error boundary</summary>

That happens when the build has not changed — the boundary only recovers when a newer version is out. If your bundler words the error differently, add a checker with `createErrorChecker`.

</details>

## Migrating from 0.2

- React 18 or newer is required, and the package ships ESM and CommonJS builds with type declarations through `exports`.
- `lazyRetry(fn, retries)` now makes `retries` extra attempts (the default is three attempts in total, it used to be two), and `retries = 0` no longer retries forever.
- The stored version is only updated when the cache is actually cleared, so `isLatestVersion` stays `false` until the user reloads through `clearCacheAndReload`.
- `storage` is typed as `{ get, set }`; the `@ts-ignore` the old type needed can go.

## Contributing

Issues and pull requests are welcome. Use Node.js 24 (`.nvmrc`) and pnpm:

```bash
pnpm install
pnpm test          # lint, typecheck, unit tests, build, e2e
pnpm test:unit     # Vitest
pnpm test:e2e      # Playwright against the example app in Chromium, Firefox and WebKit
pnpm demo:dev      # the GitHub Pages demo, with deploys simulated in the browser
```

The demo is the example app built with `VITE_DEMO=1`. GitHub Pages serves static files only, so a fetch shim answers `meta.json` with a version kept in localStorage; the version check, cache clearing and reload are the library's own. `.github/workflows/pages.yml` publishes it on every push to `master`.

## License

MIT © [arenuzzz](https://github.com/arenuzzz)
