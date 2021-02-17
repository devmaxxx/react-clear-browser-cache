import './index.css';

import React from 'react';
import ReactDOM from 'react-dom';
import { ClearBrowserCacheBoundary } from 'react-clear-browser-cache';
import App from './App';

ReactDOM.render(
  <ClearBrowserCacheBoundary
    fallback='Loading'
    duration={4000}
    debug={(state: any) => console.log('state', state)}
  >
    <App />
  </ClearBrowserCacheBoundary>,
  document.getElementById('root')
);
