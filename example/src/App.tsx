import React, { Suspense, lazy } from 'react';

//@ts-ignore
let LazyComponent = lazy(() => import('./Component'));

const App = () => {
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
