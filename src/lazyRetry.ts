/**
 * Calls `fn` up to `attempts` times in all, waiting `interval` ms between
 * attempts, until it resolves. Rejects with the last error.
 */
export function lazyRetry<T>(
  fn: () => Promise<T>,
  attempts = 2,
  interval = 1000
): Promise<T> {
  return fn().catch((error: unknown) => {
    // 0.x retried forever on 0; anything below 2 now means a single attempt.
    if (attempts <= 1) {
      throw error;
    }

    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        lazyRetry(fn, attempts - 1, interval).then(resolve, reject);
      }, interval);
    });
  });
}

export default lazyRetry;
