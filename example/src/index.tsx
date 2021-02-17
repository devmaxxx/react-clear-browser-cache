import './index.css';

import React from 'react';
import ReactDOM from 'react-dom';
import { ClearBrowserCacheBoundary } from 'react-clear-browser-cache';
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

ReactDOM.render(
  <ClearBrowserCacheBoundary
    fallback='Loading'
    duration={4000}
    debug={(data) => {
      if (data.error) {
        console.log(formatData(data));
      }
    }}
  >
    <App />
  </ClearBrowserCacheBoundary>,
  document.getElementById('root')
);
