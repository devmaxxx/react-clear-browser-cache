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

type UpdateMode = 'prompt' | 'reload' | 'flag';

type Settings = {
  duration: number;
  onUpdate: UpdateMode;
  prompt: PromptChoice;
  promptOnChunkError: boolean;
  reloadWhenHidden: boolean;
  blocking: boolean;
};

type Choice<T> = { value: T; label: string; hint?: string };

const durations: Choice<number>[] = [
  { value: 0, label: 'Off' },
  { value: 3000, label: '3 s' },
  { value: 10000, label: '10 s' }
];

const updateModes: Choice<UpdateMode>[] = [
  { value: 'prompt', label: 'prompt', hint: 'ask the user' },
  { value: 'reload', label: 'reload', hint: 'reload at once' },
  { value: 'flag', label: 'flag', hint: 'only set isLatestVersion' }
];

const promptChoices: Choice<PromptChoice>[] = [
  { value: 'dialog', label: 'Dialog', hint: 'modal <dialog>' },
  { value: 'banner', label: 'Banner', hint: 'toast at the bottom' }
];

function pick<T>(choices: Choice<T>[], raw: unknown, fallback: T): T {
  return choices.find((c) => String(c.value) === raw)?.value ?? fallback;
}

function readSettings(): Settings {
  const params = new URLSearchParams(location.search);

  return {
    duration: pick(durations, params.get('duration'), 3000),
    onUpdate: pick(updateModes, params.get('onUpdate'), 'prompt'),
    prompt: pick(promptChoices, params.get('prompt'), 'dialog'),
    promptOnChunkError: params.get('promptOnChunkError') !== '0',
    reloadWhenHidden: params.get('reloadWhenHidden') === '1',
    blocking: params.get('blocking') !== '0'
  };
}

// Kept in the URL so the settings survive the reloads the demo is about.
function writeSettings(settings: Settings) {
  const params = new URLSearchParams({
    duration: String(settings.duration),
    onUpdate: settings.onUpdate,
    prompt: settings.prompt,
    promptOnChunkError: settings.promptOnChunkError ? '1' : '0',
    reloadWhenHidden: settings.reloadWhenHidden ? '1' : '0',
    blocking: settings.blocking ? '1' : '0'
  });
  history.replaceState(null, '', `?${params}`);
}

