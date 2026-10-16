import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';

import {
  ClearBrowserCache,
  ClearBrowserCacheBoundary,
  type ClearBrowserCacheBoundaryProps,
  type ClearBrowserCacheStorage,
  useClearBrowserCache
} from '../src';

const STORAGE_KEY = 'APP_VERSION';

function metaResponse(version: string) {
  return new Response(JSON.stringify({ version }), {
    headers: { 'content-type': 'application/json' }
  });
}

function mockFetch(...responses: (() => Response)[]) {
  const fetchMock = vi.fn(async (_url: string) => {
    const next = responses.length > 1 ? responses.shift()! : responses[0];
    return next();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function VersionState() {
  const { loading, isLatestVersion, latestVersion, disabled } =
    useClearBrowserCache();

  return (
    <dl>
      <dt>loading</dt>
      <dd data-testid='loading'>{String(loading)}</dd>
      <dt>isLatestVersion</dt>
      <dd data-testid='isLatestVersion'>{String(isLatestVersion)}</dd>
      <dt>latestVersion</dt>
      <dd data-testid='latestVersion'>{latestVersion}</dd>
      <dt>disabled</dt>
      <dd data-testid='disabled'>{String(disabled)}</dd>
    </dl>
  );
}

function renderBoundary(props: ClearBrowserCacheBoundaryProps = {}) {
  return render(
    <ClearBrowserCacheBoundary fallback='Checking version' {...props}>
      {props.children ?? <VersionState />}
    </ClearBrowserCacheBoundary>
  );
}

class Catcher extends React.Component<
  React.PropsWithChildren,
  { error: unknown }
> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <p role='alert'>Caught: {String(this.state.error)}</p>;
    }
    return this.props.children;
  }
}

function Thrower({ error }: { error: Error }): React.ReactNode {
  throw error;
}

function chunkError() {
  const error = new Error('Loading chunk 3 failed.');
  error.name = 'ChunkLoadError';
  return error;
}

