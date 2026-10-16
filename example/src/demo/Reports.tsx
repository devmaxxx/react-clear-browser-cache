import { runningVersion } from './server';

export default function Reports() {
  return (
    <p className='reports' data-testid='reports'>
      Reports loaded from the {runningVersion} chunk.
    </p>
  );
}
