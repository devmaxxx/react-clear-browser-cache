import React from 'react';

// import ChunkLoadError from './ChunkLoadError';

export default function Component({ children }: any) {
  React.useEffect(() => {
    // throw new ChunkLoadError('Loading chunk 1 failed');
  }, []);

  React.useEffect(() => {
    // throw new SyntaxError("' < '");
  }, []);

  return <div>{children}</div>;
}