describe('ClearBrowserCacheBoundary', () => {
  beforeEach(() => {
    // React logs every caught render error; the tests assert on the outcome.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('shows the fallback until the version is known', async () => {
    mockFetch(() => metaResponse('v1'));

    renderBoundary();

    expect(screen.getByText('Checking version')).toBeInTheDocument();
    expect(await screen.findByTestId('latestVersion')).toHaveTextContent('v1');
  });

  it('records the version on the first visit without reloading', async () => {
    mockFetch(() => metaResponse('v1'));

    renderBoundary();

    expect(await screen.findByTestId('isLatestVersion')).toHaveTextContent(
      'true'
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v1');
  });

  it('fetches the meta file from the site root, bypassing the HTTP cache', async () => {
    const fetchMock = mockFetch(() => metaResponse('v1'));

    renderBoundary({ filename: 'build-meta.json' });

    await screen.findByTestId('latestVersion');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(new URL(url).pathname).toBe('/build-meta.json');
    expect(new URL(url).searchParams.has('time')).toBe(true);
    expect(init.cache).toBe('no-store');
  });

  it('resolves a relative filename against the page, for apps under a sub-path', async () => {
    window.history.replaceState(null, '', '/my-app/');
    const fetchMock = mockFetch(() => metaResponse('v1'));

    renderBoundary({ filename: './meta.json' });

    await screen.findByTestId('latestVersion');
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe(
      '/my-app/meta.json'
    );
    window.history.replaceState(null, '', '/');
  });

  it('uses a custom storage and key', async () => {
    const values = new Map<string, string>();
    const storage: ClearBrowserCacheStorage = {
      get: (key) => values.get(key) ?? null,
      set: (key, value) => void values.set(key, value)
    };
    mockFetch(() => metaResponse('v1'));

    renderBoundary({ storage, storageKey: 'build' });

    await screen.findByTestId('latestVersion');
    expect(values.get('build')).toBe('v1');
    expect(window.localStorage.length).toBe(0);
  });

  it('renders the app when the stored version is current', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'v1');
    mockFetch(() => metaResponse('v1'));

    renderBoundary();

    expect(await screen.findByTestId('isLatestVersion')).toHaveTextContent(
      'true'
    );
  });

  it('stores the new version and leaves the fallback up when a mount check finds a new build', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'v1');
    mockFetch(() => metaResponse('v2'));

    renderBoundary();

    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v2')
    );
    expect(screen.getByText('Checking version')).toBeInTheDocument();
  });

  it.each([
    [
      'the server answers with index.html (SPA fallback)',
      () =>
        new Response('<!doctype html><html><body></body></html>', {
          headers: { 'content-type': 'text/html' }
        }),
      /got HTML/
    ],
    [
      'the meta file is missing',
      () => new Response('Not found', { status: 404 }),
      /HTTP 404/
    ],
    ['the meta file has no version', () => new Response('{}'), /no "version"/]
  ])(
    'renders the app and reports the error when %s',
    async (_label, respond, message) => {
      window.localStorage.setItem(STORAGE_KEY, 'v1');
      mockFetch(respond);
      const debug = vi.fn();

      renderBoundary({ debug });

      expect(await screen.findByTestId('loading')).toHaveTextContent('false');
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v1');
      expect(debug).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringMatching(message)
          })
        })
      );
    }
  );

  it('disables itself when storage is unavailable', () => {
    const fetchMock = mockFetch(() => metaResponse('v1'));
    const storage: ClearBrowserCacheStorage = {
      get: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      set: () => {}
    };

    renderBoundary({ storage, duration: 10 });

    expect(screen.getByTestId('disabled')).toHaveTextContent('true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders the app even when the debug callback throws', async () => {
    mockFetch(() => new Response('Not found', { status: 404 }));

    renderBoundary({
      debug: () => {
        throw new Error('broken logger');
      }
    });

    expect(await screen.findByTestId('loading')).toHaveTextContent('false');
  });

  describe('polling', () => {
    beforeEach(() => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    });

    it('starts polling when `duration` arrives after mount', async () => {
      window.localStorage.setItem(STORAGE_KEY, 'v1');
      const fetchMock = mockFetch(() => metaResponse('v1'));

      const { rerender } = renderBoundary();
      await screen.findByTestId('latestVersion');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      rerender(
        <ClearBrowserCacheBoundary duration={10}>
          <VersionState />
        </ClearBrowserCacheBoundary>
      );

      await waitFor(() =>
        expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
      );
    });

    it('flags a new build without reloading when `auto` is off', async () => {
      window.localStorage.setItem(STORAGE_KEY, 'v1');
      mockFetch(
        () => metaResponse('v1'),
        () => metaResponse('v2')
      );

      renderBoundary({ duration: 10 });

      await waitFor(() =>
        expect(screen.getByTestId('isLatestVersion')).toHaveTextContent('false')
      );
      expect(screen.getByTestId('latestVersion')).toHaveTextContent('v2');
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v1');
    });

    it('stops while the window is blurred and resumes on focus', async () => {
      window.localStorage.setItem(STORAGE_KEY, 'v1');
      const fetchMock = mockFetch(() => metaResponse('v1'));

      renderBoundary({ duration: 10 });
      await waitFor(() =>
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
      );

      fireEvent.blur(window);
      const callsAtBlur = fetchMock.mock.calls.length;
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(fetchMock).toHaveBeenCalledTimes(callsAtBlur);

      fireEvent.focus(window);
      fireEvent.focus(window);
      await waitFor(() =>
        expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAtBlur)
      );

      // Two focus events must not leave two timers behind.
      fireEvent.blur(window);
      const callsAtSecondBlur = fetchMock.mock.calls.length;
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(fetchMock).toHaveBeenCalledTimes(callsAtSecondBlur);
    });

    it('stops polling after unmount', async () => {
      window.localStorage.setItem(STORAGE_KEY, 'v1');
      const fetchMock = mockFetch(() => metaResponse('v1'));

      const { unmount } = renderBoundary({ duration: 10 });
      await waitFor(() =>
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
      );

      unmount();
      const callsAtUnmount = fetchMock.mock.calls.length;
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(fetchMock).toHaveBeenCalledTimes(callsAtUnmount);
    });
  });

  describe('render errors', () => {
    it('passes unrelated errors to the parent boundary', async () => {
      window.localStorage.setItem(STORAGE_KEY, 'v1');
      const fetchMock = mockFetch(() => metaResponse('v1'));

      render(
        <Catcher>
          <ClearBrowserCacheBoundary>
            <Thrower error={new TypeError('x is undefined')} />
          </ClearBrowserCacheBoundary>
        </Catcher>
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'TypeError: x is undefined'
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('passes a chunk error on when the build has not changed', async () => {
      window.localStorage.setItem(STORAGE_KEY, 'v1');
      const fetchMock = mockFetch(() => metaResponse('v1'));

      render(
        <Catcher>
          <ClearBrowserCacheBoundary>
            <Thrower error={chunkError()} />
          </ClearBrowserCacheBoundary>
        </Catcher>
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'ChunkLoadError: Loading chunk 3 failed.'
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('stores the new build and shows the fallback when a chunk error comes from a stale build', async () => {
      window.localStorage.setItem(STORAGE_KEY, 'v1');
      mockFetch(
        () => metaResponse('v1'),
        () => metaResponse('v2')
      );

      function LoadsLater() {
        const { loading } = useClearBrowserCache();
        if (!loading) {
          throw chunkError();
        }
        return null;
      }

      render(
        <Catcher>
          <ClearBrowserCacheBoundary fallback='Updating'>
            <LoadsLater />
          </ClearBrowserCacheBoundary>
        </Catcher>
      );

      await waitFor(() =>
        expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v2')
      );
      expect(screen.getByText('Updating')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('treats errors matched by custom checkers as cache errors', async () => {
      window.localStorage.setItem(STORAGE_KEY, 'v1');
      const fetchMock = mockFetch(() => metaResponse('v1'));

      render(
        <Catcher>
          <ClearBrowserCacheBoundary
            errorCheckers={[(error) => String(error).includes('stale')]}
          >
            <Thrower error={new Error('stale asset')} />
          </ClearBrowserCacheBoundary>
        </Catcher>
      );

      await screen.findByRole('alert');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});

describe('ClearBrowserCache', () => {
  it('passes the context value to its render prop', async () => {
    mockFetch(() => metaResponse('v1'));

    render(
      <ClearBrowserCacheBoundary>
        <ClearBrowserCache>
          {({ latestVersion, clearCacheAndReload }) => (
            <p>
              {latestVersion} {typeof clearCacheAndReload}
            </p>
          )}
        </ClearBrowserCache>
      </ClearBrowserCacheBoundary>
    );

    expect(await screen.findByText('v1 function')).toBeInTheDocument();
  });
});
