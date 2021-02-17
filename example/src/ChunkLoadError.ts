export class ChunkLoadError extends Error {
  constructor(props: any) {
    super(props);
    this.name = 'ChunkLoadError';
  }
}

export default ChunkLoadError;
