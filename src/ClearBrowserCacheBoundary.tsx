import React from 'react';

import {
  type ClearBrowserCacheErrorChecker,
  defaultErrorCheckers,
  isCacheError
} from './errorCheckers';
import type { UpdatePromptProps } from './updatePrompt';

export type ClearBrowserCacheStorage = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
};

/** @deprecated Unused since 1.0; kept so 0.x imports still compile. */
export type ClearBrowserCacheAppVersionStorage = {
  get: () => string;
  set: (version: string) => void;
};

export type ClearBrowserCacheDebugFunc = (params: {
  state: ClearBrowserCacheBoundaryState;
  error?: unknown;
  errorInfo?: React.ErrorInfo;
}) => void;

export type ClearBrowserCacheBoundaryState = {
  loading: boolean;
  isLatestVersion: boolean;
  latestVersion: string;
  disabled: boolean;
};

/**
 * What happens when a check finds a newer build while the app is on screen:
 * `prompt` shows `prompt`, `reload` reloads at once, `flag` only sets
 * `isLatestVersion` to false and leaves the rest to you.
 */
export type ClearBrowserCacheUpdateMode = 'prompt' | 'reload' | 'flag';

export type ClearBrowserCacheBoundaryProps = React.PropsWithChildren<{
  /** Defaults to `prompt` when a `prompt` is given, `flag` otherwise. */
  onUpdate?: ClearBrowserCacheUpdateMode;
  /** @deprecated Use `onUpdate="reload"`. */
  auto?: boolean;
  storageKey?: string;
  filename?: string;
  storage?: ClearBrowserCacheStorage;
  duration?: number;
  fallback?: React.ReactNode;
  debug?: ClearBrowserCacheDebugFunc;
  errorCheckers?: ClearBrowserCacheErrorChecker[];
  /**
   * Asks the user to reload. An element, or a component that receives
   * `UpdatePromptProps`.
   */
  prompt?: React.ReactNode | React.ComponentType<UpdatePromptProps>;
  /**
   * When a chunk of the old build fails to load, show `prompt` over the
   * fallback instead of reloading straight away.
   */
  promptOnChunkError?: boolean;
  /**
   * Reload into a newer build as soon as the tab goes to the background,
   * where the user cannot see it happen.
   */
  reloadWhenHidden?: boolean;
  /**
   * Asked before every reload the user did not start (`onUpdate="reload"`,
   * `reloadWhenHidden`, and the check on mount with `blocking={false}`);
   * return false to keep the page, e.g. while a form has unsaved changes.
   */
  canReload?: () => boolean;
  /**
   * Show `fallback` until the first version check answers. Off renders the
   * app at once and checks in the background.
   */
  blocking?: boolean;
}>;

export type ClearBrowserCacheContextValue = ClearBrowserCacheBoundaryState & {
  clearCacheAndReload: () => Promise<void>;
  dismissUpdate: () => void;
};

type ClearBrowserCacheProps = {
  children: (value: ClearBrowserCacheContextValue) => React.ReactNode;
};

type State = ClearBrowserCacheBoundaryState & {
  caughtError: { error: unknown; rethrow: boolean } | null;
  dismissedVersion: string | null;
};

type CheckResult = 'reloading' | 'outdated' | 'current' | 'failed';

// `guarded` reloads only if `canReload` agrees; `unattended` follows
// `onUpdate` and `reloadWhenHidden`.
type ReloadPolicy = 'always' | 'never' | 'guarded' | 'unattended';

const unknownVersion = 'latest';

const localStorageAdapter: ClearBrowserCacheStorage = {
  get: (key) => window.localStorage.getItem(key),
  set: (key, value) => window.localStorage.setItem(key, value)
};

const ClearBrowserCacheCtx = React.createContext<ClearBrowserCacheContextValue>(
  {} as ClearBrowserCacheContextValue
);

export function useClearBrowserCache() {
  return React.useContext(ClearBrowserCacheCtx);
}

export function ClearBrowserCache({ children }: ClearBrowserCacheProps) {
  return children(useClearBrowserCache());
}

function isUrlLike(filename: string) {
  return /^(\/|\.{1,2}\/|[a-z][a-z\d+.-]*:)/i.test(filename);
}

const componentTypes = new Set([
  Symbol.for('react.memo'),
  Symbol.for('react.forward_ref'),
  Symbol.for('react.lazy')
]);

// A ReactNode can be an object too (an element, a portal), so a component is
// told apart by being a function or one of React's component wrappers.
function isComponentType<P>(
  value: React.ReactNode | React.ComponentType<P>
): value is React.ComponentType<P> {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' &&
      value !== null &&
      componentTypes.has((value as { $$typeof?: symbol }).$$typeof!))
  );
}

function readStoredVersion(storage: ClearBrowserCacheStorage, key: string) {
  try {
    return { version: storage.get(key), disabled: false };
  } catch {
    return { version: null, disabled: true };
  }
}

export class ClearBrowserCacheBoundary extends React.Component<
  ClearBrowserCacheBoundaryProps,
  State
