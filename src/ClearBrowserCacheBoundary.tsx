import React from 'react';

type History = {
  listen: (listener: Function) => Function;
};

export type ClearBrowserCacheStorage = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
};

export type ClearBrowserCacheDebugFunc = (params: {
  state: ClearBrowserCacheBoundaryState;
  error?: Error;
}) => void;

export type ClearBrowserCacheAppVersion = {
  get: () => string | null;
  set: (version: string) => void;
};

export type ClearBrowserCacheErrorMap = {
  name: string;
  checkMessage: (message?: any) => boolean;
};

export type ClearBrowserCacheBoundaryState = {
  loading: boolean;
  isLatestVersion: boolean;
  hasError: boolean;
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
  history?: History;
};

type CtxValue = {
  loading: boolean;
  latestVersion: string;
  isLatestVersion: boolean;
  clearCacheAndReload: () => void;
};

type ClearBrowserCacheProps = {
  children: (value: CtxValue) => any;
};

function checkMessageWithRegex(regex: RegExp) {
  return function (message?: string) {
    return Boolean(message?.toString().match(regex));
  };
}

const chunkFailedMessageRegex = /Loading chunk [\d]+ failed/;
const syntaxErrorMessageRegex = /['"\s]<['"\s]/;

const errors: ClearBrowserCacheErrorMap[] = [
  {
    name: 'ChunkLoadError',
    checkMessage: checkMessageWithRegex(chunkFailedMessageRegex)
  },
  {
    name: 'SyntaxError',
    checkMessage: checkMessageWithRegex(syntaxErrorMessageRegex)
  }
];

const STORAGE_KEY = 'APP_VERSION';

const defaultProps = {
  auto: false,
  storageKey: STORAGE_KEY,
  filename: 'meta.json',
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

export class ClearBrowserCacheBoundary extends React.Component<
  React.PropsWithChildren<ClearBrowserCacheBoundaryProps>,
  ClearBrowserCacheBoundaryState
> {
  static defaultProps = defaultProps;

  appVersion: ClearBrowserCacheAppVersion;
  checkInterval: null | NodeJS.Timeout = null;
  historyUnlisten: null | Function = null;

  constructor(props) {
    super(props);

    const { storage, storageKey } = props;

    this.appVersion = {
      set: (version: string) => storage.set(storageKey, version),
      get: () => storage.get(storageKey)
    };

    const latestVersion = this.appVersion.get() || 'latest';

    this.state = {
      loading: true,
      hasError: false,
      isLatestVersion: true,
      latestVersion
    };
  }

  componentDidMount() {
    this.checkVersion(true);
    this.debug();
    this.listenHistory();

    window.addEventListener('focus', this.startVersionCheck);
    window.addEventListener('blur', this.stopVersionCheck);
  }

  componentDidUpdate() {
    this.stopVersionCheck();
    this.debug();

    if (!(this.state.loading || this.state.hasError)) {
      this.startVersionCheck();
    }
  }

  componentWillUnmount() {
    this.stopVersionCheck();

    window.removeEventListener('focus', this.startVersionCheck);
    window.removeEventListener('blur', this.stopVersionCheck);

    if (this.historyUnlisten) {
      this.historyUnlisten();
    }
  }

  componentDidCatch(error: Error) {
    const { hasError } = this.state;

    const needCheckVersion = errors.some(
      ({ name, checkMessage }) =>
        name === error.name && checkMessage(error.message)
    );

    if (needCheckVersion && !hasError) {
      this.setState({ loading: true });
      this.checkVersion(true, true).then((isNotCacheError) => {
        if (isNotCacheError) {
          this.debug(error);

          throw error;
        }
      });
    } else {
      throw error;
    }
  }

  listenHistory = () => {
    const { history } = this.props;

    if (history?.listen?.call) {
      this.historyUnlisten = history.listen(() => {
        if (!this.state.isLatestVersion) {
          this.clearCacheAndReload();
        }
      });
    }
  };

  debug = (error?: Error) => {
    const { debug } = this.props;

    if (debug?.call) {
      debug({ state: this.state, error });
    }
  };

  startVersionCheck = () => {
    const { duration, auto } = this.props;

    if (duration) {
      this.checkInterval = setInterval(() => this.checkVersion(auto), duration);
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

    this.appVersion.set(version || latestVersion);

    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }

    window.location.reload(true);
  };

  checkVersion = async (auto: boolean = false, hasError: boolean = false) => {
    try {
      const appVersion = this.appVersion.get();

      const meta = await this.fetchMeta();

      const newVersion = meta.version;
      const isUpdated = newVersion === appVersion;

      if (!isUpdated) {
        if (auto) {
          this.clearCacheAndReload();
        } else {
          this.setState({
            latestVersion: newVersion,
            loading: false,
            isLatestVersion: false
          });
          this.appVersion.set(newVersion);
        }
      } else {
        this.setState({
          loading: false,
          isLatestVersion: true,
          hasError
        });

        return hasError;
      }
    } catch (error) {
      this.debug(error);
    }

    return false;
  };

  render() {
    const { children, fallback } = this.props;
    const { loading, latestVersion, isLatestVersion } = this.state;

    if (loading) {
      return fallback;
    }

    return (
      <ClearBrowserCacheCtx.Provider
        value={{
          loading,
          latestVersion,
          isLatestVersion,
          clearCacheAndReload: () => this.clearCacheAndReload()
        }}
      >
        {children}
      </ClearBrowserCacheCtx.Provider>
    );
  }
}

export default ClearBrowserCacheBoundary;