function promptInUse(settings: Settings) {
  return settings.onUpdate === 'prompt' || settings.promptOnChunkError;
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

function RadioGroup<T extends string | number>({
  name,
  legend,
  choices,
  value,
  disabled,
  onChange
}: {
  name: string;
  legend: ReactNode;
  choices: Choice<T>[];
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className='radio-group' disabled={disabled}>
      <legend>{legend}</legend>
      <div className='segments'>
        {choices.map((choice) => (
          <label key={String(choice.value)} className='segment'>
            <input
              type='radio'
              name={name}
              checked={choice.value === value}
              onChange={() => onChange(choice.value)}
            />
            <span>
              <strong>{choice.label}</strong>
              {choice.hint && <small>{choice.hint}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  name,
  hint
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  name: ReactNode;
  hint: string;
}) {
  return (
    <label className='toggle'>
      <input
        type='checkbox'
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <code>{name}</code>
        <small>{hint}</small>
      </span>
    </label>
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

  return (
    <div className='settings'>
      <div className='radios'>
        <RadioGroup
          name='duration'
          legend={<code>duration</code>}
          choices={durations}
          value={settings.duration}
          onChange={(duration) => set({ duration })}
        />
        <RadioGroup
          name='onUpdate'
          legend={<code>onUpdate</code>}
          choices={updateModes}
          value={settings.onUpdate}
          onChange={(onUpdate) => set({ onUpdate })}
        />
        <RadioGroup
          name='prompt'
          legend={<code>prompt</code>}
          choices={promptChoices}
          value={settings.prompt}
          disabled={!promptInUse(settings)}
          onChange={(prompt) => set({ prompt })}
        />
      </div>
      <div className='toggles'>
        <Toggle
          name='promptOnChunkError'
          hint='ask when a lazy chunk fails to load'
          checked={settings.promptOnChunkError}
          onChange={(promptOnChunkError) => set({ promptOnChunkError })}
        />
        <Toggle
          name='reloadWhenHidden'
          hint='reload quietly when you switch tabs'
          checked={settings.reloadWhenHidden}
          onChange={(reloadWhenHidden) => set({ reloadWhenHidden })}
        />
        <Toggle
          name='blocking={false}'
          hint='show the app before the first check'
          checked={!settings.blocking}
          onChange={(nonBlocking) => set({ blocking: !nonBlocking })}
        />
      </div>
    </div>
  );
}

function snippet(settings: Settings) {
  const props = [
    "filename='/react-clear-browser-cache/meta.json'",
    settings.duration ? `duration={${settings.duration}}` : null,
    settings.onUpdate === 'prompt' ? null : `onUpdate='${settings.onUpdate}'`,
    promptInUse(settings)
      ? `prompt={${settings.prompt === 'dialog' ? 'UpdateDialog' : 'Banner'}}`
      : null,
    settings.promptOnChunkError ? 'promptOnChunkError' : null,
    settings.reloadWhenHidden ? 'reloadWhenHidden' : null,
    settings.blocking ? null : 'blocking={false}'
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

  const stale = deployed !== runningVersion;

  return (
    <div className='page'>
      <header className='hero'>
        <p className='eyebrow'>Live demo · deploys simulated in your browser</p>
        <h1>
          <img
            className='logo'
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=''
            width={40}
            height={40}
          />
          react-clear-browser-cache
        </h1>
        <p className='lede'>
          Users keep old tabs open. When you ship, their page still runs the
          last build and its lazy chunks are gone from the server. This boundary
          notices, empties Cache Storage and reloads, or asks first.
        </p>
        <nav>
          <a
            className='pill'
            href='https://github.com/devmaxxx/react-clear-browser-cache'
          >
            GitHub
          </a>
          <a
            className='pill'
            href='https://www.npmjs.com/package/react-clear-browser-cache'
          >
            npm
          </a>
        </nav>
      </header>

      <ol className='steps'>
        <li>
          <strong>Deploy</strong> a new version. The server moves on; this tab
          still runs {runningVersion}.
        </li>
        <li>
          <strong>Wait</strong> for the next poll, or open the reports: their
          chunk is gone, so loading them fails.
        </li>
        <li>
          <strong>Reload</strong> from the prompt and watch the log. Open a
          second tab to see deploys reach it too.
        </li>
      </ol>

      <div className='grid'>
        <section className='card' aria-labelledby='server-title'>
          <h2 id='server-title'>Server</h2>
          <div className='versions'>
            <div>
              <span>Deployed</span>
              <strong data-testid='deployed' className='chip accent'>
                {deployed}
              </strong>
            </div>
            <span className='arrow' aria-hidden='true'>
              →
            </span>
            <div>
              <span>This tab runs</span>
              <strong className={`chip ${stale ? 'warn' : 'ok'}`}>
                {runningVersion}
              </strong>
            </div>
          </div>
          <div className='row'>
            <button type='button' className='primary' onClick={deploy}>
              Deploy new version
            </button>
            <button type='button' onClick={() => void resetDemo()}>
              Reset demo
            </button>
          </div>
        </section>

        <section className='card' aria-labelledby='app-title'>
          <h2 id='app-title'>This tab</h2>
          <AppErrorBoundary>
            <ClearBrowserCacheBoundary
              fallback={<p className='fallback'>Checking for a new build…</p>}
              duration={settings.duration || undefined}
              onUpdate={settings.onUpdate}
              prompt={
                promptInUse(settings) ? prompts[settings.prompt] : undefined
              }
              promptOnChunkError={settings.promptOnChunkError}
              reloadWhenHidden={settings.reloadWhenHidden}
              blocking={settings.blocking}
              filename={`${import.meta.env.BASE_URL}meta.json`}
              debug={debug}
            >
              <Status />
              <ReportsSection />
            </ClearBrowserCacheBoundary>
          </AppErrorBoundary>
        </section>

        <Log />

        <section className='card props-card' aria-labelledby='props-title'>
          <h2 id='props-title'>Boundary props</h2>
          <div className='props-body'>
            <Settings settings={settings} onChange={change} />
            <div>
              <pre className='snippet'>
                <code>{snippet(settings)}</code>
              </pre>
              <p className='note'>
                Polling pauses while this tab is in the background. When it gets
                focus back after a whole interval, it checks at once.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
