import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react';
import {
  ClearBrowserCacheBoundary,
  useClearBrowserCache
} from 'react-clear-browser-cache';

import { prompts, type PromptChoice } from './prompts';
import {
  cacheNames,
  clearLog,
  debug,
  deploy,
  deployedVersion,
  failingChunkError,
  getLog,
  pageLoad,
  resetDemo,
  runningVersion,
  storedVersion,
  subscribe
} from './server';

const Reports = lazy(() =>
  deployedVersion() === runningVersion
    ? import('./Reports')
    : Promise.reject(failingChunkError())
);

type Settings = {
  auto: boolean;
  duration: number;
  prompt: PromptChoice;
  promptOnError: boolean;
};

const durations = [
  { value: 0, label: 'Off' },
  { value: 3000, label: 'Every 3 s' },
  { value: 10000, label: 'Every 10 s' }
];

function readSettings(): Settings {
  const params = new URLSearchParams(location.search);
  const prompt = params.get('prompt');
  const duration = Number(params.get('duration') ?? 3000);

  return {
    auto: params.get('auto') === '1',
    duration: durations.some((d) => d.value === duration) ? duration : 3000,
    prompt: prompt === 'banner' || prompt === 'none' ? prompt : 'dialog',
    promptOnError: params.get('promptOnError') !== '0'
  };
}

// Kept in the URL so the settings survive the reloads the demo is about.
function writeSettings(settings: Settings) {
  const params = new URLSearchParams({
    auto: settings.auto ? '1' : '0',
    duration: String(settings.duration),
    prompt: settings.prompt,
    promptOnError: settings.promptOnError ? '1' : '0'
  });
  history.replaceState(null, '', `?${params}`);
}

function useServer() {
  return useSyncExternalStore(subscribe, deployedVersion);
}

function useTick(ms: number) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((tick) => tick + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function useCacheNames() {
  const [names, setNames] = useState<string[] | null>([]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void cacheNames().then((next) => active && setNames(next));
    };

    refresh();
    const id = setInterval(refresh, 1000);
    const unsubscribe = subscribe(refresh);

    return () => {
      active = false;
      clearInterval(id);
      unsubscribe();
    };
  }, []);

  return names;
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className='crash' role='alert'>
          <strong>Your app's error boundary caught it:</strong>
          <code>{this.state.error.message}</code>
          <button type='button' onClick={() => location.reload()}>
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function Status() {
  const { isLatestVersion, latestVersion, clearCacheAndReload } =
    useClearBrowserCache();
  const names = useCacheNames();
  const stored = storedVersion();
  useTick(500);

  return (
    <>
      <dl className='status'>
        <dt>Running build</dt>
        <dd data-testid='running'>{runningVersion}</dd>
        <dt>
          Stored version <code>APP_VERSION</code>
        </dt>
        <dd data-testid='stored'>{stored ?? '—'}</dd>
        <dt>
          <code>isLatestVersion</code>
        </dt>
        <dd data-testid='is-latest' className={isLatestVersion ? 'ok' : 'warn'}>
          {String(isLatestVersion)}
        </dd>
        <dt>
          <code>latestVersion</code>
        </dt>
        <dd>{latestVersion || '—'}</dd>
        <dt>Page loads this session</dt>
        <dd data-testid='loads'>{pageLoad}</dd>
        <dt>Cache Storage</dt>
        <dd>
          {names === null
            ? 'unavailable'
            : names.length
              ? names.join(', ')
              : 'empty'}
        </dd>
      </dl>
      {!isLatestVersion && (
        <button type='button' className='primary' onClick={clearCacheAndReload}>
          Update now (from the hook)
        </button>
      )}
    </>
  );
}

function ReportsSection() {
  const [open, setOpen] = useState(false);

  return (
    <div className='reports-section'>
      <button type='button' onClick={() => setOpen(true)} disabled={open}>
        Open reports (lazy chunk)
      </button>
      {open && (
        <Suspense fallback={<p>Loading reports…</p>}>
          <Reports />
        </Suspense>
      )}
    </div>
  );
}

