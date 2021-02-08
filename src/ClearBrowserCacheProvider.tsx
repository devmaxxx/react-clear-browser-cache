import React from 'react';

export type DefaultProps = {
  duration: number;
  auto: boolean;
  storageKey: string;
  basePath: string;
  filename: string;
  storage: {
    get: (key: string) => string | null;
    set: (version: string, value: string) => void;
  };
  fallback: any;
};

export type State = {
  hasError: boolean;
  loading: boolean;
  isLatestVersion: boolean;
  appVersion: string;
  latestVersion: string;
};

export type CtxValue = {
  loading: boolean;
  isLatestVersion: boolean;
  clearCache: () => void;
};

type ClearBrowserCacheProps = {
  children: (value: CtxValue) => any;
};

const errorNames = ['ChunkLoadError', 'SyntaxError'];
const STORAGE_KEY = 'APP_VERSION';

const defaultProps = {
  duration: 0,
  auto: false,
  storageKey: STORAGE_KEY,
  basePath: '',
  filename: 'meta.json',
  storage: {
    get: window.localStorage.getItem,
    set: window.localStorage.setItem
  }
};

const ClearBrowserCacheCtx = React.createContext<CtxValue>({} as CtxValue);

export function useClearBrowserCacheCtx() {
  return React.useContext(ClearBrowserCacheCtx);
}

export function ClearBrowserCache({ children }: ClearBrowserCacheProps) {
  const ctx = useClearBrowserCacheCtx();

  return children(ctx);
}

export class ClearBrowserCacheProvider extends React.Component<
  React.PropsWithChildren<DefaultProps>,
  State
> {
  static defaultProps = defaultProps;

  constructor(props) {
    super(props);

    const appVersion = this.getAppVersion() || '';

    this.state = {
      hasError: false,
      loading: true,
      isLatestVersion: true,
      appVersion,
      latestVersion: appVersion
    };
  }

  componentDidCatch(error: Error) {
    if (errorNames.includes(error.name)) {
      this.setState({ hasError: true });
    } else {
      throw error;
    }
  }

  getAppVersion = () => {
    const { storage, storageKey } = this.props;

    return storage.get(storageKey);
  };

  setAppVersion = (version: string) => {
    const { storage, storageKey } = this.props;

    storage.set(storageKey, version);
  };

  fetchMeta = async () => {
    const { auto } = this.props;
    const { appVersion } = this.state;

    try {
      const baseUrl = `/meta.json?time=${Date.now()}`;
      const meta = await fetch(baseUrl).then((r) => r.json());

      const newVersion = meta.version;
      const currentVersion = appVersion;
      const isUpdated = newVersion === currentVersion;

      if (!isUpdated && !auto) {
        this.setState({
          latestVersion: newVersion,
          loading: false,
          isLatestVersion: !appVersion ? false : true
        });

        if (appVersion) {
          this.setAppVersion(newVersion);
        }
      } else if (!isUpdated && auto) {
        this.clearCache(newVersion);
      } else {
        this.setState({
          loading: false,
          isLatestVersion: false
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  clearCache = async (version?: string) => {
    const {} = this.state;

    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }

    this.setAppVersion(version || this.state.latestVersion);
    window.location.reload(true);
  };

  render() {
    const { children, fallback } = this.props;
    const { hasError, loading, isLatestVersion } = this.state;

    if (hasError || loading) {
      return fallback;
    }

    return (
      <ClearBrowserCacheCtx.Provider
        value={{ loading, isLatestVersion, clearCache: this.clearCache }}
      >
        {children}
      </ClearBrowserCacheCtx.Provider>
    );
  }
}

export default ClearBrowserCacheProvider;
