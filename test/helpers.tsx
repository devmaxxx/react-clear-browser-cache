import React from 'react';

export const STORAGE_KEY = 'APP_VERSION';

export function metaResponse(version: string) {
  return new Response(JSON.stringify({ version }), {
    headers: { 'content-type': 'application/json' }
  });
}

export function mockFetch(...responses: (() => Response)[]) {
  const fetchMock = vi.fn(async (_url: string) => {
    const next = responses.length > 1 ? responses.shift()! : responses[0];
    return next();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export class Catcher extends React.Component<
  React.PropsWithChildren,
  { error: unknown }
> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <p role='alert'>Caught: {String(this.state.error)}</p>;
    }
    return this.props.children;
  }
}

export function Thrower({ error }: { error: Error }): React.ReactNode {
  throw error;
}

export function chunkError() {
  const error = new Error('Loading chunk 3 failed.');
  error.name = 'ChunkLoadError';
  return error;
}
