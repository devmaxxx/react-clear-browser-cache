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

function createAppVersionStorage(
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
    this.appVersionStorage = createAppVersionStorage(
      props.storageKey,
      props.storage
    );

    const latestVersion = this.appVersionStorage.get();
    const disabled = latestVersion === disabledVersion;

    this.state = {
      loading: !disabled,
      latestVersion,
      disabled,
      isLatestVersion: true
    };
  }

  componentDidMount() {
    const { disabled } = this.state;

    if (!disabled) {
      this.checkVersion(true);
    }

    window.addEventListener('focus', this.startVersionCheck);
    window.addEventListener('blur', this.stopVersionCheck);

    this.debug();
  }

  componentDidUpdate() {
    const { loading } = this.state;

    this.stopVersionCheck();

    if (!loading) {
      this.startVersionCheck();
    }

    this.debug();
  }

  componentWillUnmount() {
    this.stopVersionCheck();

    window.removeEventListener('focus', this.startVersionCheck);
    window.removeEventListener('blur', this.stopVersionCheck);
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const { loading, disabled } = this.state;

    function throwError() {
      throw error;
    }

    if (disabled) throwError();

    if (loading) return;

    const needCheckVersion = this.errorCheckers.some((checkError) =>
      checkError(error)
    );

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
    const { disabled } = this.state;

    if (!disabled && duration) {
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

  clearCacheAndReload = async (newVersion?: string) => {
    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }

    this.appVersionStorage.set(newVersion || this.state.latestVersion);

    window.location.reload(true);
  };

  checkVersion = async (auto: boolean = false, silent: boolean = false) => {
    try {
      const appVersion = this.state.latestVersion;
      const meta = await this.fetchMeta();

      const newVersion = meta.version;
      const isUpdated = newVersion === appVersion;

      if (!isUpdated) {
        if (auto) {
          await this.clearCacheAndReload();
        } else {
          this.setState({
            latestVersion: newVersion,
            loading: false,
            isLatestVersion: false
          });
        }

        this.appVersionStorage.set(newVersion);
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
