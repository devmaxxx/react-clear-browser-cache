import React from 'react';
import ReactDOM from 'react-dom';
import ErrorBoundary from './ErrorBoundary';
import {
  ClearBrowserCacheBoundary,
  ClearBrowserCacheDebugFunc
} from 'react-clear-browser-cache';
import App from './App';

function formatData(data: any) {
  return (
    'data:' +
    JSON.stringify(data.state, null, 2) +
    ',\nerror: {\n  "error":' +
    data.error +
    '\n}'
  );
}

const debug: ClearBrowserCacheDebugFunc = (data) => {
  if (data.error) {
    console.log(formatData(data));
  }
};

ReactDOM.render(
  <ErrorBoundary>
    <ClearBrowserCacheBoundary
      fallback='Loading'
      auto
      duration={5 * 60 * 1000}
      debug={debug}
    >
      <App />
    </ClearBrowserCacheBoundary>
  </ErrorBoundary>,
  document.getElementById('root')
);
