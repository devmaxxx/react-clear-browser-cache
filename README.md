# react-clear-browser-cache

> Library for clearing browser cache after react app updates

[![NPM](https://img.shields.io/npm/v/react-clear-browser-cache.svg)](https://www.npmjs.com/package/react-clear-browser-cache) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

```bash
npm install --save react-clear-browser-cache

or

yarn add react-clear-browser-cache
```

Requires React 18 or newer. The `generate-build-meta` CLI needs Node.js 18.3 or newer.

## Add script in package.json

Generate a `meta.json` file with a fresh build version before every build.

```json
{
  "prebuild": "generate-build-meta"
}
```

The file is written to `./public/meta.json` by default; pass
`--destination <path>` to write it elsewhere (for example
`generate-build-meta --destination static/meta.json`). The command exits with
code 1 when it cannot write the file.

## Usage

### Using `Boundary`:

`ClearBrowserCacheBoundary` has context provider for child elements (`useClearBrowserCache`), add him after your `ErrorBoundary`, because `ClearBrowserCacheBoundary` only handles certain errors like `ChunkLoadError`.

```tsx
import { createRoot } from 'react-dom/client';

import { ClearBrowserCacheBoundary } from 'react-clear-browser-cache';

import App from './App';
import ErrorBoundary from './ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ClearBrowserCacheBoundary auto fallback='Loading' duration={60000}>
      <App />
    </ClearBrowserCacheBoundary>
  </ErrorBoundary>
);
```

### How it decides to reload

- On mount the boundary shows `fallback` and fetches the meta file. On the first
  visit it records that version and renders the app. If a newer build is found
  later, it clears Cache Storage and reloads the page — on mount always, while
  polling only when `auto` is set; otherwise it sets `isLatestVersion` to
  `false` and leaves the reload to you (`clearCacheAndReload`).
- Polling runs every `duration` ms while the window has focus.
- When a child throws an error that looks like a stale build (a missing chunk,
  or a chunk URL answered with `index.html`), the boundary checks the version:
  if a new build is out it reloads, otherwise the error goes on to your
  `ErrorBoundary`. Recognised out of the box: webpack `ChunkLoadError` and CSS
  chunk errors, Vite CSS preload errors, native `import()` failures in
  Chrome, Firefox and Safari, and `SyntaxError: Unexpected token '<'`.
- A meta file that is missing, has no `version`, or is answered with HTML by an
  SPA fallback is reported to `debug` and otherwise ignored; the app still
  renders.

## Props

| Name          | Type                 | Default      | More info                                                                                                                                                                                                             |
| :------------ | :------------------- | :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| duration      | number               |              | You can set the duration when to fetch for new updates.                                                                                                                                                               |
| auto          | boolean              | false        | Set to true to auto-reload the page whenever an update is available.                                                                                                                                                  |
| fallback      | any                  | null         | You can set fallback data when fetching new version - preloader etc.                                                                                                                                                  |
| storageKey    | string               | APP_VERSION  | Storage key for saving app version.                                                                                                                                                                                   |
| storage       | object               | localStorage | Any `{ get(key), set(key, value) }` object, e.g. [store](https://www.npmjs.com/package/store).                                                                                                                        |
| filename      | string               | meta.json    | Meta file to fetch. A bare name is fetched from the site root; a path starting with `/`, `./` or `../`, or a full URL, is used as is (e.g. `` `${import.meta.env.BASE_URL}meta.json` `` for an app under a sub-path). |
| errorCheckers | array                | []           | Extra `(error) => boolean` checks for errors caused by a stale build, added to the defaults. `createErrorChecker(name, regexp)` builds one.                                                                           |
| debug         | function             |              | You can debug state and errors.                                                                                                                                                                                       |
| updatePrompt  | element or component |              | Shown when a newer build is found and the page is not reloaded on its own. See [Update prompt](#update-prompt).                                                                                                       |
| promptOnError | boolean              | false        | On a stale-build error, show `updatePrompt` over `fallback` instead of reloading at once.                                                                                                                             |

### Using `hook`:

```tsx
import React from 'react';

import { useClearBrowserCache } from 'react-clear-browser-cache';

function App() {
  const contextValue = useClearBrowserCache();

  return null;
}
```

### Using `render props`:

```tsx
import React from 'react';

import { ClearBrowserCache } from 'react-clear-browser-cache';

function App() {
  return <ClearBrowserCache>{(contextValue) => null}</ClearBrowserCache>;
}
```

## Context value

| Name                | Type     | More info                                                                                                                                      |
| :------------------ | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| loading             | boolean  | Indicates request for a new version.                                                                                                           |
| isLatestVersion     | boolean  | Indicates if the latest version of the app.                                                                                                    |
| latestVersion       | string   | Latest version of the app.                                                                                                                     |
| disabled            | boolean  | Indicates if the boundary component is disabled, stopped all requests, doesn't handle errors, just render children because of internal errors. |
| clearCacheAndReload | function | Clear CacheStorage and reload the page.                                                                                                        |
| dismissUpdate       | function | Hide the update prompt until a newer build is found.                                                                                           |

## Update prompt

Pass `updatePrompt` to tell users an update is ready instead of leaving it to
`isLatestVersion`. It shows when polling (`duration`) finds a new build and
`auto` is off, and — with `promptOnError` — when part of the app fails to load
because of a new build. On mount a stale build is still reloaded straight away,
since nothing has been shown yet.

The built-in `UpdatePrompt` is an unstyled native `<dialog>`: modal, focus on
**Reload**, Escape or **Later** dismisses it.

```tsx
import {
  ClearBrowserCacheBoundary,
  UpdatePrompt
} from 'react-clear-browser-cache';

<ClearBrowserCacheBoundary duration={60_000} updatePrompt={UpdatePrompt}>
  <App />
</ClearBrowserCacheBoundary>;
```

Change its text or class, or make it non-modal. Define the wrapper outside
your component: a new function on every render remounts the prompt.

```tsx
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

Or bring your own component; it receives `UpdatePromptProps`:

| Name          | Type                  | More info                                                                                           |
| :------------ | :-------------------- | :-------------------------------------------------------------------------------------------------- |
| latestVersion | string                | The new build's version.                                                                            |
| reason        | `'poll'` \| `'error'` | `error` when a part of the app failed to load; the boundary shows `fallback` behind the prompt.     |
| reload        | function              | Clear Cache Storage and reload the page.                                                            |
| dismiss       | function              | Hide until a newer build is found. For `reason: 'error'` the error goes on to your `ErrorBoundary`. |

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

<ClearBrowserCacheBoundary duration={60_000} updatePrompt={UpdateDialog}>
  <App />
</ClearBrowserCacheBoundary>;
```

A plain element works too (`updatePrompt={<Banner />}`); it reads
`clearCacheAndReload` and `dismissUpdate` from `useClearBrowserCache()`.

## `lazyRetry`

Retries a failing dynamic import before giving up:

```tsx
import { lazy } from 'react';
import { lazyRetry } from 'react-clear-browser-cache';

const Settings = lazy(() => lazyRetry(() => import('./Settings'), 2, 1000));
```

`lazyRetry(fn, retries = 2, interval = 1000)` calls `fn`, and while it rejects
calls it again up to `retries` more times, `interval` ms apart.

## Migrating from 0.2

- React 18 or newer is required, and the package ships ESM and CommonJS builds
  with type declarations through `exports`.
- `lazyRetry(fn, retries)` now makes `retries` extra attempts (the default is
  three attempts in total, it used to be two), and `retries = 0` no longer
  retries forever.
- The stored version is only updated when the cache is actually cleared, so
  `isLatestVersion` stays `false` until the user reloads through
  `clearCacheAndReload`.
- `storage` is typed as `{ get, set }`; the `@ts-ignore` the old type needed can
  go.

## Development

Use Node.js 24 (`.nvmrc`) and pnpm.

```bash
pnpm install
pnpm test          # lint, typecheck, unit tests, build, e2e
pnpm test:unit     # Vitest
pnpm test:e2e      # Playwright against the example app in Chromium, Firefox and WebKit
```

## License

MIT © [arenuzzz](https://github.com/arenuzzz)
