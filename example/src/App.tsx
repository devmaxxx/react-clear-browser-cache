import React from 'react';

// @ts-ignore
class ChunkLoadError extends Error {
  constructor(props: any) {
    super(props);
    this.name = 'ChunkLoadError';
  }
}

const App = () => {
  // React.useEffect(() => {
  //   setTimeout(() => {
  //     throw new ChunkLoadError('Loading chunk 1 failed');
  //   }, 3000);
  // }, []);

  // throw new ChunkLoadError('Loading chunk 1 failed');
  // React.useEffect(() => {
  //   setTimeout(() => {
  //     throw new SyntaxError('Error');
  //   }, 3000);
  // }, []);

  return <div>App</div>;
};

export default App;
