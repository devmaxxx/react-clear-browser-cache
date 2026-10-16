/**
 * Calls `fn` and, while it rejects, calls it again up to `retries` more times,
 * waiting `interval` ms between attempts. Rejects with the last error.
 */
export function lazyRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  interval = 1000
): Promise<T> {
  return fn().catch((error: unknown) => {
    if (retries <= 0) {
      throw error;
    }

    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        lazyRetry(fn, retries - 1, interval).then(resolve, reject);
      }, interval);
    });
  });
}

export default lazyRetry;
