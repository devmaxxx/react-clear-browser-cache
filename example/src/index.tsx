import React from 'react';
import ReactDOM from 'react-dom';
import ErrorBoundary from './ErrorBoundary';
import {
  ClearBrowserCacheBoundary,
  ClearBrowserCacheDebugFunc
} from 'react-clear-browser-cache';
import engine from 'store/src/store-engine';
//@ts-ignore
import allStorages from 'store/storages/all';

import App from './App';

// create store
const store = engine.createStore(allStorages, []);

const debug: ClearBrowserCacheDebugFunc = (data) => {
  console.log(data);
};

ReactDOM.render(
  <ErrorBoundary>
    <ClearBrowserCacheBoundary
      fallback='Loading...'
      auto
      duration={5000}
      //@ts-ignore
      storage={store}
      // duration={5 * 60 * 1000}
      debug={debug}
    >
      <App />
    </ClearBrowserCacheBoundary>
  </ErrorBoundary>,
  document.getElementById('root')
);
