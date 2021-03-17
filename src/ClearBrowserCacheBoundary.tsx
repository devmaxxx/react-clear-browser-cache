import React from 'react';

export type ClearBrowserCacheStorage = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
};

export type ClearBrowserCacheAppVersionStorage = {
  get: () => string;
  set: (version: string) => void;
};

export type ClearBrowserCacheDebugFunc = (params: {
  state?: ClearBrowserCacheBoundaryState;
  error?: Error;
  errorInfo?: any;
}) => void;

export type ClearBrowserCacheErrorChecker = (error: Error) => boolean;

export type ClearBrowserCacheBoundaryState = {
  loading: boolean;
  isLatestVersion: boolean;
  latestVersion: string;
  disabled: boolean;
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

class ClearBrowserCacheError extends Error {
  constructor(error) {
    super(error);
    this.name = error.name;
    this.message = error.message;
  }
}

export function createErrorChecker(name: string, regexpForMesssage: RegExp) {
  return function (error: Error): boolean {
    return (
      error.name === name && Boolean(regexpForMesssage.exec(error.message))
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
const latestVersion = 'latest';
const disabledVersion = 'disabled';

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
      try {
        storage.set(storageKey, version);
      } catch (error) {}
    },
    get() {
      try {
        return storage.get(storageKey) || latestVersion;
      } catch (error) {
        return disabledVersion;
      }

      return latestVersion;
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

    const latestVersion = this.appVersionStorage.get();

    this.state = {
      loading: true,
      latestVersion,
      disabled: latestVersion === disabledVersion,
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
    const { loading } = this.state;

    this.stopVersionCheck();
    this.debug();

    if (!loading) {
      this.startVersionCheck();
    }
  }

  componentWillUnmount() {
    this.stopVersionCheck();

    window.removeEventListener('focus', this.startVersionCheck);
    window.removeEventListener('blur', this.stopVersionCheck);
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const { loading } = this.state;

    if (loading) {
      return;
    }

    const needCheckVersion = this.errorCheckers.some((checkError) =>
      checkError(error)
    );

    function throwError() {
      throw new ClearBrowserCacheError(error);
    }

    if (needCheckVersion) {
      this.setState({ loading: true });

      this.checkVersion(true, false).then(() => {
        this.debug(error, errorInfo);

        this.setState(throwError);
      });
    } else {
      throwError();
    }
  }

  debug = (error?: Error, errorInfo?: any) => {
    const { debug } = this.props;

    if (debug?.call) {
      debug({ state: this.state, error, errorInfo });
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

  clearCacheAndReload = async () => {
    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }

    window.location.reload(true);
  };

  checkVersion = async (auto: boolean = false, silent: boolean = false) => {
    try {
      const appVersion = this.state.latestVersion;
      const meta = await this.fetchMeta();

      const newVersion = meta.version;
      const isUpdated = newVersion === appVersion;

      if (!isUpdated) {
        this.appVersionStorage.set(newVersion);

        if (auto) {
          await this.clearCacheAndReload();
        } else {
          this.setState({
            latestVersion: newVersion,
            loading: false,
            isLatestVersion: false
          });
        }
      } else if (!silent) {
        this.setState({
          loading: false,
          isLatestVersion: true
        });
      }
    } catch (error) {
      this.debug(error);

      this.setState({
        loading: false
      });
    }
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
