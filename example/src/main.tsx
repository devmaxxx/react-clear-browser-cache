import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ClearBrowserCacheBoundary,
  type ClearBrowserCacheDebugFunc
} from 'react-clear-browser-cache';

import App from './App';
import ErrorBoundary from './ErrorBoundary';
import { UpdateDialog } from './UpdateDialog';

if (import.meta.env.VITE_DEMO === '1') {
  // The GitHub Pages build, which simulates deploys in the browser.
  void import('./demo/main');
} else {
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
          onUpdate={params.get('auto') === '1' ? 'reload' : undefined}
          duration={Number(params.get('duration')) || undefined}
          filename={`${import.meta.env.BASE_URL}meta.json`}
          debug={debug}
          prompt={params.get('prompt') === '1' ? UpdateDialog : undefined}
          promptOnChunkError={params.get('promptOnChunkError') === '1'}
        >
          <App loads={loads} />
        </ClearBrowserCacheBoundary>
      </ErrorBoundary>
    </StrictMode>
  );
}
