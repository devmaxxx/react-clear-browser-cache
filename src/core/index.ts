import { storage } from './storage';

type Listener = (_state: _state) => void;
type ErrorChecker = (error: Error) => boolean;

type Props = {
  initialLoading?: boolean;
  autoCheck?: boolean;
  autoCheckInterval?: number;
  fileName?: string;
  storageKey?: string;
  errorCheckers?: ErrorChecker[];
};

type RequiredProps = Required<Props>;

type _state = {
  loading: boolean;
  latestVersion: string;
  currentVersion: string;
  isLatestVersion: boolean;
};

type IClearCache = {
  _publish(): void;
  subscribe(listener: Listener): (() => void) | undefined;
};

const defaultProps: RequiredProps = {
  initialLoading: true,
  autoCheck: false,
  autoCheckInterval: 0,
  storageKey: 'APP_VERSION',
  fileName: 'meta.json',
  errorCheckers: []
};

const DEFAULT_VERSION = 'latest';

const chunkFailedMessageRegex = /Loading chunk [\d]+ failed/;
const syntaxErrorMessageRegex = /['"\s]<['"\s]/;

export function createErrorChecker(name: string, regexpForMesssage: RegExp) {
  return function (error: Error): boolean {
    return (
      error.name === name && Boolean(regexpForMesssage.exec(error.message))
    );
  };
}

const defaultErrorCheckers: ErrorChecker[] = [
  createErrorChecker('ChunkLoadError', chunkFailedMessageRegex),
  createErrorChecker('SyntaxError', syntaxErrorMessageRegex)
];

export class ClearCache implements IClearCache {
  _state: _state;
  _checkInterval: null | NodeJS.Timeout;
  _subscribers: Listener[];
  fileName: RequiredProps['fileName'];
  storageKey: RequiredProps['storageKey'];
  errorCheckers: RequiredProps['errorCheckers'];
  autoCheck: RequiredProps['autoCheck'];
  autoCheckInterval: RequiredProps['autoCheckInterval'];

  constructor({
    fileName = defaultProps.fileName,
    storageKey = defaultProps.storageKey,
    autoCheck = defaultProps.autoCheck,
    autoCheckInterval = defaultProps.autoCheckInterval,
    errorCheckers = defaultProps.errorCheckers,
    initialLoading = defaultProps.initialLoading
  } = defaultProps) {
    this.fileName = fileName;
    this.storageKey = storageKey;
    this.storageKey = storageKey;
    this.autoCheckInterval = autoCheckInterval;
    this.errorCheckers = [...defaultErrorCheckers, ...errorCheckers];

    this._checkInterval = null;
    this._subscribers = [];

    const currentVersion = storage.get(this.storageKey, DEFAULT_VERSION);

    this._state = {
      loading: initialLoading,
      currentVersion,
      latestVersion: currentVersion,
      isLatestVersion: true
    };

    if (autoCheck) {
      window.addEventListener('focus', () => this._startVersionCheck());
      window.addEventListener('blur', () => this._stopVersionCheck());
    }
  }

  _setState(state) {
    this._state = { ...this._state, ...state };

    this._publish();
  }

  _startVersionCheck() {
    if (this.autoCheck) {
      this._checkInterval = setInterval(
        () => this.checkVersion(this.autoCheck, true),
        this.autoCheckInterval
      );
    }
  }

  _stopVersionCheck() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
    }
  }

  _publish() {
    this._subscribers.forEach((listener) => listener(this._state));
  }

  async fetchMeta() {
    const baseUrl = `/${this.fileName}?time=${Date.now()}`;
    const meta = await fetch(baseUrl).then((r) => r.json());

    return meta;
  }

  async checkVersion(auto: boolean = false, silent: boolean = false) {
    try {
      const appVersion = this._state.latestVersion;
      const meta = await this.fetchMeta();

      const newVersion = meta.version;
      const isUpdated = newVersion === appVersion;

      if (!isUpdated) {
        if (auto) {
          await this.clearCacheAndReload();
        } else {
          this._setState({
            latestVersion: newVersion,
            loading: false,
            isLatestVersion: false
          });
        }

        storage.set(this.storageKey, newVersion);
      } else if (!silent) {
        this._setState({
          loading: false,
          isLatestVersion: true
        });
      }
    } catch (error) {
      this._setState({
        loading: false
      });
    }
  }

  async clearCacheAndReload(newVersion?: string) {
    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }

    storage.set(this.storageKey, newVersion || this._state.latestVersion);

    window.location.reload(true);
  }

  subscribe(listener) {
    if (!listener?.call) return;

    this._subscribers.push(listener);

    return () => {
      this._subscribers.filter((fn) => fn !== listener);
    };
  }
}
