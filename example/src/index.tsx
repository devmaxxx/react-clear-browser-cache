import './index.css';

import React from 'react';
import ReactDOM from 'react-dom';
import { ClearBrowserCacheProvider } from 'react-clear-browser-cache';
import App from './App';

ReactDOM.render(
  <ClearBrowserCacheProvider fallback='Loading'>
    <App />
  </ClearBrowserCacheProvider>,
  document.getElementById('root')
);
