import React, { Suspense, lazy } from 'react';

// import ChunkLoadError from './ChunkLoadError';

//@ts-ignore
let LazyComponent = lazy(() => import('./Component'));

const App = () => {
  React.useEffect(() => {
    // throw new ChunkLoadError('Loading chunk 1 failed');
  }, []);

  React.useEffect(() => {
    // throw new SyntaxError("' < '");
  }, []);

  return (
    <div>
      App
      <div>
        <Suspense fallback='Loading...'>
          <LazyComponent>Lazy component</LazyComponent>
        </Suspense>
      </div>
    </div>
  );
};

export default App;
