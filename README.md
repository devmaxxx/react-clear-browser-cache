# react-clear-browser-cache

[![NPM](https://img.shields.io/npm/v/react-clear-browser-cache.svg)](https://www.npmjs.com/package/react-clear-browser-cache) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

```bash
npm install --save react-clear-browser-cache

or

yarn add react-clear-browser-cache
```

## Usage

```tsx
import React, { Component } from 'react';

import { ClearBrowserCacheBoundary } from 'react-clear-browser-cache';

import App from './App';
import ErrorBoundary from './ErrorBoundary';

class Example extends Component {
  render() {
    return (
      <ErrorBoundary>
        <ClearBrowserCacheBoundary
          fallback='Loading'
          auto
          duration={5 * 60 * 1000}
        >
          <App />
        </ClearBrowserCacheBoundary>
      </ErrorBoundary>
    );
  }
}
```

## License

MIT © [arenuzzz](https://github.com/arenuzzz)
