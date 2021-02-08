import ClearBrowserCacheProvider from '../ClearBrowserCacheProvider';

const doImport = () => Promise.reject(new Error(''));

describe('ClearBrowserCache', () => {
  it('is truthy', () => {
    expect(ClearBrowserCacheProvider).toBeTruthy();
  });

  it('kek', () => {
    const promise = doImport();

    return promise.catch((err) => {
      expect(err).toBeInstanceOf(Error);
    });
  });
});
