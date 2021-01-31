import './index.css';

import React from 'react';
import ReactDOM from 'react-dom';
import { ClearBrowserCache } from 'react-clear-browser-cache';
import App from './App';

ReactDOM.render(
  <ClearBrowserCache>
    <App />
  </ClearBrowserCache>,
  document.getElementById('root')
);
