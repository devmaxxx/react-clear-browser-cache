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

  it('makes `retries` extra attempts, then rejects with the last error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockRejectedValueOnce(new Error('3'));

    const result = lazyRetry(fn, 2, 100);
    const assertion = expect(result).rejects.toThrow('3');

    await vi.advanceTimersByTimeAsync(200);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('rejects at once when no retries are allowed', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('gone'));

    await expect(lazyRetry(fn, 0)).rejects.toThrow('gone');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
