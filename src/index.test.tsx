import { ClearBrowserCache } from '.';

const doImport = () => Promise.reject(new Error(''));

describe('ClearBrowserCache', () => {
  it('is truthy', () => {
    expect(ClearBrowserCache).toBeTruthy();
  });

  it('kek', () => {
    const promise = doImport();

    return promise.catch((err) => {
      expect(err).toBeInstanceOf(Error);
    });
  });
});
