import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ClearBrowserCacheBoundary,
  type ClearBrowserCacheDebugFunc
} from 'react-clear-browser-cache';

import App from './App';
import ErrorBoundary from './ErrorBoundary';

const params = new URLSearchParams(window.location.search);

// Counts real page loads across reloads, so the e2e suite can tell a reload
// from a re-render.
const loads = Number(sessionStorage.getItem('loads') ?? 0) + 1;
sessionStorage.setItem('loads', String(loads));

const debug: ClearBrowserCacheDebugFunc = (data) => {
  console.debug('[react-clear-browser-cache]', data);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ClearBrowserCacheBoundary
        fallback={<p>Checking for updates…</p>}
        auto={params.get('auto') === '1'}
        duration={Number(params.get('duration')) || undefined}
        filename={`${import.meta.env.BASE_URL}meta.json`}
        debug={debug}
      >
        <App loads={loads} />
      </ClearBrowserCacheBoundary>
    </ErrorBoundary>
  </StrictMode>
);
