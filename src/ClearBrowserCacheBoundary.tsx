import React from 'react';

import {
  type ClearBrowserCacheErrorChecker,
  defaultErrorCheckers,
  isCacheError
} from './errorCheckers';
import type { UpdatePromptProps } from './UpdatePrompt';

export type ClearBrowserCacheStorage = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
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

export type ClearBrowserCacheBoundaryProps = React.PropsWithChildren<{
  auto?: boolean;
  storageKey?: string;
  filename?: string;
  storage?: ClearBrowserCacheStorage;
  duration?: number;
  fallback?: React.ReactNode;
  debug?: ClearBrowserCacheDebugFunc;
  errorCheckers?: ClearBrowserCacheErrorChecker[];
  /**
   * Shown when a newer build is found and the page is not reloaded on its own.
   * An element, or a component that receives `UpdatePromptProps`.
   */
  updatePrompt?: React.ReactNode | React.ComponentType<UpdatePromptProps>;
  /**
   * When a stale-build error hits, show `updatePrompt` over the fallback
   * instead of reloading straight away.
   */
  promptOnError?: boolean;
  /**
   * Reload into a newer build as soon as the tab goes to the background,
   * where the user cannot see it happen.
   */
  reloadWhenHidden?: boolean;
  /**
   * Asked before every reload the user did not start (`auto`,
   * `reloadWhenHidden`); return false to keep the page, e.g. while a form has
   * unsaved changes.
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
  appVersion: string | null;
  checkInterval: ReturnType<typeof setInterval> | null = null;
  lastCheckAt = 0;
  unmounted = false;

  constructor(props: ClearBrowserCacheBoundaryProps) {
    super(props);

    const { version, disabled } = readStoredVersion(
      this.storage,
      this.storageKey
    );

    this.appVersion = version;
    this.state = {
      loading: !disabled,
      latestVersion: version ?? unknownVersion,
      disabled,
      isLatestVersion: true,
      caughtError: null,
      dismissedVersion: null
    };
  }

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

  componentDidMount() {
    // StrictMode unmounts and remounts the same instance in development.
    this.unmounted = false;
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('blur', this.stopVersionCheck);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Nothing has been shown yet, so a stale build is reloaded on mount even
    // without `auto`.
    if (!this.state.disabled) {
      this.checkVersion({ auto: true }).then(() => {
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

    if (this.state.disabled || !isCacheError(error, errorCheckers)) {
      this.rethrow(error);
      return;
    }

    const { promptOnError, updatePrompt } = this.props;
    const prompt = Boolean(promptOnError) && updatePrompt != null;

    this.checkVersion({ auto: !prompt }).then((result) => {
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
      document.visibilityState === 'hidden' &&
      this.props.reloadWhenHidden &&
      !disabled &&
      !loading &&
      !isLatestVersion &&
      !caughtError &&
      this.reloadAllowed()
    ) {
      this.clearCacheAndReload();
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

  // The guard is asked only once a newer build is known, so it sees the page
  // as it is at reload time and is not called on every poll.
  unattendedReloadAllowed() {
    const { auto, reloadWhenHidden } = this.props;
    const wanted =
      Boolean(auto) ||
      (Boolean(reloadWhenHidden) && document.visibilityState === 'hidden');

    return wanted && this.reloadAllowed();
  }

  checkVersion = async ({
    auto
  }: { auto?: boolean } = {}): Promise<CheckResult> => {
    this.lastCheckAt = Date.now();

    try {
      const latestVersion = await this.fetchLatestVersion();

      // First visit on this device: nothing is cached from an older build yet.
      if (this.appVersion === null) {
        this.saveVersion(latestVersion);
      }

      const isLatestVersion = latestVersion === this.appVersion;

      if (!isLatestVersion && (auto ?? this.unattendedReloadAllowed())) {
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
    const { updatePrompt } = this.props;
    const {
      caughtError,
      loading,
      isLatestVersion,
      latestVersion,
      dismissedVersion
    } = this.state;
    const reason = caughtError ? 'error' : 'poll';
    const dismissed = reason === 'poll' && latestVersion === dismissedVersion;

    if (updatePrompt == null || loading || isLatestVersion || dismissed) {
      return null;
    }

    if (!isComponentType(updatePrompt)) {
      return updatePrompt;
    }

    const Prompt = updatePrompt;

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
