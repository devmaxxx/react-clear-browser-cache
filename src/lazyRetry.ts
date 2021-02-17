export function lazyRetry(
  fn: () => Promise<any>,
  retriesLeft = 2,
  interval = 1000
) {
  return new Promise((resolve, reject) => {
    fn()
      .then(resolve)
      .catch((error) => {
        setTimeout(() => {
          if (retriesLeft === 1) {
            reject(error);
            return;
          }

          lazyRetry(fn, retriesLeft - 1, interval).then(resolve, reject);
        }, interval);
      });
  });
}

export default lazyRetry;
