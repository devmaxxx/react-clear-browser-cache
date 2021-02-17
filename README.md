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

Add `ClearBrowserCacheBoundary` after your `ErrorBoundary`

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

## License

MIT © [arenuzzz](https://github.com/arenuzzz)
