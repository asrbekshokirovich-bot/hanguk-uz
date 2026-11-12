import { beforeEach, describe, expect, it, vi } from 'vitest';

type Mod = typeof import('../buildReload');
/** A fresh copy of the module: its "reloading" flag lasts as long as the page does. */
async function load(): Promise<Mod> {
  vi.resetModules();
  return import('../buildReload');
}

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe('reloadForNewBuild', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('loads the page again and says so', async () => {
    const m = await load();
    const reload = vi.fn();
    const store = memoryStore();
    expect(m.isReloadingForNewBuild()).toBe(false);
    expect(m.reloadForNewBuild(1_000_000, store, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(m.isReloadingForNewBuild()).toBe(true);
    expect(store.data.get('chunk-reload-at')).toBe('1000000');
  });

  it('once a minute at most: a chunk that is really missing must not reload forever', async () => {
    const m = await load();
    const reload = vi.fn();
    const store = memoryStore({ 'chunk-reload-at': '1000000' });
    expect(m.reloadForNewBuild(1_000_000 + 59_999, store, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(m.isReloadingForNewBuild()).toBe(false);
    // A minute later it may try again.
    expect(m.reloadForNewBuild(1_000_000 + 60_000, store, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('without storage to remember the reload in, the error is left to the boundary', async () => {
    const m = await load();
    const reload = vi.fn();
    expect(m.reloadForNewBuild(1, null, reload)).toBe(false);
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(m.reloadForNewBuild(1_000_000, broken, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(m.isReloadingForNewBuild()).toBe(false);
  });
});

describe('while the page reloads for a new build', () => {
  it('nothing is reported', async () => {
    const m = await load();
    const { createErrorReporter } = await import('../errorReporter');
    const send = vi.fn().mockResolvedValue(undefined);
    const report = createErrorReporter(send);

    expect(report('crash', new Error('first'))).toBe(true);
    m.reloadForNewBuild(1_000_000, memoryStore(), vi.fn());
    // What React says when the old build's chunk resolves to nothing.
    expect(report('crash', new TypeError("Cannot read properties of undefined (reading 'default')"))).toBe(false);
    expect(report('error', new Error('anything else'))).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
