import { lazyRetry } from '../src/lazyRetry';

describe('lazyRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the first successful result without waiting', async () => {
    const fn = vi.fn().mockResolvedValue('module');

    await expect(lazyRetry(fn)).resolves.toBe('module');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries after the interval until a call succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockResolvedValue('module');

    const result = lazyRetry(fn, 2, 500);

    await vi.advanceTimersByTimeAsync(499);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('module');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('makes `attempts` calls in all, then rejects with the last error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockRejectedValueOnce(new Error('3'));

    const result = lazyRetry(fn, 3, 100);
    const assertion = expect(result).rejects.toThrow('3');

    await vi.advanceTimersByTimeAsync(200);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('makes two attempts by default, as 0.x did', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('gone'));

    const assertion = expect(lazyRetry(fn, undefined, 100)).rejects.toThrow(
      'gone'
    );

    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it.each([0, 1])('makes a single attempt for %i', async (attempts) => {
    const fn = vi.fn().mockRejectedValue(new Error('gone'));

    await expect(lazyRetry(fn, attempts)).rejects.toThrow('gone');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