function Settings({
  settings,
  onChange
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const promptOff = settings.prompt === 'none';

  return (
    <fieldset className='settings'>
      <legend>Boundary props</legend>
      <label>
        <span>
          <code>duration</code>
        </span>
        <select
          value={settings.duration}
          onChange={(e) => set({ duration: Number(e.target.value) })}
        >
          {durations.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>
          <code>updatePrompt</code>
        </span>
        <select
          value={settings.prompt}
          onChange={(e) => set({ prompt: e.target.value as PromptChoice })}
        >
          <option value='dialog'>Built-in dialog</option>
          <option value='banner'>Custom banner component</option>
          <option value='none'>None</option>
        </select>
      </label>
      <label className='check'>
        <input
          type='checkbox'
          checked={settings.promptOnError}
          disabled={promptOff}
          onChange={(e) => set({ promptOnError: e.target.checked })}
        />
        <code>promptOnError</code>
      </label>
      <label className='check'>
        <input
          type='checkbox'
          checked={settings.auto}
          onChange={(e) => set({ auto: e.target.checked })}
        />
        <code>auto</code>
        <small>reload as soon as a poll finds a new build</small>
      </label>
    </fieldset>
  );
}

function snippet(settings: Settings) {
  const props = [
    "filename='/react-clear-browser-cache/meta.json'",
    settings.duration ? `duration={${settings.duration}}` : null,
    settings.auto ? 'auto' : null,
    settings.prompt === 'dialog' ? 'updatePrompt={UpdatePrompt}' : null,
    settings.prompt === 'banner' ? 'updatePrompt={MyBanner}' : null,
    settings.prompt !== 'none' && settings.promptOnError
      ? 'promptOnError'
      : null
  ].filter(Boolean);

  return `<ClearBrowserCacheBoundary${props.map((p) => `\n  ${p}`).join('')}
>
  <App />
</ClearBrowserCacheBoundary>`;
}

function Log() {
  const entries = useSyncExternalStore(subscribe, getLog);

  return (
    <section className='card log-card' aria-labelledby='log-title'>
      <header>
        <h2 id='log-title'>Event log</h2>
        <button type='button' className='link' onClick={clearLog}>
          Clear
        </button>
      </header>
      <ol className='log' aria-live='polite'>
        {entries
          .slice()
          .reverse()
          .map((entry) => (
            <li key={entry.id} className={entry.kind}>
              <time>{entry.time}</time>
              <span>{entry.text}</span>
            </li>
          ))}
      </ol>
    </section>
  );
}

export default function Demo() {
  const [settings, setSettings] = useState(readSettings);
  const deployed = useServer();

  const change = (next: Settings) => {
    setSettings(next);
    writeSettings(next);
  };

  return (
    <div className='page'>
      <header className='hero'>
        <h1>react-clear-browser-cache</h1>
        <p>
          Users keep old tabs open. When you ship, their page still runs the
          last build and its lazy chunks are gone from the server. This boundary
          notices, empties Cache Storage and reloads, or asks first.
        </p>
        <nav>
          <a href='https://github.com/devmaxxx/react-clear-browser-cache'>
            GitHub
          </a>
          <a href='https://www.npmjs.com/package/react-clear-browser-cache'>
            npm
          </a>
        </nav>
      </header>

      <ol className='steps'>
        <li>
          Press <strong>Deploy new version</strong>. The server now has a new
          build; this tab still runs {runningVersion}.
        </li>
        <li>
          Wait for the next poll: the update prompt appears. Or open the reports
          first: their chunk is gone, so loading them fails.
        </li>
        <li>
          Reload from the prompt and watch the log: Cache Storage is cleared and
          the new version stored. Open a second tab to see deploys reach it.
        </li>
      </ol>

      <div className='grid'>
        <section className='card' aria-labelledby='server-title'>
          <h2 id='server-title'>Server</h2>
          <p className='big'>
            Deployed build <strong data-testid='deployed'>{deployed}</strong>
          </p>
          <div className='row'>
            <button type='button' className='primary' onClick={deploy}>
              Deploy new version
            </button>
            <button type='button' onClick={() => void resetDemo()}>
              Reset demo
            </button>
          </div>
          <Settings settings={settings} onChange={change} />
          <pre className='snippet'>
            <code>{snippet(settings)}</code>
          </pre>
          <p className='note'>
            Polling pauses while this tab is in the background and restarts when
            it gets focus.
          </p>
        </section>

        <section className='card' aria-labelledby='app-title'>
          <h2 id='app-title'>This tab</h2>
          <AppErrorBoundary>
            <ClearBrowserCacheBoundary
              fallback={<p className='fallback'>Checking for a new build…</p>}
              auto={settings.auto}
              duration={settings.duration || undefined}
              updatePrompt={prompts[settings.prompt]}
              promptOnError={settings.promptOnError}
              filename={`${import.meta.env.BASE_URL}meta.json`}
              debug={debug}
            >
              <Status />
              <ReportsSection />
            </ClearBrowserCacheBoundary>
          </AppErrorBoundary>
        </section>

        <Log />
      </div>
    </div>
  );
}
