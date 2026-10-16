import {
  createErrorChecker,
  defaultErrorCheckers,
  isCacheError
} from '../src/errorCheckers';

function makeError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe('defaultErrorCheckers', () => {
  it.each([
    ['webpack 4 numeric chunk', 'ChunkLoadError', 'Loading chunk 3 failed.'],
    [
      'webpack 5 named chunk',
      'ChunkLoadError',
      'Loading chunk src_Component_tsx failed.\n(error: http://localhost/static/js/src_Component_tsx.chunk.js)'
    ],
    [
      'mini-css-extract chunk named ChunkLoadError',
      'ChunkLoadError',
      'Loading CSS chunk 7 failed.\n(/static/css/7.css)'
    ],
    [
      'mini-css-extract chunk',
      'Error',
      'Loading CSS chunk 7 failed.\n(/static/css/7.css)'
    ],
    [
      'Vite CSS preload',
      'Error',
      'Unable to preload CSS for /assets/Component-1a2b.css'
    ],
    [
      'Chrome dynamic import',
      'TypeError',
      'Failed to fetch dynamically imported module: http://localhost/assets/Component-1a2b.js'
    ],
    [
      'Firefox dynamic import',
      'TypeError',
      'error loading dynamically imported module: http://localhost/assets/Component-1a2b.js'
    ],
    ['Safari dynamic import', 'TypeError', 'Importing a module script failed.'],
    [
      'Safari module chunk answered with HTML',
      'TypeError',
      "'text/html' is not a valid JavaScript MIME type for module script 'http://localhost/assets/Component-1a2b.js'."
    ],
    ['Chrome/Safari HTML chunk', 'SyntaxError', "Unexpected token '<'"],
    ['Firefox HTML chunk', 'SyntaxError', "expected expression, got '<'"]
  ])('recognises %s', (_label, name, message) => {
    expect(isCacheError(makeError(name, message), defaultErrorCheckers)).toBe(
      true
    );
  });

  it.each([
    ['an unrelated TypeError', makeError('TypeError', 'x is undefined')],
    [
      'a SyntaxError not caused by HTML',
      makeError('SyntaxError', "Unexpected token ')'")
    ],
    [
      'a chunk message under the wrong name',
      makeError('Error', 'Loading chunk 3 failed.')
    ],
    ['a thrown string', "Unexpected token '<'"],
    ['null', null]
  ])('ignores %s', (_label, error) => {
    expect(isCacheError(error, defaultErrorCheckers)).toBe(false);
  });
});

describe('createErrorChecker', () => {
  it('matches on both name and message', () => {
    const check = createErrorChecker('MyError', /stale build/);

    expect(check(makeError('MyError', 'stale build detected'))).toBe(true);
    expect(check(makeError('MyError', 'something else'))).toBe(false);
    expect(check(makeError('Error', 'stale build detected'))).toBe(false);
  });

  it('gives the same answer for repeated calls with a global regexp', () => {
    const check = createErrorChecker('MyError', /stale/g);
    const error = makeError('MyError', 'stale');

    expect([check(error), check(error), check(error)]).toEqual([
      true,
      true,
      true
    ]);
  });
});
