# react-clear-browser-cache

> Library for clearing browser cache after react app updates

[![NPM](https://img.shields.io/npm/v/react-clear-browser-cache.svg)](https://www.npmjs.com/package/react-clear-browser-cache) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

```bash
npm install --save react-clear-browser-cache

or

yarn add react-clear-browser-cache
```

## Add script in package.json

Generate `meta.json` file with latest build version.

```json
{
  "prebuild": "npm run generate-build-meta",
  "generate-build-meta": "node ./node_modules/react-clear-browser-cache/bin/cli.js"
}
```

## Usage

### Using `Boundary`:

`ClearBrowserCacheBoundary` has context provider for child elements (`useClearBrowserCache`), add him after your `ErrorBoundary`, because `ClearBrowserCacheBoundary` only handles certain errors like `ChunkLoadError`.

```tsx
import React from 'react';
import ReactDOM from 'react-dom';

import { ClearBrowserCacheBoundary } from 'react-clear-browser-cache';

import App from './App';
import ErrorBoundary from './ErrorBoundary';

ReactDOM.render(
  <ErrorBoundary>
    <ClearBrowserCacheBoundary auto fallback='Loading' duration={60000}>
      <App />
    </ClearBrowserCacheBoundary>
  </ErrorBoundary>,
  document.getElementById('root')
);
```

## Props

| Name          | Type     | Default      | More info                                                                                                         |
| :------------ | :------- | :----------- | :---------------------------------------------------------------------------------------------------------------- |
| duration      | number   |              | You can set the duration when to fetch for new updates.                                                           |
| auto          | boolean  | false        | Set to true to auto-reload the page whenever an update is available.                                              |
| fallback      | any      | null         | You can set fallback data when fetching new version - preloader etc.                                              |
| storageKey    | string   | APP_VERSION  | Storage key for saving app version.                                                                               |
| storage       | object   | localStorage | You can use another storage to save and get the version of app like [store](https://www.npmjs.com/package/store). |
| filename      | string   | meta.json    | Filename for fetching new app version.                                                                            |
| errorCheckers | array    | []           | You can set custom error checkers for catching errors concerned with invalid browser caches.                      |
| debug         | function |              | You can debug state and errors.                                                                                   |

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

## License

MIT © [arenuzzz](https://github.com/arenuzzz)
