// @vitest-environment node
import React from 'react';
import { renderToString } from 'react-dom/server';

import { ClearBrowserCacheBoundary } from '../src';

describe('server rendering', () => {
  it('renders the fallback without touching browser globals', () => {
    const html = renderToString(
      <ClearBrowserCacheBoundary
        fallback='Checking version'
        prompt={<p>Update</p>}
      >
        <p>App</p>
      </ClearBrowserCacheBoundary>
    );

    expect(html).toContain('Checking version');
    expect(html).not.toContain('App');
  });

  it('renders the app when not blocking', () => {
    const html = renderToString(
      <ClearBrowserCacheBoundary blocking={false}>
        <p>App</p>
      </ClearBrowserCacheBoundary>
    );

    expect(html).toContain('App');
  });
});
