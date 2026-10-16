import type { ClearBrowserCacheDebugFunc } from 'react-clear-browser-cache';

// GitHub Pages only serves static files, so a "deploy" here is a version kept
// in localStorage and handed out as meta.json by a fetch shim. Everything after
// that fetch — comparing versions, clearing Cache Storage, reloading — is the
// library's own code.

export const STORAGE_KEY = 'APP_VERSION';
const DEPLOYED_KEY = 'demo:deployed';
const LOG_KEY = 'demo:log';
const LOADS_KEY = 'demo:loads';
const CACHE_PREFIX = 'demo-assets-';

export type LogKind = 'load' | 'check' | 'deploy' | 'cache' | 'state' | 'error';
export type LogEntry = {
  id: number;
  time: string;
  kind: LogKind;
  text: string;
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  // Deploys from another tab arrive as storage events.
  window.addEventListener('storage', listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function deployedVersion() {
  return localStorage.getItem(DEPLOYED_KEY) ?? 'v1';
}

export function storedVersion() {
  return localStorage.getItem(STORAGE_KEY);
}

// What this page was built from: whatever was deployed when it loaded.
export const runningVersion = deployedVersion();

export const pageLoad = Number(sessionStorage.getItem(LOADS_KEY) ?? 0) + 1;
sessionStorage.setItem(LOADS_KEY, String(pageLoad));

let entries: LogEntry[] = readLog();

function readLog(): LogEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(LOG_KEY) ?? '[]') as LogEntry[];
  } catch {
    return [];
  }
}

export function getLog() {
  return entries;
}

export function log(kind: LogKind, text: string) {
  const id = (entries.at(-1)?.id ?? 0) + 1;
  const time = new Date().toLocaleTimeString([], { hour12: false });

  entries = [...entries, { id, time, kind, text }].slice(-100);
  sessionStorage.setItem(LOG_KEY, JSON.stringify(entries));
  notify();
}

export function clearLog() {
  entries = [];
  sessionStorage.removeItem(LOG_KEY);
  notify();
}

export function deploy() {
  const current = Number(/^v(\d+)$/.exec(deployedVersion())?.[1] ?? 1);
  const next = `v${current + 1}`;

  localStorage.setItem(DEPLOYED_KEY, next);
  log('deploy', `Deployed ${next}. Its chunks replace the old ones.`);
}

let resetting = false;

export async function resetDemo() {
  resetting = true;
  localStorage.removeItem(DEPLOYED_KEY);
  sessionStorage.clear();
  await clearDemoCaches();
  // Removed last: a poll that lands during the awaits above stores the version
  // again, and the reset page would then start out already "installed".
  localStorage.removeItem(STORAGE_KEY);
  location.replace(location.pathname);
}

export function failingChunkError() {
  // Worded like Chrome's, which the default error checkers recognise.
  return new TypeError(
    `Failed to fetch dynamically imported module: ${location.origin}${import.meta.env.BASE_URL}assets/Reports-${runningVersion}.js`
  );
}

export function installFetchShim() {
  const realFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      location.href
    );

    if (!url.pathname.endsWith('/meta.json')) {
      return realFetch(input, init);
    }

    const version = deployedVersion();
    log('check', `GET meta.json → ${version}`);

    return Promise.resolve(
      new Response(JSON.stringify({ version }), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  };
}

function hasCacheStorage() {
  return typeof caches !== 'undefined';
}

export async function cacheNames() {
  if (!hasCacheStorage()) {
    return null;
  }

  return (await caches.keys()).filter((name) => name.startsWith(CACHE_PREFIX));
}

async function clearDemoCaches() {
  const names = (await cacheNames()) ?? [];
  await Promise.all(names.map((name) => caches.delete(name)));
}

// Plays the part of a service worker's precache, so it is visible whether the
// library emptied Cache Storage before a reload.
export async function seedCache() {
  const names = await cacheNames();

  if (names === null) {
    log('cache', 'Cache Storage is unavailable here (needs HTTPS).');
    return;
  }

  if (pageLoad > 1) {
    log(
      'cache',
      names.length
        ? `Cache Storage still holds ${names.join(', ')}.`
        : 'Cache Storage is empty: it was cleared before the reload.'
    );
  }

  const cache = await caches.open(`${CACHE_PREFIX}${runningVersion}`);
  await cache.put(
    `${import.meta.env.BASE_URL}assets/app-${runningVersion}.js`,
    new Response('')
  );
  notify();
}

let lastSummary = '';

export const debug: ClearBrowserCacheDebugFunc = ({ state, error }) => {
  if (error) {
    const { name, message } =
      error instanceof Error ? error : new Error(String(error));
    log('error', `Caught ${name}: ${message}`);
  }

  if (state.loading || !state.latestVersion) {
    return;
  }

  const summary = state.isLatestVersion
    ? `Up to date with ${state.latestVersion}.`
    : `${state.latestVersion} is out; this tab still runs ${runningVersion}.`;

  if (summary !== lastSummary) {
    lastSummary = summary;
    log('state', summary);
  }
};

export function start() {
  log('load', `Page load #${pageLoad}, running ${runningVersion}.`);
  installFetchShim();
  void seedCache();
  window.addEventListener('pagehide', () => {
    // After a reset the log must start empty, not with this entry.
    if (!resetting) {
      log('load', 'Page reloading…');
    }
  });
}
