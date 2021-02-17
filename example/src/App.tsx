import React from 'react';

//@ts-ignore
class ChunkLoadError extends Error {
  constructor(props: any) {
    super(props);
    this.name = 'ChunkLoadError';
  }
}

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
