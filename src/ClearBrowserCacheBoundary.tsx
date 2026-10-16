import React from 'react';

import {
  type ClearBrowserCacheErrorChecker,
  defaultErrorCheckers,
  isCacheError
} from './errorCheckers';

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
}>;

export type ClearBrowserCacheContextValue = ClearBrowserCacheBoundaryState & {
  clearCacheAndReload: () => Promise<void>;
};

type ClearBrowserCacheProps = {
  children: (value: ClearBrowserCacheContextValue) => React.ReactNode;
};

type State = ClearBrowserCacheBoundaryState & {
  caughtError: { error: unknown; rethrow: boolean } | null;
};

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
      caughtError: null
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
    window.addEventListener('focus', this.startVersionCheck);
    window.addEventListener('blur', this.stopVersionCheck);

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
    const { duration, auto } = this.props;
    const pollingChanged =
      duration !== prevProps.duration || auto !== prevProps.auto;

    if (pollingChanged && document.hasFocus()) {
      this.startVersionCheck();
    }

    this.debug();
  }

  componentWillUnmount() {
    this.unmounted = true;
    this.stopVersionCheck();

    window.removeEventListener('focus', this.startVersionCheck);
    window.removeEventListener('blur', this.stopVersionCheck);
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    const errorCheckers = defaultErrorCheckers.concat(
      this.props.errorCheckers ?? []
    );

    if (this.state.disabled || !isCacheError(error, errorCheckers)) {
      this.rethrow(error);
      return;
    }

    this.checkVersion({ auto: true }).then((reloading) => {
      this.debug(error, errorInfo);

      if (!reloading) {
        this.rethrow(error);
      }
    });
  }

  rethrow(error: unknown) {
    if (!this.unmounted) {
      this.setState({ caughtError: { error, rethrow: true } });
    }
  }

  debug = (error?: unknown, errorInfo?: React.ErrorInfo) => {
    const { caughtError: _caughtError, ...state } = this.state;

    // A throwing debug callback must not break the version check that called it.
    try {
      this.props.debug?.({ state, error, errorInfo });
    } catch {
      // ignored on purpose
    }
  };

  startVersionCheck = () => {
    const { duration, auto = false } = this.props;

    this.stopVersionCheck();

    if (!this.state.disabled && duration) {
      this.checkInterval = setInterval(() => {
        this.checkVersion({ auto });
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

  /** Resolves to true when a page reload was started. */
  checkVersion = async ({ auto = this.props.auto ?? false } = {}) => {
    try {
      const latestVersion = await this.fetchLatestVersion();

      // First visit on this device: nothing is cached from an older build yet.
      if (this.appVersion === null) {
        this.saveVersion(latestVersion);
      }

      const isLatestVersion = latestVersion === this.appVersion;

      if (!isLatestVersion && auto) {
        await this.clearCacheAndReload(latestVersion);
        return true;
      }

      this.updateState({ loading: false, latestVersion, isLatestVersion });
    } catch (error) {
      this.debug(error);
      this.updateState({ loading: false });
    }

    return false;
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

  render() {
    const { children, fallback = null } = this.props;
    const { caughtError, loading, isLatestVersion, latestVersion, disabled } =
      this.state;

    if (caughtError?.rethrow) {
      throw caughtError.error;
    }

    if (caughtError || loading) {
      return fallback;
    }

    return (
      <ClearBrowserCacheCtx.Provider
        value={{
          loading,
          isLatestVersion,
          latestVersion,
          disabled,
          clearCacheAndReload: this.clearCacheAndReloadFromContext
        }}
      >
        {children}
      </ClearBrowserCacheCtx.Provider>
    );
  }
}

export default ClearBrowserCacheBoundary;
