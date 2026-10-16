import { Suspense, lazy } from 'react';
import { lazyRetry, useClearBrowserCache } from 'react-clear-browser-cache';

const LazyComponent = lazy(() => lazyRetry(() => import('./Component'), 0));

export default function App({ loads }: { loads: number }) {
  const { isLatestVersion, latestVersion, clearCacheAndReload } =
    useClearBrowserCache();

  return (
    <main>
      <h1>react-clear-browser-cache</h1>
      <dl>
        <dt>Version</dt>
        <dd data-testid='version'>{latestVersion}</dd>
        <dt>Up to date</dt>
        <dd data-testid='is-latest'>{String(isLatestVersion)}</dd>
        <dt>Page loads</dt>
        <dd data-testid='loads'>{loads}</dd>
      </dl>
      {!isLatestVersion && (
        <button type='button' onClick={clearCacheAndReload}>
          Update
        </button>
      )}
      <Suspense fallback={<p>Loading component…</p>}>
        <LazyComponent>Lazy component</LazyComponent>
      </Suspense>
    </main>
  );
}
