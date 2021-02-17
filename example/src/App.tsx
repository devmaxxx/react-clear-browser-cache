import React from 'react';
// import ChunkLoadError from './ChunkLoadError';

const App = () => {
  React.useEffect(() => {
    // throw new ChunkLoadError('Loading chunk 1 failed');
  }, []);

  React.useEffect(() => {
    // throw new SyntaxError("' < '");
  }, []);

  return <div>App</div>;
};

export default App;
