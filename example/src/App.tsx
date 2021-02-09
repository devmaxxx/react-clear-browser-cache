import React from 'react';

// @ts-ignore
class ChunkLoadError extends Error {
  constructor(props: any) {
    super(props);
    this.name = 'ChunkLoadError';
  }
}

const App = () => {
  React.useEffect(() => {
    setTimeout(() => {
      throw new ChunkLoadError('Error');
    }, 3000);
  }, []);

  // React.useEffect(() => {
  //   setTimeout(() => {
  //     throw new SyntaxError('Error');
  //   }, 3000);
  // }, []);

  return <div>App</div>;
};

export default App;
