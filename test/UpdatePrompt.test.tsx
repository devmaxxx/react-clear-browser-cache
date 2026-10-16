import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  Catcher,
  STORAGE_KEY,
  Thrower,
  chunkError,
  metaResponse,
  mockFetch
} from './helpers';
import {
  ClearBrowserCacheBoundary,
  type ClearBrowserCacheBoundaryProps,
  UpdatePrompt,
  type UpdatePromptProps,
  useClearBrowserCache
} from '../src';

function RecordingPrompt({
  latestVersion,
  reason,
  dismiss
}: UpdatePromptProps) {
  return (
    <div role='status'>
      {reason}: {latestVersion}
      <button type='button' onClick={dismiss}>
        Dismiss
      </button>
    </div>
  );
}

function renderPolling(props: ClearBrowserCacheBoundaryProps) {
  return render(
    <ClearBrowserCacheBoundary duration={10} {...props}>
      <p>App</p>
    </ClearBrowserCacheBoundary>
  );
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  window.localStorage.setItem(STORAGE_KEY, 'v1');
});

describe('updatePrompt', () => {
  it('shows a prompt component next to the app when polling finds a new build', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    renderPolling({ updatePrompt: RecordingPrompt });

    expect(await screen.findByRole('status')).toHaveTextContent('poll: v2');
    expect(screen.getByText('App')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v1');
  });

  it('shows nothing while the build is current', async () => {
    const fetchMock = mockFetch(() => metaResponse('v1'));

    renderPolling({ updatePrompt: RecordingPrompt });

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(2));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('accepts memo-wrapped components', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    renderPolling({ updatePrompt: React.memo(RecordingPrompt) });

    expect(await screen.findByRole('status')).toHaveTextContent('poll: v2');
  });

  it('renders a plain element, which can dismiss through the hook', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    function Banner() {
      const { latestVersion, dismissUpdate } = useClearBrowserCache();
      return (
        <div role='status'>
          {latestVersion}
          <button type='button' onClick={dismissUpdate}>
            Dismiss
          </button>
        </div>
      );
    }

    renderPolling({ updatePrompt: <Banner /> });

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stays dismissed for that build and comes back for a newer one', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2'),
      () => metaResponse('v2'),
      () => metaResponse('v2'),
      () => metaResponse('v3')
    );

    renderPolling({ updatePrompt: RecordingPrompt });

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    expect(await screen.findByRole('status')).toHaveTextContent('poll: v3');
  });

  it('is skipped when `auto` reloads on its own', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    renderPolling({ auto: true, updatePrompt: RecordingPrompt });

    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v2')
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('promptOnError', () => {
  function renderWithChunkError(props: ClearBrowserCacheBoundaryProps) {
    return render(
      <Catcher>
        <ClearBrowserCacheBoundary fallback='Fallback' {...props}>
          <Thrower error={chunkError()} />
        </ClearBrowserCacheBoundary>
      </Catcher>
    );
  }

  it('shows the prompt over the fallback instead of reloading', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    renderWithChunkError({
      promptOnError: true,
      updatePrompt: RecordingPrompt
    });

    expect(await screen.findByRole('status')).toHaveTextContent('error: v2');
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v1');
  });

  it('hands the error to the parent boundary when dismissed', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    renderWithChunkError({
      promptOnError: true,
      updatePrompt: RecordingPrompt
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ChunkLoadError'
    );
  });

  it('passes the error on when the build has not changed', async () => {
    mockFetch(() => metaResponse('v1'));

    renderWithChunkError({
      promptOnError: true,
      updatePrompt: RecordingPrompt
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ChunkLoadError'
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('still reloads when it is off', async () => {
    mockFetch(
      () => metaResponse('v1'),
      () => metaResponse('v2')
    );

    renderWithChunkError({ updatePrompt: RecordingPrompt });

    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v2')
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('UpdatePrompt', () => {
  const baseProps: UpdatePromptProps = {
    latestVersion: 'v2',
    reason: 'poll',
    reload: async () => {},
    dismiss: () => {}
  };

  it('renders an open, labelled dialog with the reason-specific message', () => {
    render(<UpdatePrompt {...baseProps} reason='error' />);

    const dialog = screen.getByRole('dialog', {
      name: 'A new version is available'
    });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription(
      /could not load because a new version was released/
    );
  });

  it('moves focus to Reload', () => {
    render(<UpdatePrompt {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Reload' })).toHaveFocus();
  });

  it('dismisses on Escape', () => {
    const dismiss = vi.fn();
    render(<UpdatePrompt {...baseProps} dismiss={dismiss} />);

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true })
    );

    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('reloads once and locks its buttons while the page reloads', () => {
    const reload = vi.fn(async () => {});
    render(<UpdatePrompt {...baseProps} reload={reload} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Later' })).toBeDisabled();
  });

  it('ignores Escape once Reload was clicked', () => {
    const dismiss = vi.fn();
    render(<UpdatePrompt {...baseProps} dismiss={dismiss} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true })
    );

    expect(dismiss).not.toHaveBeenCalled();
  });

  it('dismisses on Escape when non-modal', () => {
    const dismiss = vi.fn();
    render(<UpdatePrompt {...baseProps} modal={false} dismiss={dismiss} />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Reload' }), {
      key: 'Escape'
    });

    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('gives focus back to where it was when it goes away', () => {
    function Page({ open }: { open: boolean }) {
      return (
        <>
          <button type='button'>Save form</button>
          {open && <UpdatePrompt {...baseProps} />}
        </>
      );
    }
    const { rerender } = render(<Page open={false} />);
    screen.getByRole('button', { name: 'Save form' }).focus();

    rerender(<Page open />);
    expect(screen.getByRole('button', { name: 'Reload' })).toHaveFocus();

    rerender(<Page open={false} />);
    expect(screen.getByRole('button', { name: 'Save form' })).toHaveFocus();
  });

  it('keeps focus on Reload under StrictMode', () => {
    render(
      <React.StrictMode>
        <UpdatePrompt {...baseProps} />
      </React.StrictMode>
    );

    expect(screen.getByRole('button', { name: 'Reload' })).toHaveFocus();
  });

  it('takes custom text', () => {
    render(
      <UpdatePrompt
        {...baseProps}
        title='Update ready'
        message='Refresh to continue.'
        reloadLabel='Refresh'
        dismissLabel='Not now'
      />
    );

    expect(
      screen.getByRole('dialog', { name: 'Update ready' })
    ).toHaveAccessibleDescription('Refresh to continue.');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
  });
});
