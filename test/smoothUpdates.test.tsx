import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';

import { STORAGE_KEY, metaResponse, mockFetch } from './helpers';
import {
  ClearBrowserCacheBoundary,
  type ClearBrowserCacheBoundaryProps,
  useClearBrowserCache
} from '../src';

function VersionState() {
  const { loading, isLatestVersion } = useClearBrowserCache();

  return (
    <p>
      <span data-testid='loading'>{String(loading)}</span>
      <span data-testid='isLatestVersion'>{String(isLatestVersion)}</span>
    </p>
  );
}

function renderBoundary(props: ClearBrowserCacheBoundaryProps = {}) {
  return render(
    <ClearBrowserCacheBoundary fallback='Checking version' {...props}>
      <VersionState />
    </ClearBrowserCacheBoundary>
  );
}

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  fireEvent(document, new Event('visibilitychange'));
}

const wait = (ms: number) =>
  act(() => new Promise((resolve) => setTimeout(resolve, ms)));

async function waitUntilOutdated() {
  await waitFor(() =>
    expect(screen.getByTestId('isLatestVersion')).toHaveTextContent('false')
  );
}

beforeEach(() => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  window.localStorage.setItem(STORAGE_KEY, 'v1');
});

describe('checking when the user comes back', () => {
  it('checks at once on focus when a whole `duration` has passed', async () => {
    const fetchMock = mockFetch(() => metaResponse('v1'));
    const now = vi.spyOn(Date, 'now');

    renderBoundary({ duration: 60_000 });
    await screen.findByTestId('isLatestVersion');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.blur(window);
    now.mockReturnValue(Date.now() + 60_000 * 60);
    fireEvent.focus(window);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('waits for the timer when the last check was recent', async () => {
    const fetchMock = mockFetch(() => metaResponse('v1'));

    renderBoundary({ duration: 60_000 });
    await screen.findByTestId('isLatestVersion');

    fireEvent.blur(window);
    fireEvent.focus(window);
    await wait(30);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not check on focus without `duration`', async () => {
    const fetchMock = mockFetch(() => metaResponse('v1'));

    renderBoundary();
    await screen.findByTestId('isLatestVersion');

    fireEvent.focus(window);
    await wait(30);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('reloadWhenHidden', () => {
  it('reloads into the new build when the tab is hidden', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    renderBoundary({ duration: 10, reloadWhenHidden: true });
    await waitUntilOutdated();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v1');

    setVisibility('hidden');

    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v2')
    );
  });

  it('reloads when a check finds a new build after the tab went hidden', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    renderBoundary({ duration: 10, reloadWhenHidden: true });
    await screen.findByTestId('isLatestVersion');
    setVisibility('hidden');
    fireEvent.focus(window);

    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v2')
    );
  });

  it('leaves a current build alone', async () => {
    mockFetch(() => metaResponse('v1'));
    const caches = { keys: vi.fn(async () => []), delete: vi.fn() };
    vi.stubGlobal('caches', caches);

    renderBoundary({ duration: 10, reloadWhenHidden: true });
    await screen.findByTestId('isLatestVersion');

    setVisibility('hidden');
    await wait(30);

    expect(caches.keys).not.toHaveBeenCalled();
  });

  it('is off by default', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    renderBoundary({ duration: 10 });
    await waitUntilOutdated();

    setVisibility('hidden');
    await wait(30);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v1');
  });
});

describe('canReload', () => {
  it('keeps the page when `auto` finds a new build', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    renderBoundary({ duration: 10, auto: true, canReload: () => false });
    await waitUntilOutdated();
    await wait(30);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v1');
  });

  it('keeps the page when the tab is hidden', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    renderBoundary({
      duration: 10,
      reloadWhenHidden: true,
      canReload: () => false
    });
    await waitUntilOutdated();

    setVisibility('hidden');
    await wait(30);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v1');
  });

  it('counts a throwing guard as a no', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );
    const debug = vi.fn();

    renderBoundary({
      duration: 10,
      auto: true,
      debug,
      canReload: () => {
        throw new Error('guard failed');
      }
    });
    await waitUntilOutdated();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v1');
    expect(debug).toHaveBeenCalledWith(
      expect.objectContaining({ error: new Error('guard failed') })
    );
  });

  it('does not ask the guard while the build is current', async () => {
    mockFetch(() => metaResponse('v1'));
    const canReload = vi.fn(() => true);

    renderBoundary({ duration: 10, auto: true, canReload });
    await screen.findByTestId('isLatestVersion');
    await wait(40);

    expect(canReload).not.toHaveBeenCalled();
  });

  it('reloads once the guard allows it', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );
    let dirty = true;

    renderBoundary({ duration: 10, auto: true, canReload: () => !dirty });
    await waitUntilOutdated();

    dirty = false;

    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v2')
    );
  });
});

describe('blocking', () => {
  it('renders the app at once when off', () => {
    mockFetch(() => metaResponse('v1'));

    renderBoundary({ blocking: false });

    expect(screen.queryByText('Checking version')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('still reloads a stale build found on mount', async () => {
    mockFetch(() => metaResponse('v2'));

    renderBoundary({ blocking: false });

    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v2')
    );
  });
});
