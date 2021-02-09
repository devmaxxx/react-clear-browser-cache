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
  auto: true,
  storageKey: STORAGE_KEY,
  basePath: '',
  filename: 'meta.json',
  storage: {
    get: localStorage.getItem.bind(localStorage),
    set: localStorage.setItem.bind(localStorage)
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
      loading: true,
      isLatestVersion: false,
      appVersion: appVersion,
      latestVersion: appVersion
    };
  }

  componentDidMount() {
    this.checkVersionAndUpdate();
  }

  componentDidCatch(error: Error) {
    if (errorNames.includes(error.name)) {
      this.setState({ loading: true });
      this.checkVersionAndUpdate();
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
    const { filename } = this.props;

    const baseUrl = `/${filename}?time=${Date.now()}`;
    const meta = await fetch(baseUrl).then((r) => r.json());

    return meta;
  };

  clearCacheAndReload = async (version?: string) => {
    const { latestVersion } = this.state;

    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }

    this.setAppVersion(version || latestVersion);
    window.location.reload(true);
  };

  checkVersionAndUpdate = async () => {
    const { auto } = this.props;
    const { appVersion } = this.state;

    try {
      const meta = await this.fetchMeta();

      const newVersion = meta.version;
      const isUpdated = newVersion === appVersion;

      if (!isUpdated && !auto) {
        this.setState({
          latestVersion: newVersion,
          loading: false,
          isLatestVersion: !appVersion
        });

        if (appVersion) {
          this.setAppVersion(newVersion);
        }
      } else if (!isUpdated && auto) {
        this.clearCacheAndReload(newVersion);
      } else {
        this.clearCacheAndReload();

        // this.setState({
        //   loading: false,
        //   isLatestVersion: false
        // });
      }
    } catch (error) {
      console.log(error);
    }
  };

  render() {
    const { children, fallback } = this.props;
    const { loading, isLatestVersion } = this.state;

    if (loading) {
      return fallback;
    }

    console.log(this.state);

    return (
      <ClearBrowserCacheCtx.Provider
        value={{
          loading,
          isLatestVersion,
          clearCache: this.clearCacheAndReload
        }}
      >
        {children}
      </ClearBrowserCacheCtx.Provider>
    );
  }
}

export default ClearBrowserCacheProvider;