> {
  // Version whose assets the browser currently holds; null before the first
  // successful check on this device.
  appVersion: string | null = null;
  checkInterval: ReturnType<typeof setInterval> | null = null;
  lastCheckAt = 0;
  storageRead = false;
  storageEnabled = true;
  unmounted = false;

  // Storage is read after mount, not here: the server has none, and the first
  // client render has to match the server's HTML to hydrate.
  state: State = {
    loading: true,
    latestVersion: unknownVersion,
    disabled: false,
    isLatestVersion: true,
    caughtError: null,
    dismissedVersion: null
  };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { caughtError: { error, rethrow: false } };
  }

  get storage() {
    return this.props.storage ?? localStorageAdapter;
  }

  get storageKey() {
    return this.props.storageKey ?? 'APP_VERSION';
  }

  get metaUrl() {
    const filename = this.props.filename ?? 'meta.json';
    const url = new URL(
      isUrlLike(filename) ? filename : `/${filename}`,
      window.location.href
    );

    url.searchParams.set('time', String(Date.now()));

    return url.href;
  }

  // Returns whether storage works. Read once: StrictMode remounts the same
  // instance, and a second read would undo the first check's state. The answer
  // is kept in a field because `setState` has not landed yet when
  // `componentDidCatch` runs in the same commit as the first mount.
  readStorage() {
    if (!this.storageRead) {
      this.storageRead = true;

      const { version, disabled } = readStoredVersion(
        this.storage,
        this.storageKey
      );

      this.appVersion = version;
      this.storageEnabled = !disabled;
      this.setState({
        loading: !disabled,
        latestVersion: version ?? unknownVersion,
        disabled
      });
    }

    return this.storageEnabled;
  }

  componentDidMount() {
    // StrictMode unmounts and remounts the same instance in development.
    this.unmounted = false;
    const enabled = this.readStorage();
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('blur', this.stopVersionCheck);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // A blocking mount has shown nothing yet, so a stale build is reloaded
    // whatever `onUpdate` says. A non-blocking one is already interactive.
    if (enabled) {
      const reload = (this.props.blocking ?? true) ? 'always' : 'guarded';

      this.checkVersion({ reload }).then(() => {
        if (!this.unmounted && document.hasFocus()) {
          this.startVersionCheck();
        }
      });
    }

    this.debug();
  }

  componentDidUpdate(prevProps: ClearBrowserCacheBoundaryProps) {
    if (this.props.duration !== prevProps.duration && document.hasFocus()) {
      this.startVersionCheck();
    }

    this.debug();
  }

  componentWillUnmount() {
    this.unmounted = true;
    this.stopVersionCheck();

    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('blur', this.stopVersionCheck);
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange
    );
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    const errorCheckers = defaultErrorCheckers.concat(
      this.props.errorCheckers ?? []
    );

    // A child of a non-blocking boundary can fail before the boundary mounts.
    if (!this.readStorage() || !isCacheError(error, errorCheckers)) {
      this.rethrow(error);
      return;
    }

    const { promptOnChunkError, prompt } = this.props;
    const ask = Boolean(promptOnChunkError) && prompt != null;

    this.checkVersion({ reload: ask ? 'never' : 'always' }).then((result) => {
      this.debug(error, errorInfo);

      // 'outdated' only comes back with the prompt on, which now shows over
      // the fallback and lets the user decide.
      if (result !== 'reloading' && result !== 'outdated') {
        this.rethrow(error);
      }
    });
  }

  rethrow(error: unknown) {
    if (!this.unmounted) {
      this.setState({ caughtError: { error, rethrow: true } });
    }
  }

  dismissUpdate = () => {
    const { caughtError, latestVersion } = this.state;

    if (caughtError) {
      this.rethrow(caughtError.error);
    } else {
      this.setState({ dismissedVersion: latestVersion });
    }
  };

  debug = (error?: unknown, errorInfo?: React.ErrorInfo) => {
    const {
      caughtError: _caughtError,
      dismissedVersion: _dismissedVersion,
      ...state
    } = this.state;

    // A throwing debug callback must not break the version check that called it.
    try {
      this.props.debug?.({ state, error, errorInfo });
    } catch {
      // ignored on purpose
    }
  };

  // Polling stops while the window is in the background, so a tab left alone
  // for hours would otherwise wait a whole `duration` after coming back.
  handleFocus = () => {
    const { duration } = this.props;

    if (
      !this.state.disabled &&
      duration &&
      Date.now() - this.lastCheckAt >= duration
    ) {
      this.checkVersion();
    }

    this.startVersionCheck();
  };

  handleVisibilityChange = () => {
    const { loading, isLatestVersion, caughtError, disabled } = this.state;

    if (
      document.visibilityState !== 'hidden' ||
      !this.props.reloadWhenHidden ||
      disabled ||
      loading ||
      caughtError
    ) {
      return;
    }

    if (!isLatestVersion) {
      if (this.reloadAllowed()) {
        this.clearCacheAndReload();
      }
    } else if (this.props.duration) {
      // Polling stopped on blur, so a deploy since the last poll is not known
      // yet; checking now reloads into it while the tab is still hidden.
      this.checkVersion();
    }
  };

  reloadAllowed() {
    try {
      return this.props.canReload?.() ?? true;
    } catch (error) {
      this.debug(error);
      return false;
    }
  }

  startVersionCheck = () => {
    const { duration } = this.props;

    this.stopVersionCheck();

    if (!this.state.disabled && duration) {
      this.checkInterval = setInterval(() => {
        this.checkVersion();
      }, duration);
    }
  };

  stopVersionCheck = () => {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  };

  fetchLatestVersion = async (): Promise<string> => {
    const response = await fetch(this.metaUrl, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Failed to fetch app version: HTTP ${response.status}`);
    }

    // Servers with an SPA fallback answer a missing meta file with index.html
    // and a 200, so the status alone does not prove the file exists.
    const body = await response.text();

    if (/^\s*</.test(body)) {
      throw new Error('Failed to fetch app version: got HTML instead of JSON');
    }

    const { version } = JSON.parse(body) ?? {};

    if (typeof version !== 'string' || !version) {
      throw new Error('Failed to fetch app version: no "version" in meta');
    }

    return version;
  };

  clearCacheAndReload = async (version = this.state.latestVersion) => {
    try {
      if ('caches' in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      }
    } catch (error) {
      this.debug(error);
    }

    this.saveVersion(version);
    window.location.reload();
  };

  saveVersion(version: string) {
    this.appVersion = version;

    try {
      this.storage.set(this.storageKey, version);
    } catch (error) {
      this.debug(error);
    }
  }

  get updateMode(): ClearBrowserCacheUpdateMode {
    const { onUpdate, auto, prompt } = this.props;

    if (onUpdate) {
      return onUpdate;
    }

    if (auto) {
      return 'reload';
    }

    return prompt != null ? 'prompt' : 'flag';
  }

  // The guard is asked only once a newer build is known, so it sees the page
  // as it is at reload time and is not called on every poll.
  shouldReload(policy: ReloadPolicy) {
    switch (policy) {
      case 'always':
        return true;
      case 'never':
        return false;
      case 'guarded':
        return this.reloadAllowed();
      case 'unattended': {
        const wanted =
          this.updateMode === 'reload' ||
          (Boolean(this.props.reloadWhenHidden) &&
            document.visibilityState === 'hidden');

        return wanted && this.reloadAllowed();
      }
    }
  }

  checkVersion = async ({
    reload = 'unattended'
  }: { reload?: ReloadPolicy } = {}): Promise<CheckResult> => {
    this.lastCheckAt = Date.now();

    try {
      const latestVersion = await this.fetchLatestVersion();

      // First visit on this device: nothing is cached from an older build yet.
      if (this.appVersion === null) {
        this.saveVersion(latestVersion);
      }

      const isLatestVersion = latestVersion === this.appVersion;

      if (!isLatestVersion && this.shouldReload(reload)) {
        await this.clearCacheAndReload(latestVersion);
        return 'reloading';
      }

      this.updateState({ loading: false, latestVersion, isLatestVersion });

      return isLatestVersion ? 'current' : 'outdated';
    } catch (error) {
      this.debug(error);
      this.updateState({ loading: false });

      return 'failed';
    }
  };

  updateState(patch: Partial<ClearBrowserCacheBoundaryState>) {
    if (this.unmounted) {
      return;
    }

    const changed = (Object.keys(patch) as (keyof typeof patch)[]).some(
      (key) => patch[key] !== this.state[key]
    );

    if (changed) {
      this.setState(patch as State);
    }
  }

  clearCacheAndReloadFromContext = () => this.clearCacheAndReload();

  renderUpdatePrompt() {
    const { prompt } = this.props;
    const {
      caughtError,
      loading,
      isLatestVersion,
      latestVersion,
      dismissedVersion
    } = this.state;
    const reason = caughtError ? 'error' : 'poll';
    const dismissed = reason === 'poll' && latestVersion === dismissedVersion;

    // `reload` mode lands here only when `canReload` held the reload back,
    // so the user is asked instead.
    const silent = reason === 'poll' && this.updateMode === 'flag';

    if (prompt == null || silent || loading || isLatestVersion || dismissed) {
      return null;
    }

    if (!isComponentType(prompt)) {
      return prompt;
    }

    const Prompt = prompt;

    return (
      <Prompt
        latestVersion={latestVersion}
        reason={reason}
        reload={this.clearCacheAndReloadFromContext}
        dismiss={this.dismissUpdate}
      />
    );
  }

  render() {
    const { children, fallback = null, blocking = true } = this.props;
    const { caughtError, loading, isLatestVersion, latestVersion, disabled } =
      this.state;

    if (caughtError?.rethrow) {
      throw caughtError.error;
    }

    return (
      <ClearBrowserCacheCtx.Provider
        value={{
          loading,
          isLatestVersion,
          latestVersion,
          disabled,
          clearCacheAndReload: this.clearCacheAndReloadFromContext,
          dismissUpdate: this.dismissUpdate
        }}
      >
        {caughtError || (loading && blocking) ? fallback : children}
        {this.renderUpdatePrompt()}
      </ClearBrowserCacheCtx.Provider>
    );
  }
}

export default ClearBrowserCacheBoundary;
