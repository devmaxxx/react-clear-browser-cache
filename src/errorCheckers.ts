export type ClearBrowserCacheErrorChecker = (error: Error) => boolean;

export function createErrorChecker(
  name: string,
  messageRegExp: RegExp
): ClearBrowserCacheErrorChecker {
  return function (error) {
    return (
      error.name === name &&
      // search() ignores lastIndex, so a /g regexp gives a stable answer
      error.message.search(messageRegExp) !== -1
    );
  };
}

// A stale index.html points at chunk files that the new deploy removed. Each
// bundler and browser reports the missing chunk differently, and a server with
// an SPA fallback answers with index.html, which the HTML-unaware JS parser
// rejects at its first `<`.
export const defaultErrorCheckers: ClearBrowserCacheErrorChecker[] = [
  // webpack: numeric ids in v4, named ids in v5; mini-css-extract-plugin
  // raises its CSS variant under the same name
  createErrorChecker('ChunkLoadError', /Loading (?:CSS )?chunk \S+ failed/),
  // Turbopack (Next.js): a plain Error in older releases, ChunkLoadError later
  createErrorChecker('ChunkLoadError', /Failed to load chunk \S+/),
  createErrorChecker('Error', /Failed to load chunk \S+/),
  // older mini-css-extract-plugin releases used the generic name
  createErrorChecker('Error', /Loading CSS chunk \S+ failed/),
  // Vite's modulepreload helper
  createErrorChecker('Error', /Unable to preload CSS for /),
  // Native dynamic import(): Chrome, Firefox, Safari, and Safari again when
  // the chunk URL is answered with HTML
  createErrorChecker(
    'TypeError',
    /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type/
  ),
  // Classic <script> chunk answered with HTML: Chrome/Safari "Unexpected
  // token '<'", Firefox "expected expression, got '<'"
  createErrorChecker('SyntaxError', /['"\s]<['"\s]/)
];

export function isCacheError(
  error: unknown,
  checkers: ClearBrowserCacheErrorChecker[]
): boolean {
  // React rethrows whatever was thrown, which need not be an Error.
  return error instanceof Error && checkers.some((check) => check(error));
}
