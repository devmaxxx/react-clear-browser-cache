type Listener = (state: State) => void;
type ErrorChecker = (error: Error) => boolean;

type Props = {
  fileName?: string;
  storageKey?: string;
  errorCheckers?: ErrorChecker[];
};

type RequiredProps = Required<Props>;

type State = {
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
  storageKey: 'APP_VERSION',
  fileName: 'meta.json',
  errorCheckers: []
};

const LATEST_VER = 'latest';

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
  fileName: RequiredProps['fileName'];
  storageKey: RequiredProps['storageKey'];
  errorCheckers: RequiredProps['errorCheckers'];
  subscribers: Listener[];
  state: State;

  constructor({
    fileName = defaultProps.fileName,
    storageKey = defaultProps.storageKey,
    errorCheckers
  } = defaultProps) {
    this.subscribers = [];
    this.fileName = fileName;
    this.storageKey = storageKey;
    this.errorCheckers = [...defaultErrorCheckers, ...errorCheckers];
    this.state = {
      loading: false,
      latestVersion: LATEST_VER,
      currentVersion: LATEST_VER,
      isLatestVersion: false
    };
  }

  _publish() {
    this.subscribers.forEach((listener) => listener(this.state));
  }

  subscribe(listener) {
    if (!listener?.call) return;

    this.subscribers.push(listener);

    return () => {
      this.subscribers.filter((fn) => fn !== listener);
    };
  }
}
