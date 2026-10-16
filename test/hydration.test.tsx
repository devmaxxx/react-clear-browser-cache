import React from 'react';
import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import { STORAGE_KEY, metaResponse, mockFetch } from './helpers';
import { ClearBrowserCacheBoundary, useClearBrowserCache } from '../src';

function Version() {
  const { latestVersion } = useClearBrowserCache();

  return <p data-testid='version'>{latestVersion}</p>;
}

it('hydrates server HTML without a mismatch when a version is stored', async () => {
  window.localStorage.setItem(STORAGE_KEY, 'v1');
  mockFetch(() => metaResponse('v1'));
  const app = (
    <ClearBrowserCacheBoundary blocking={false}>
      <Version />
    </ClearBrowserCacheBoundary>
  );
  const container = document.createElement('div');
  container.innerHTML = renderToString(app);
  document.body.append(container);
  const onRecoverableError = vi.fn();
  const consoleError = vi.spyOn(console, 'error');

  const root = await act(async () =>
    hydrateRoot(container, app, { onRecoverableError })
  );

  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(consoleError).not.toHaveBeenCalled();
  expect(container).toHaveTextContent('v1');

  act(() => root.unmount());
  container.remove();
});
