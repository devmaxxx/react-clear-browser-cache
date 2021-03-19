import React from 'react';
import ReactDOM from 'react-dom';
import ErrorBoundary from './ErrorBoundary';
import {
  ClearBrowserCacheBoundary,
  ClearBrowserCacheDebugFunc
} from 'react-clear-browser-cache';
import App from './App';

const debug: ClearBrowserCacheDebugFunc = (data) => {
  console.log(data);
};

ReactDOM.render(
  <ErrorBoundary>
    <ClearBrowserCacheBoundary
      fallback='Loading...'
      auto
      duration={5000}
      // duration={5 * 60 * 1000}
      debug={debug}
    >
      <App />
    </ClearBrowserCacheBoundary>
  </ErrorBoundary>,
  document.getElementById('root')
);
