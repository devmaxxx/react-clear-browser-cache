import React from 'react';

export type DefaultProps = {
  duration: number;
  auto: boolean;
  storageKey: string;
  basePath: string;
  filename: string;
  storage: {
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
  };
  fallback: any;
};

export type State = {
  loading: boolean;
  isLatestVersion: boolean;
  hasError: boolean;
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

type ErrorMap = {
  name: string;
  checkMessage: (message?: any) => boolean;
};

function checkMessageWithRegex(regex: RegExp) {
  return function (message?: string) {
    return Boolean(message?.toString().match(regex));
  };
}

const chunkFailedMessageRegex = /Loading chunk [\d]+ failed/;
const syntaxErrorMessageRegex = /['"\s]<['"\s]/;

const errors: ErrorMap[] = [
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

  checkInterval: null | NodeJS.Timeout = null;

  constructor(props) {
    super(props);

    const appVersion = this.getAppVersion() || '';

    this.state = {
      loading: true,
      hasError: false,
      isLatestVersion: true,
      appVersion: appVersion,
      latestVersion: appVersion
    };
  }

  componentDidMount() {
    this.checkVersion();

    window.addEventListener('focus', this.startVersionCheck);
    window.addEventListener('blur', this.stopVersionCheck);
  }

  componentDidUpdate(_, prevState) {
    if (this.state.loading !== prevState.loading) {
      this.stopVersionCheck();

      if (!this.state.loading) {
        this.startVersionCheck();
      }
    }

    if (this.state.hasError) {
      this.stopVersionCheck();
    }
  }

  componentWillUnmount() {
    this.stopVersionCheck();

    window.removeEventListener('focus', this.startVersionCheck);
    window.removeEventListener('blur', this.stopVersionCheck);
  }

  componentDidCatch(error: Error) {
    const { hasError } = this.state;

    const needCheckVersion = errors.find(
      ({ name, checkMessage }) =>
        name === error.name && checkMessage(error.message)
    );

    if (needCheckVersion && !hasError) {
      this.setState({ loading: true });
      this.checkVersion(true).then((isNotCacheError) => {
        if (isNotCacheError) throw error;
      });
    } else {
      throw error;
    }
  }

  startVersionCheck = () => {
    const { duration } = this.props;

    if (duration) {
      this.checkInterval = setInterval(this.checkVersion, duration);
    }
  };

  stopVersionCheck = () => {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  };

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
    // window.location.reload(true);
  };

  checkVersion = async (error?: boolean) => {
    const { auto } = this.props;
    const { appVersion } = this.state;

    let isNotCacheError = false;

    try {
      const meta = await this.fetchMeta();

      const newVersion = meta.version;
      const isUpdated = newVersion === appVersion;

      if (!isUpdated) {
        if (auto) {
          this.clearCacheAndReload(newVersion);
        } else {
          this.setState({
            latestVersion: newVersion,
            loading: false,
            isLatestVersion: !appVersion
          });

          if (!appVersion) {
            this.setAppVersion(newVersion);
          }
        }
      } else {
        if (error) {
          isNotCacheError = true;
        }

        this.setState({
          loading: false,
          isLatestVersion: true,
          hasError: isNotCacheError
        });
      }
    } catch (error) {
      console.log(error);
    }

    return isNotCacheError;
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
