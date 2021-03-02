import React from 'react';

export type ClearBrowserCacheStorage = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
};

export type ClearBrowserCacheAppVersionStorage = {
  get: () => string | null;
  set: (version: string) => void;
};

export type ClearBrowserCacheDebugFunc = (params: {
  state?: ClearBrowserCacheBoundaryState;
  error?: Error;
}) => void;

export type ClearBrowserCacheErrorChecker = (error: Error) => boolean;

export type ClearBrowserCacheBoundaryState = {
  loading: boolean;
  isLatestVersion: boolean;
  hasExternalError: boolean;
  latestVersion: string;
};

export type ClearBrowserCacheBoundaryProps = {
  auto: boolean;
  storageKey: string;
  filename: string;
  storage: Storage;
  duration?: number;
  fallback?: any;
  debug?: ClearBrowserCacheDebugFunc;
  errorCheckers?: ClearBrowserCacheErrorChecker[];
};

type CtxValue = ClearBrowserCacheBoundaryState & {
  clearCacheAndReload: () => Promise<void>;
};

type ClearBrowserCacheProps = {
  children: (value: CtxValue) => any;
};

export function createErrorChecker(name: string, regexpForMesssage: RegExp) {
  return function (error: Error): boolean {
    return (
      error.name === name && Boolean(error.message.match(regexpForMesssage))
    );
  };
}

const chunkFailedMessageRegex = /Loading chunk [\d]+ failed/;
const syntaxErrorMessageRegex = /['"\s]<['"\s]/;

const defaultErrorCheckers: ClearBrowserCacheErrorChecker[] = [
  createErrorChecker('ChunkLoadError', chunkFailedMessageRegex),
  createErrorChecker('SyntaxError', syntaxErrorMessageRegex)
];

const storageKey = 'APP_VERSION';
const filename = 'meta.json';

const defaultProps = {
  errorCheckers: [],
  auto: false,
  storageKey,
  filename,
  storage: {
    get: localStorage.getItem.bind(localStorage),
    set: localStorage.setItem.bind(localStorage)
  }
};

const ClearBrowserCacheCtx = React.createContext<CtxValue>({} as CtxValue);

export function useClearBrowserCache() {
  return React.useContext(ClearBrowserCacheCtx);
}

export function ClearBrowserCache({ children }: ClearBrowserCacheProps) {
  const ctx = useClearBrowserCache();

  return children(ctx);
}

function createStorage(
  storageKey: string,
  storage: ClearBrowserCacheStorage
): ClearBrowserCacheAppVersionStorage {
  return {
    set(version) {
      storage.set(storageKey, version);
    },
    get() {
      return storage.get(storageKey);
    }
  };
}

export class ClearBrowserCacheBoundary extends React.Component<
  React.PropsWithChildren<ClearBrowserCacheBoundaryProps>,
  ClearBrowserCacheBoundaryState
> {
  static defaultProps = defaultProps;

  appVersionStorage: ClearBrowserCacheAppVersionStorage;
  checkInterval: null | NodeJS.Timeout = null;
  errorCheckers: ClearBrowserCacheErrorChecker[];

  constructor(props) {
    super(props);

    this.errorCheckers = defaultErrorCheckers.concat(props.errorCheckers);
    this.appVersionStorage = createStorage(props.storageKey, props.storage);

    let latestVersion = 'latest';

    try {
      const appVersion = this.appVersionStorage.get();

      if (appVersion) {
        latestVersion = appVersion;
      }
    } catch (error) {
      this.debug(error);
    }

    this.state = {
      loading: true,
      latestVersion,
      hasExternalError: false,
      isLatestVersion: true
    };
  }

  componentDidMount() {
    this.checkVersion(true);

    window.addEventListener('focus', this.startVersionCheck);
    window.addEventListener('blur', this.stopVersionCheck);

    this.debug();
  }

  componentDidUpdate() {
    const { loading, hasExternalError } = this.state;

    this.stopVersionCheck();
    this.debug();

    if (!(loading || hasExternalError)) {
      this.startVersionCheck();
    }
  }

  componentWillUnmount() {
    this.stopVersionCheck();

    window.removeEventListener('focus', this.startVersionCheck);
    window.removeEventListener('blur', this.stopVersionCheck);
  }

  componentDidCatch(error: Error) {
    const { hasExternalError } = this.state;

    const needCheckVersion = this.errorCheckers.some((checkError) =>
      checkError(error)
    );

    if (needCheckVersion && !hasExternalError) {
      this.setState({ loading: true });
      this.checkVersion(true, false, true).then((isNotCacheError) => {
        if (isNotCacheError) {
          this.debug(error);

          throw error;
        }
      });
    } else {
      throw error;
    }
  }

  debug = (error?: Error) => {
    const { debug } = this.props;

    if (debug?.call) {
      debug({ state: this.state, error });
    }
  };

  startVersionCheck = () => {
    const { duration, auto } = this.props;

    if (duration) {
      this.checkInterval = setInterval(
        () => this.checkVersion(auto, true),
        duration
      );
    }
  };

  stopVersionCheck = () => {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  };

  fetchMeta = async () => {
    const { filename } = this.props;

    const baseUrl = `/${filename}?time=${Date.now()}`;
    const meta = await fetch(baseUrl).then((r) => r.json());

    return meta;
  };

  clearCacheAndReload = async (version?: string) => {
    const { latestVersion } = this.state;

    this.appVersionStorage.set(version || latestVersion);

    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }

    window.location.reload(true);
  };

  checkVersion = async (
    auto: boolean = false,
    silent: boolean = false,
    hasExternalError: boolean = false
  ) => {
    try {
      const appVersion = this.state.latestVersion;
      const meta = await this.fetchMeta();

      const newVersion = meta.version;
      const isUpdated = newVersion === appVersion;

      if (!isUpdated) {
        if (auto) {
          await this.clearCacheAndReload(newVersion);
        } else {
          this.setState({
            latestVersion: newVersion,
            loading: false,
            isLatestVersion: false
          });

          this.appVersionStorage.set(newVersion);
        }
      } else if (!silent) {
        this.setState({
          loading: false,
          isLatestVersion: true,
          hasExternalError
        });

        return hasExternalError;
      }
    } catch (error) {
      this.debug(error);

      this.setState({
        loading: false,
        isLatestVersion: false
      });
    }

    return false;
  };

  render() {
    const { children, fallback } = this.props;
    const { loading } = this.state;

    if (loading) {
      return fallback;
    }

    return (
      <ClearBrowserCacheCtx.Provider
        value={{
          ...this.state,
          clearCacheAndReload: () => this.clearCacheAndReload()
        }}
      >
        {children}
      </ClearBrowserCacheCtx.Provider>
    );
  }
}

export default ClearBrowserCacheBoundary;
